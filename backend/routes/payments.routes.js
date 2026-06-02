const express = require('express');

const router = express.Router();

const auth = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const {
    createPayment,
    getPaymentById,
    getPaymentsByStudent,
    updatePaymentStatus,
} = require('../controllers/payments.controller');

// IMPORTANT: The static route /student/:studentId MUST be declared before
// the dynamic route /:id to prevent Express matching "student" as an id.

// POST /api/payments/create — initiate a new payment record
router.post('/create', auth, authorizeRoles('student', 'admin'), createPayment);

// GET /api/payments/student/:studentId — list all payments for a student
router.get('/student/:studentId', auth, authorizeRoles('student', 'admin'), getPaymentsByStudent);

// GET /api/payments/:id — get a single payment by its MongoDB _id
router.get('/:id', auth, authorizeRoles('student', 'admin'), getPaymentById);

// PATCH /api/payments/:id/status — admin updates payment status (triggers enrollment on "completed")
router.patch('/:id/status', auth, authorizeRoles('admin'), updatePaymentStatus);

module.exports = router;
