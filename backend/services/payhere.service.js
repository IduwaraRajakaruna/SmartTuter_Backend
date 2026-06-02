/**
 * payhere.service.js
 *
 * Pure utility functions for PayHere integration.
 * No Express logic here — only hash generation and payload building.
 *
 * SECURITY RULES:
 *  - merchant_secret MUST NEVER be sent to the frontend.
 *  - All hashes are generated server-side only.
 *  - Notify signature MUST be verified before trusting any PayHere callback.
 */

const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Config — fail fast if required env vars are missing
// ---------------------------------------------------------------------------
const getMerchantId = () => {
    const id = process.env.PAYHERE_MERCHANT_ID;
    if (!id) throw new Error('PAYHERE_MERCHANT_ID is not set in environment');
    return id;
};

const getMerchantSecret = () => {
    const secret = process.env.PAYHERE_MERCHANT_SECRET;
    if (!secret) throw new Error('PAYHERE_MERCHANT_SECRET is not set in environment');
    return secret;
};

/**
 * PayHere checkout endpoint.
 * Sandbox: https://sandbox.payhere.lk/pay/checkout
 * Production: https://www.payhere.lk/pay/checkout
 */
const getPayHereCheckoutUrl = () =>
    process.env.NODE_ENV === 'production'
        ? 'https://www.payhere.lk/pay/checkout'
        : 'https://sandbox.payhere.lk/pay/checkout';

// ---------------------------------------------------------------------------
// generateCheckoutHash
//
// Formula (from PayHere docs):
//   hash = MD5(merchant_id + order_id + formatted_amount + currency +
//              MD5(merchant_secret).toUpperCase()).toUpperCase()
//
// @param {string} orderId
// @param {string|number} formattedAmount
// @param {string} currency  e.g. 'LKR'
// @returns {string} uppercase MD5 hash
// ---------------------------------------------------------------------------
const generateCheckoutHash = (orderId, formattedAmount, currency) => {
    const merchantId = getMerchantId();
    const merchantSecret = getMerchantSecret();

    const secretHash = crypto
        .createHash('md5')
        .update(merchantSecret)
        .digest('hex')
        .toUpperCase();

    const raw = `${merchantId}${orderId}${formattedAmount}${currency}${secretHash}`;

    return crypto
        .createHash('md5')
        .update(raw)
        .digest('hex')
        .toUpperCase();
};

// ---------------------------------------------------------------------------
// buildCheckoutPayload
//
// Builds the full payload that the frontend POSTs to PayHere's checkout URL.
// The merchant_secret never appears in this object.
//
// @param {object} payment  — Payment document from MongoDB
// @param {object} student  — User document (fullName, email)
// @returns {object} PayHere checkout payload + checkoutUrl
// ---------------------------------------------------------------------------
const buildCheckoutPayload = (payment, student) => {
    const merchantId = getMerchantId();
    const orderId = payment.orderId;
    const amount = payment.amount;
    const currency = payment.currency || 'LKR';

    // Format amount exactly once to ensure hash and payload match perfectly
    const formattedAmount = Number(amount).toFixed(2);

    const hash = generateCheckoutHash(orderId, formattedAmount, currency);

    // Split fullName into first/last for PayHere (best-effort)
    const nameParts = (student.fullName || '').trim().split(' ');
    const firstName = nameParts[0] || 'Student';
    const lastName = nameParts.slice(1).join(' ') || '-';

    return {
        checkoutUrl: getPayHereCheckoutUrl(),
        payload: {
            sandbox: process.env.NODE_ENV !== 'production',
            merchant_id: merchantId,
            return_url: process.env.PAYHERE_RETURN_URL,
            cancel_url: process.env.PAYHERE_CANCEL_URL,
            notify_url: process.env.PAYHERE_NOTIFY_URL,
            order_id: orderId,
            items: `Class Payment - ${payment.classId}`,
            currency: currency,
            amount: formattedAmount,
            first_name: firstName,
            last_name: lastName,
            email: student.email,
            phone: student.phone || '0000000000',
            address: 'N/A',
            city: 'Colombo',
            country: 'Sri Lanka',
            // custom_1 carries our MongoDB payment _id so the notify handler
            // can look up the correct payment record without trusting order_id alone.
            custom_1: payment._id.toString(),
            hash,
        }
    };
};

// ---------------------------------------------------------------------------
// verifyNotifyHash
//
// Verifies the md5sig sent by PayHere in the server-to-server notify POST.
//
// Formula (from PayHere docs):
//   md5sig == MD5(merchant_id + order_id + payhere_amount + payhere_currency
//                 + status_code + MD5(merchant_secret).toUpperCase()).toUpperCase()
//
// @param {object} body — raw body from PayHere notify POST
// @returns {boolean}
// ---------------------------------------------------------------------------
const verifyNotifyHash = (body) => {
    const {
        merchant_id,
        order_id,
        payhere_amount,
        payhere_currency,
        status_code,
        md5sig,
    } = body;

    if (!md5sig) return false;

    const merchantSecret = getMerchantSecret();

    const secretHash = crypto
        .createHash('md5')
        .update(merchantSecret)
        .digest('hex')
        .toUpperCase();

    const raw = `${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${secretHash}`;

    const expected = crypto
        .createHash('md5')
        .update(raw)
        .digest('hex')
        .toUpperCase();

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
        Buffer.from(expected, 'utf8'),
        Buffer.from(md5sig.toUpperCase(), 'utf8')
    );
};

// ---------------------------------------------------------------------------
// mapPayHereStatusCode
//
// PayHere status codes → our internal payment status strings
//   2  = Success (completed)
//   0  = Pending
//  -1  = Cancelled
//  -2  = Failed
//  -3  = Chargedback (treat as failed)
// ---------------------------------------------------------------------------
const mapPayHereStatusCode = (statusCode) => {
    const code = parseInt(statusCode, 10);
    switch (code) {
        case 2: return 'completed';
        case 0: return 'pending';
        case -1: return 'cancelled';
        case -2: return 'failed';
        case -3: return 'failed';   // chargedback
        default: return null;       // unknown — reject
    }
};

module.exports = {
    generateCheckoutHash,
    buildCheckoutPayload,
    verifyNotifyHash,
    mapPayHereStatusCode,
    getPayHereCheckoutUrl,
};
