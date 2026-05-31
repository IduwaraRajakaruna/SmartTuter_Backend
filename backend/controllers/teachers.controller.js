const TeacherProfile = require("../models/teacher-profile.model");

const mapTeacher = (teacherProfile) => ({
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
});

exports.listActiveTeachers = async (req, res) => {
  try {
    const teachers = await TeacherProfile.find({ approvalStatus: "active" })
      .populate("user")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      teachers: teachers.map(mapTeacher),
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

    return res.status(200).json({
      success: true,
      teacher: mapTeacher(teacherProfile),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

