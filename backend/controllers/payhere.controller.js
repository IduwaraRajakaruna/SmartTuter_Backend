/**
 * payhere.controller.js
 *
 * Handles all PayHere-specific endpoints:
 *
 *   POST /api/payments/payhere/create   — initiate payment & return checkout payload
 *   POST /api/payments/payhere/notify   — server-to-server callback from PayHere
 *   GET  /api/payments/payhere/return   — browser redirect after successful payment
 *   GET  /api/payments/payhere/cancel   — browser redirect after cancelled payment
 */

const mongoose = require('mongoose');
const Payment  = require('../models/payment.model');
const User     = require('../models/user.model');
const crypto   = require('crypto');

const { buildCheckoutPayload, verifyNotifyHash, mapPayHereStatusCode } =
    require('../services/payhere.service');
const { confirmEnrollment } = require('../services/enrollment.service');

// ---------------------------------------------------------------------------
// Helper: generate a cryptographically random, unique orderId
// Duplicated from payments.controller to keep this controller self-contained.
// ---------------------------------------------------------------------------
const generateOrderId = () => {
    const ts  = Date.now();
    const rnd = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `ORD-${ts}-${rnd}`;
};

// ---------------------------------------------------------------------------
// POST /api/payments/payhere/create
// Auth: JWT required. Role: student (or admin).
//
// Creates a Payment record (status: initiated) and returns the full PayHere
// checkout payload. The frontend POSTs this payload to PayHere's checkout URL.
// The merchant_secret NEVER appears in the response.
// ---------------------------------------------------------------------------
exports.createPayHerePayment = async (req, res) => {
    try {
        const { classId, amount, currency } = req.body;

        // --- Input validation ---
        if (!classId || amount === undefined || amount === null) {
            return res.status(400).json({ message: 'classId and amount are required' });
        }

        if (!mongoose.Types.ObjectId.isValid(classId)) {
            return res.status(400).json({ message: 'Invalid classId' });
        }

        const parsedAmount = Number(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ message: 'amount must be a positive number' });
        }

        // --- Authorization ---
        const requestingRole = req.user?.role;
        const requestingId   = req.user?.id;

        if (requestingRole !== 'student' && requestingRole !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const studentId = requestingRole === 'admin'
            ? (req.body.studentId || requestingId)
            : requestingId;

        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(400).json({ message: 'Invalid studentId' });
        }

        // --- Fetch student info required by PayHere ---
        const student = await User.findById(studentId).select('fullName email');
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // --- Create Payment record ---
        const orderId = generateOrderId();

        const payment = await Payment.create({
            studentId,
            classId,
            amount:        parsedAmount,
            currency:      currency || 'LKR',
            status:        'initiated',
            orderId,
            transactionId: null,
            paidAt:        null,
        });

        // --- Build PayHere checkout payload (hash generated server-side) ---
        const checkout = buildCheckoutPayload(payment, student);

        return res.status(201).json({
            success: true,
            // The frontend uses checkoutUrl + payload to submit the PayHere form.
            // NEVER expose merchant_secret — it stays in payhere.service.js.
            checkoutUrl: checkout.checkoutUrl,
            payload:     checkout.payload,
            // Also return our internal payment id so the frontend can poll status
            paymentId:   payment._id,
        });
    } catch (error) {
        console.error('[payhere] createPayHerePayment error:', error.message);
        return res.status(500).json({ message: 'Failed to initiate PayHere payment' });
    }
};

// ---------------------------------------------------------------------------
// POST /api/payments/payhere/notify
// NO JWT auth — this is a server-to-server callback from PayHere.
// Security is provided by HMAC/MD5 signature verification (md5sig).
//
// PayHere sends application/x-www-form-urlencoded POST with:
//   merchant_id, order_id, payment_id, payhere_amount, payhere_currency,
//   status_code, md5sig, custom_1 (our MongoDB payment _id)
// ---------------------------------------------------------------------------
exports.handleNotify = async (req, res) => {
    try {
        const body = req.body;

        // --- Step 1: Verify PayHere signature BEFORE trusting any data ---
        let signatureValid;
        try {
            signatureValid = verifyNotifyHash(body);
        } catch (sigErr) {
            // merchant_secret env var missing — configuration error
            console.error('[payhere] Signature verification error:', sigErr.message);
            return res.status(500).send('Configuration error');
        }

        if (!signatureValid) {
            // Log the raw order_id for reconciliation but NOT the full body
            // (which may contain financial data)
            console.warn(
                '[payhere] INVALID signature on notify for order_id:',
                body.order_id
            );
            // PayHere expects HTTP 200 even on failure; log and ignore
            return res.status(200).send('INVALID_SIGNATURE');
        }

        // --- Step 2: Map PayHere status_code to our status string ---
        const newStatus = mapPayHereStatusCode(body.status_code);

        if (!newStatus) {
            console.warn('[payhere] Unknown status_code received:', body.status_code);
            return res.status(200).send('UNKNOWN_STATUS');
        }

        // --- Step 3: Look up the Payment record ---
        // We use custom_1 (our MongoDB _id) as the primary lookup because
        // order_id alone could theoretically be guessed; custom_1 is internal.
        const paymentId = body.custom_1;

        if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
            console.warn('[payhere] Invalid or missing custom_1 (paymentId):', paymentId);
            return res.status(200).send('INVALID_PAYMENT_ID');
        }

        const payment = await Payment.findById(paymentId);

        if (!payment) {
            console.warn('[payhere] Payment not found for id:', paymentId);
            return res.status(200).send('PAYMENT_NOT_FOUND');
        }

        // --- Step 4: Guard against re-processing a terminal payment ---
        const terminalStatuses = ['completed', 'failed', 'cancelled'];
        if (terminalStatuses.includes(payment.status)) {
            console.info(
                `[payhere] Notify received for already-terminal payment ${paymentId} (${payment.status}) — ignoring.`
            );
            return res.status(200).send('ALREADY_PROCESSED');
        }

        // --- Step 5: Update payment record ---
        payment.status        = newStatus;
        payment.transactionId = body.payment_id || null;

        if (newStatus === 'completed') {
            payment.paidAt = new Date();
        }

        await payment.save();

        console.info(
            `[payhere] Payment ${paymentId} updated to "${newStatus}" (PayHere payment_id: ${body.payment_id})`
        );

        // --- Step 6: Trigger enrollment on successful completion ---
        if (newStatus === 'completed') {
            try {
                await confirmEnrollment(paymentId);
            } catch (enrollErr) {
                // Enrollment failure must NOT affect the PayHere response.
                // The payment is already saved; this must be reconciled manually.
                console.error(
                    `[payhere] ENROLLMENT FAILED for payment ${paymentId}:`,
                    enrollErr.message
                );
            }
        }

        // PayHere requires HTTP 200 to acknowledge the notification
        return res.status(200).send('OK');

    } catch (error) {
        console.error('[payhere] handleNotify error:', error.message);
        // Still return 200 so PayHere doesn't retry indefinitely with a broken payload
        return res.status(200).send('SERVER_ERROR');
    }
};

// ---------------------------------------------------------------------------
// GET /api/payments/payhere/return
// Browser redirect after the user completes payment on PayHere.
// Auth: JWT (user is still logged in when browser returns).
//
// NOTE: Do NOT treat this as payment confirmation — use the notify endpoint
// for that. The return URL is for UX only (showing a "thank you" page).
// ---------------------------------------------------------------------------
exports.handleReturn = async (req, res) => {
    // PayHere appends order_id as a query param on return
    const { order_id } = req.query;

    // Return a minimal JSON response for now.
    // TODO(frontend): Replace with a redirect to the frontend success page
    // e.g. res.redirect(`${process.env.FRONTEND_URL}/payment/success?order=${order_id}`);
    return res.status(200).json({
        success: true,
        message: 'Payment completed. Your enrollment will be confirmed shortly.',
        orderId: order_id || null,
    });
};

// ---------------------------------------------------------------------------
// GET /api/payments/payhere/cancel
// Browser redirect when the user cancels the PayHere payment flow.
// Auth: JWT (user is still logged in when browser returns).
// ---------------------------------------------------------------------------
exports.handleCancel = async (req, res) => {
    const { order_id } = req.query;

    // TODO(frontend): Replace with a redirect to the frontend cancel page
    // e.g. res.redirect(`${process.env.FRONTEND_URL}/payment/cancel?order=${order_id}`);
    return res.status(200).json({
        success: false,
        message: 'Payment was cancelled.',
        orderId: order_id || null,
    });
};
