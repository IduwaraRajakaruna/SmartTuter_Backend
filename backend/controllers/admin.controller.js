const User = require("../models/user.model");
const TeacherProfile = require("../models/teacher-profile.model");
const StudentProfile = require("../models/student-profile.model");

const mapTeacher = (teacherProfile) => ({
    id: teacherProfile.user._id,
    name: teacherProfile.user.fullName,
    email: teacherProfile.user.email,
    role: teacherProfile.user.role,
    status: teacherProfile.user.status === 'inactive'
        ? 'inactive'
        : teacherProfile.approvalStatus,
    subject: teacherProfile.subject,
    qualification: teacherProfile.qualification,
    experience: teacherProfile.experience,
    joinedDate: teacherProfile.user.createdAt
});

exports.listTeachers = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = {};

        if (status) {
            filter.approvalStatus = status;
        }

        const teachers = await TeacherProfile.find(filter)
            .populate("user")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            teachers: teachers.map(mapTeacher)
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

exports.updateTeacherStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { action, reason } = req.body;

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({
                message: "Invalid action"
            });
        }

        const teacher = await User.findOne({ _id: id, role: "teacher" });

        if (!teacher) {
            return res.status(404).json({
                message: "Teacher not found"
            });
        }

        const teacherProfile = await TeacherProfile.findOne({ user: teacher._id });

        if (!teacherProfile) {
            return res.status(404).json({
                message: "Teacher profile not found"
            });
        }

        teacherProfile.approvalStatus = action === 'approve' ? 'active' : 'inactive';
        teacherProfile.rejectionReason = action === 'reject' ? reason || "" : undefined;

        await teacherProfile.save();

        return res.status(200).json({
            success: true,
            teacher: mapTeacher(teacherProfile)
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

const mapStudent = (student, studentProfile) => ({
    id: student._id,
    name: student.fullName,
    email: student.email,
    role: student.role,
    status: student.status,
    phone: studentProfile?.phone,
    joinedDate: student.createdAt
});

exports.listUsers = async (req, res) => {
    try {
        const students = await User.find({ role: "student" }).sort({ createdAt: -1 });
        const teachers = await TeacherProfile.find({})
            .populate("user")
            .sort({ createdAt: -1 });

        const studentProfiles = await StudentProfile.find({
            user: { $in: students.map((student) => student._id) }
        });
        const studentProfileMap = new Map(
            studentProfiles.map((profile) => [profile.user.toString(), profile])
        );

        return res.status(200).json({
            success: true,
            students: students.map((student) =>
                mapStudent(student, studentProfileMap.get(student._id.toString()))
            ),
            teachers: teachers.map(mapTeacher)
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

exports.updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({
                message: "Invalid status"
            });
        }

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        user.status = status;
        await user.save();

        if (user.role === "teacher") {
            const teacherProfile = await TeacherProfile.findOne({ user: user._id }).populate("user");

            if (!teacherProfile) {
                return res.status(404).json({
                    message: "Teacher profile not found"
                });
            }

            if (status === 'active' && teacherProfile.approvalStatus === 'pending') {
                teacherProfile.approvalStatus = 'active';
            } else if (status === 'inactive') {
                teacherProfile.approvalStatus = 'inactive';
            }

            await teacherProfile.save();

            return res.status(200).json({
                success: true,
                user: mapTeacher(teacherProfile)
            });
        }

        const studentProfile = await StudentProfile.findOne({ user: user._id });

        return res.status(200).json({
            success: true,
            user: mapStudent(user, studentProfile)
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};
