const User = require('../models/user.model');
const TeacherProfile = require('../models/teacher-profile.model');
const Review = require('../models/review.model');

const resolveId = (value) => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (typeof value.toString === 'function') return value.toString();
    if (value.id) return resolveId(value.id);
    if (value._id) return resolveId(value._id);
  }
  return String(value);
};

const mapReview = (review) => ({
  id: resolveId(review._id),
  studentId: resolveId(review.studentId),
  studentName: review.studentName,
  teacherId: resolveId(review.teacherId),
  teacherName: review.teacherName,
  classId: review.classId,
  className: review.className,
  rating: review.rating,
  comment: review.comment,
  date: review.createdAt ? review.createdAt.toISOString().split('T')[0] : undefined,
});

const buildSummary = (reviews) => {
  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
    : 0;
  const totalStudents = new Set(reviews.map(review => resolveId(review.studentId)).filter(Boolean)).size;

  return {
    totalReviews,
    averageRating: Number(averageRating.toFixed(1)),
    totalStudents,
  };
};

exports.createReview = async (req, res) => {
  try {
    const { teacherId, classId, className, rating, comment } = req.body;

    if (!teacherId || !classId || !className || rating === undefined || rating === null || !comment) {
      return res.status(400).json({ message: 'teacherId, classId, className, rating and comment are required' });
    }

    const normalizedRating = Number(rating);
    if (!Number.isFinite(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const studentId = resolveId(req.user?.id || req.user?._id || req.user?.userId || req.user?.sub);
    if (!studentId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(403).json({ message: 'Only students can submit reviews' });
    }

    const teacherProfile = await TeacherProfile.findOne({ user: teacherId }).populate('user');
    if (!teacherProfile || teacherProfile.approvalStatus !== 'active') {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    const teacherName = teacherProfile.user?.fullName || teacherProfile.subject || 'Teacher';

    const review = await Review.findOneAndUpdate(
      {
        studentId,
        teacherId,
        classId,
      },
      {
        studentName: student.fullName,
        teacherName,
        className,
        rating: normalizedRating,
        comment: comment.trim(),
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(201).json({
      success: true,
      review: mapReview(review),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'You already reviewed this class' });
    }

    return res.status(500).json({ message: error.message });
  }
};

exports.listMyReviews = async (req, res) => {
  try {
    const studentId = resolveId(req.user?.id || req.user?._id || req.user?.userId || req.user?.sub);
    if (!studentId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const reviews = await Review.find({ studentId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      reviews: reviews.map(mapReview),
      summary: {
        totalReviews: reviews.length,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.listTeacherReviews = async (req, res) => {
  try {
    const authTeacherId = resolveId(req.user?.id || req.user?._id || req.user?.userId || req.user?.sub);
    const teacherId = req.params.teacherId === 'me' ? authTeacherId : resolveId(req.params.teacherId);

    if (!teacherId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (req.user?.role === 'teacher' && authTeacherId && authTeacherId !== teacherId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const reviews = await Review.find({ teacherId }).sort({ createdAt: -1 });
    const summary = buildSummary(reviews);

    return res.status(200).json({
      success: true,
      reviews: reviews.map(mapReview),
      summary,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
