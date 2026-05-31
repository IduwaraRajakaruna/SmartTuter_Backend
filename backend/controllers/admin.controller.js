const User = require("../models/user.model");

const mapTeacher = (teacher) => ({
    id: teacher._id,
    name: teacher.fullName,
    email: teacher.email,
    role: teacher.role,
    status: teacher.status,
    subject: teacher.subject,
    qualification: teacher.qualification,
    experience: teacher.experience,
    joinedDate: teacher.createdAt
});

exports.listTeachers = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = { role: "teacher" };

        if (status) {
            filter.status = status;
        }

        const teachers = await User.find(filter).sort({ createdAt: -1 });

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

        teacher.status = action === 'approve' ? 'active' : 'inactive';
        teacher.rejectionReason = action === 'reject' ? reason || "" : undefined;

        await teacher.save();

        return res.status(200).json({
            success: true,
            teacher: mapTeacher(teacher)
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};
