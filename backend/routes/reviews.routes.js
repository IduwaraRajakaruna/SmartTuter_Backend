const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const {
  createReview,
  listMyReviews,
  listTeacherReviews,
} = require('../controllers/reviews.controller');

const router = express.Router();

router.post('/', authMiddleware, authorizeRoles('student'), createReview);
router.get('/student/me', authMiddleware, authorizeRoles('student'), listMyReviews);
router.get('/teacher/me', authMiddleware, authorizeRoles('teacher', 'admin'), listTeacherReviews);
router.get('/teacher/:teacherId', listTeacherReviews);

module.exports = router;