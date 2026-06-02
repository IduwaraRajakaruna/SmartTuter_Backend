const express = require('express');

const router = express.Router();

const auth = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const {
    createPayHerePayment,
    handleNotify,
    handleReturn,
    handleCancel,
} = require('../controllers/payhere.controller');

// POST /api/payments/payhere/create
// Authenticated student (or admin) initiates a PayHere payment.
// Returns the checkout payload — frontend submits it to PayHere's form action URL.
router.post(
    '/create',
    auth,
    authorizeRoles('student', 'admin'),
    createPayHerePayment
);

// POST /api/payments/payhere/notify
// Server-to-server callback from PayHere. NO JWT auth.
// Authenticated exclusively by verifying the PayHere md5sig signature.
// express.urlencoded must be enabled in app.js (it already is).
router.post('/notify', handleNotify);

// GET /api/payments/payhere/return
// Browser redirect from PayHere after a successful payment.
// The user's browser is still authenticated via the existing session.
router.get('/return', auth, handleReturn);

// GET /api/payments/payhere/cancel
// Browser redirect from PayHere when the user cancels the payment.
router.get('/cancel', auth, handleCancel);

module.exports = router;
