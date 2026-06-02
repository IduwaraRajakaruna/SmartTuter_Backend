/**
 * enrollment.service.js
 *
 * Handles the single side-effect of a completed payment:
 *   - Atomically increment Class.studentsEnrolled
 *
 * Design principle:
 *   Payment (status: "completed") is the single source of truth for enrollment.
 *   To check if a student is enrolled in a class, query Payment with:
 *     { studentId, classId, status: "completed" }
 *
 *   StudentProfile is NOT modified here. No secondary enrollment record is kept.
 *   This keeps the model simple and consistent for PayHere integration.
 *
 * TODO(security): When the PayHere webhook is integrated, validate the incoming
 * payload with a HMAC signature check BEFORE calling confirmEnrollment to
 * prevent spoofed completion requests.
 */

const Payment = require('../models/payment.model');
const Class   = require('../models/class.model');

/**
 * confirmEnrollment
 *
 * @param {string} paymentId - MongoDB _id of the Payment document
 * @returns {{ success: boolean, message: string }}
 *
 * Throws if the payment is not found, not in "completed" status, or if
 * the class does not exist. Callers must catch and handle errors.
 */
const confirmEnrollment = async (paymentId) => {
    // -----------------------------------------------------------------------
    // 1. Fetch the payment and validate state
    // -----------------------------------------------------------------------
    const payment = await Payment.findById(paymentId);

    if (!payment) {
        throw new Error(`Payment not found: ${paymentId}`);
    }

    if (payment.status !== 'completed') {
        throw new Error(
            `confirmEnrollment called on non-completed payment (status: ${payment.status})`
        );
    }

    const { classId } = payment;

    // -----------------------------------------------------------------------
    // 2. Verify the class exists
    // -----------------------------------------------------------------------
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
        throw new Error(`Class not found: ${classId}`);
    }

    // -----------------------------------------------------------------------
    // 3. Atomically increment Class.studentsEnrolled
    //    $inc is atomic in MongoDB and safe under concurrent requests.
    // -----------------------------------------------------------------------
    await Class.findByIdAndUpdate(
        classId,
        { $inc: { studentsEnrolled: 1 } }
    );

    console.info(
        `[enrollment] studentsEnrolled incremented for class ${classId} via payment ${paymentId}`
    );

    return { success: true, message: 'Enrollment confirmed' };
};

module.exports = { confirmEnrollment };
