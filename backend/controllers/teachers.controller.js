const TeacherProfile = require("../models/teacher-profile.model");
const Review = require('../models/review.model');

const buildTeacherStatsMap = async (teacherIds = []) => {
  const reviews = await Review.find({ teacherId: { $in: teacherIds } }).select('teacherId rating studentId');
  const statsMap = new Map();

  for (const review of reviews) {
    const key = review.teacherId.toString();
    const current = statsMap.get(key) || {
      totalReviews: 0,
      ratingSum: 0,
      studentIds: new Set(),
    };

    current.totalReviews += 1;
    current.ratingSum += review.rating;
    current.studentIds.add(review.studentId.toString());
    statsMap.set(key, current);
  }

  return statsMap;
};

const mapTeacher = (teacherProfile, stats = {}) => ({
  id: teacherProfile.user?._id?.toString?.() || teacherProfile.user?._id,
  name: teacherProfile.user?.fullName,
  email: teacherProfile.user?.email,
  subject: teacherProfile.subject,
  qualification: teacherProfile.qualification,
  experience: teacherProfile.experience,
  phone: teacherProfile.phone,
  bio: teacherProfile.bio,
  hourlyRate: teacherProfile.hourlyRate,
  zoomLink: teacherProfile.zoomLink,
  // what UI expects
  status: teacherProfile.approvalStatus === "active" ? "active" : teacherProfile.approvalStatus,
  rating: stats.totalReviews > 0 ? Number((stats.ratingSum / stats.totalReviews).toFixed(1)) : 0,
  totalReviews: stats.totalReviews || 0,
});

exports.listActiveTeachers = async (req, res) => {
  try {
    const teachers = await TeacherProfile.find({ approvalStatus: "active" })
      .populate("user")
      .sort({ createdAt: -1 });

    const statsMap = await buildTeacherStatsMap(teachers.map((teacherProfile) => teacherProfile.user?._id?.toString?.() || teacherProfile.user?._id));

    return res.status(200).json({
      success: true,
      teachers: teachers.map((teacherProfile) => mapTeacher(teacherProfile, statsMap.get(teacherProfile.user?._id?.toString?.() || teacherProfile.user?._id) || {})),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getTeacherPublicProfile = async (req, res) => {
  try {
    const { teacherId } = req.params;

    const teacherProfile = await TeacherProfile.findOne({
      user: teacherId,
      approvalStatus: "active",
    }).populate("user");

    if (!teacherProfile) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const statsMap = await buildTeacherStatsMap([teacherId]);

    return res.status(200).json({
      success: true,
      teacher: mapTeacher(teacherProfile, statsMap.get(teacherId.toString()) || {}),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

