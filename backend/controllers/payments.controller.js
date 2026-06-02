const crypto = require('crypto');
const mongoose = require('mongoose');
const Payment = require('../models/payment.model');
const { confirmEnrollment } = require('../services/enrollment.service');

// ---------------------------------------------------------------------------
// Helper: safe payment payload (never expose internal DB fields blindly)
// ---------------------------------------------------------------------------
const buildPaymentPayload = (doc) => ({
    id: doc._id,
    studentId: doc.studentId,
    classId: doc.classId,
    amount: doc.amount,
    currency: doc.currency,
    status: doc.status,
    orderId: doc.orderId,
    // TODO(security): transactionId is included here for internal/admin use.
    // Consider omitting or masking it for student-facing responses if it
    // carries sensitive gateway data.
    transactionId: doc.transactionId,
    createdAt: doc.createdAt,
    paidAt: doc.paidAt,
});

// ---------------------------------------------------------------------------
// Helper: generate a cryptographically random, unique orderId
// Format: ORD-<timestamp>-<8 random hex chars>
// ---------------------------------------------------------------------------
const generateOrderId = () => {
    const ts = Date.now();
    const rnd = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `ORD-${ts}-${rnd}`;
};

// ---------------------------------------------------------------------------
// POST /api/payments/create
// Requires authentication. Only a student (or admin) may initiate a payment.
// ---------------------------------------------------------------------------
exports.createPayment = async (req, res) => {
    try {
        const { classId, amount, currency } = req.body;

        // --- Input validation ---
        if (!classId || amount === undefined || amount === null) {
            return res.status(400).json({
                message: 'classId and amount are required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(classId)) {
            return res.status(400).json({ message: 'Invalid classId' });
        }

        const parsedAmount = Number(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ message: 'amount must be a positive number' });
        }

        // --- Authorization: only students (or admin) may create payments ---
        const requestingRole = req.user?.role;
        const requestingId = req.user?.id;

        if (requestingRole !== 'student' && requestingRole !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Derive studentId: admin may specify one, student always uses their own
        const studentId = requestingRole === 'admin'
            ? (req.body.studentId || requestingId)
            : requestingId;

        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(400).json({ message: 'Invalid studentId' });
        }

        const orderId = generateOrderId();

        const payment = await Payment.create({
            studentId,
            classId,
            amount: parsedAmount,
            currency: currency || 'LKR',
            status: 'initiated',
            orderId,
            transactionId: null,
            paidAt: null,
        });

        return res.status(201).json({
            success: true,
            payment: buildPaymentPayload(payment)
        });
    } catch (error) {
        // TODO(security): Do NOT expose raw error messages in production.
        // Log error internally; return generic message to client.
        console.error('[payments] createPayment error:', error.message);
        return res.status(500).json({ message: 'Failed to create payment' });
    }
};

// ---------------------------------------------------------------------------
// GET /api/payments/:id
// Student may only fetch their own payment; admin may fetch any.
// ---------------------------------------------------------------------------
exports.getPaymentById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid payment id' });
        }

        const payment = await Payment.findById(id);

        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        // Authorization: students may only view their own payment records
        const requestingRole = req.user?.role;
        const requestingId = req.user?.id;

        if (
            requestingRole !== 'admin' &&
            payment.studentId.toString() !== requestingId
        ) {
            return res.status(403).json({ message: 'Access denied' });
        }

        return res.status(200).json({
            success: true,
            payment: buildPaymentPayload(payment)
        });
    } catch (error) {
        console.error('[payments] getPaymentById error:', error.message);
        return res.status(500).json({ message: 'Failed to retrieve payment' });
    }
};

// ---------------------------------------------------------------------------
// GET /api/payments/student/:studentId
// Student may only fetch their own list; admin may fetch any student's list.
// ---------------------------------------------------------------------------
exports.getPaymentsByStudent = async (req, res) => {
    try {
        const { studentId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(400).json({ message: 'Invalid studentId' });
        }

        // Authorization check
        const requestingRole = req.user?.role;
        const requestingId = req.user?.id;

        if (requestingRole !== 'admin' && studentId !== requestingId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const payments = await Payment.find({ studentId })
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            payments: payments.map(buildPaymentPayload)
        });
    } catch (error) {
        console.error('[payments] getPaymentsByStudent error:', error.message);
        return res.status(500).json({ message: 'Failed to retrieve payments' });
    }
};

// ---------------------------------------------------------------------------
// PATCH /api/payments/:id/status
// Admin-only: update the status of a payment.
// When status transitions to "completed", enrollment is automatically
// confirmed via confirmEnrollment().
// ---------------------------------------------------------------------------
const VALID_STATUSES = ['initiated', 'pending', 'completed', 'failed', 'cancelled'];

exports.updatePaymentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, transactionId } = req.body;

        // --- Input validation ---
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid payment id' });
        }

        if (!status || !VALID_STATUSES.includes(status)) {
            return res.status(400).json({
                message: `status must be one of: ${VALID_STATUSES.join(', ')}`
            });
        }

        // --- Authorization: admin only ---
        // TODO(security): When PayHere webhook is integrated, create a
        // separate internal-only endpoint authenticated by HMAC signature
        // rather than reusing this admin route.
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const payment = await Payment.findById(id);

        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        const previousStatus = payment.status;

        // Guard against invalid backward transitions
        const terminalStatuses = ['completed', 'failed', 'cancelled'];
        if (terminalStatuses.includes(previousStatus)) {
            return res.status(409).json({
                message: `Cannot transition payment from terminal status "${previousStatus}"`
            });
        }

        // Apply status update
        payment.status = status;

        if (status === 'completed') {
            payment.paidAt = new Date();
        }

        // Optionally record the gateway transactionId
        if (transactionId !== undefined && transactionId !== null) {
            payment.transactionId = String(transactionId).trim();
        }

        await payment.save();

        // --- Trigger enrollment when payment is completed ---
        if (status === 'completed') {
            try {
                const enrollment = await confirmEnrollment(payment._id.toString());
                console.info(
                    `[payments] Enrollment result for payment ${id}:`,
                    enrollment.message
                );
            } catch (enrollErr) {
                // Enrollment failure must NOT roll back the payment status update.
                // Log the error and alert so it can be reconciled manually.
                console.error(
                    `[payments] ENROLLMENT FAILED for payment ${id}:`,
                    enrollErr.message
                );
                // Return 207 Multi-Status: payment updated but enrollment had an issue
                return res.status(207).json({
                    success: true,
                    warning: 'Payment marked completed but enrollment could not be confirmed. Please check server logs.',
                    payment: buildPaymentPayload(payment)
                });
            }
        }

        return res.status(200).json({
            success: true,
            payment: buildPaymentPayload(payment)
        });
    } catch (error) {
        console.error('[payments] updatePaymentStatus error:', error.message);
        return res.status(500).json({ message: 'Failed to update payment status' });
    }
};

// ---------------------------------------------------------------------------
// GET /api/payments/admin/analytics
// Admin-only: returns total revenue, all payments (with student/class names),
// and the 5 most recent payments for the dashboard widget.
// ---------------------------------------------------------------------------
exports.getAdminPaymentAnalytics = async (req, res) => {
    try {
        // --- Authorization: admin only ---
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Fetch all payments, newest first, populated with student name and class title
        const payments = await Payment.find({})
            .populate('studentId', 'fullName email')
            .populate('classId', 'title subject')
            .sort({ createdAt: -1 })
            .lean();

        // Build safe response payload — omit transactionId to avoid
        // leaking sensitive gateway identifiers to the admin UI.
        // TODO(security): transactionId is intentionally excluded here.
        // If admin needs it for reconciliation, add a separate detail endpoint.
        const allPayments = payments.map(p => ({
            id: p._id,
            studentName: p.studentId?.fullName || 'Unknown Student',
            studentEmail: p.studentId?.email || '',
            className: p.classId?.title || 'Unknown Class',
            classSubject: p.classId?.subject || '',
            amount: p.amount,
            currency: p.currency,
            status: p.status,
            orderId: p.orderId,
            createdAt: p.createdAt,
            paidAt: p.paidAt,
        }));

        // Total revenue = sum of completed payment amounts
        const totalRevenue = allPayments
            .filter(p => p.status === 'completed')
            .reduce((sum, p) => sum + p.amount, 0);

        // Recent payments: first 5 (already sorted newest-first)
        const recentPayments = allPayments.slice(0, 5);

        return res.status(200).json({
            success: true,
            totalRevenue,
            totalPayments: allPayments.length,
            completedCount: allPayments.filter(p => p.status === 'completed').length,
            pendingCount: allPayments.filter(p => p.status === 'pending' || p.status === 'initiated').length,
            failedCount: allPayments.filter(p => p.status === 'failed').length,
            recentPayments,
            allPayments,
        });
    } catch (error) {
        console.error('[payments] getAdminPaymentAnalytics error:', error.message);
        return res.status(500).json({ message: 'Failed to retrieve payment analytics' });
    }
};
