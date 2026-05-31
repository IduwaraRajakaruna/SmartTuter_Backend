const User = require("../models/user.model");
const TeacherProfile = require("../models/teacher-profile.model");
const StudentProfile = require("../models/student-profile.model");

const mapUserProfile = (user, teacherProfile, studentProfile) => ({
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.role === "teacher"
        ? teacherProfile?.approvalStatus
        : user.status,
    subject: teacherProfile?.subject,
    qualification: teacherProfile?.qualification,
    experience: teacherProfile?.experience,
    phone: studentProfile?.phone || teacherProfile?.phone,
    bio: teacherProfile?.bio,
    hourlyRate: teacherProfile?.hourlyRate,
    zoomLink: teacherProfile?.zoomLink,
    joinedDate: user.createdAt
});

exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        let teacherProfile = null;
        let studentProfile = null;

        if (user.role === "teacher") {
            teacherProfile = await TeacherProfile.findOne({ user: user._id });
        } else if (user.role === "student") {
            studentProfile = await StudentProfile.findOne({ user: user._id });
        }

        return res.status(200).json({
            success: true,
            user: mapUserProfile(user, teacherProfile, studentProfile)
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        if (req.body.fullName !== undefined) {
            user.fullName = req.body.fullName;
        }

        if (user.role === "teacher") {
            const teacherProfile = await TeacherProfile.findOne({ user: user._id });

            if (!teacherProfile) {
                return res.status(404).json({
                    message: "Teacher profile not found"
                });
            }

            if (req.body.subject !== undefined) {
                teacherProfile.subject = req.body.subject;
            }

            if (req.body.qualification !== undefined) {
                teacherProfile.qualification = req.body.qualification;
            }

            if (req.body.experience !== undefined) {
                const normalizedExperience = Number(req.body.experience);
                if (Number.isNaN(normalizedExperience)) {
                    return res.status(400).json({
                        message: "Invalid experience value"
                    });
                }
                teacherProfile.experience = normalizedExperience;
            }

            if (req.body.bio !== undefined) {
                teacherProfile.bio = req.body.bio;
            }

            if (req.body.hourlyRate !== undefined) {
                const normalizedRate = Number(req.body.hourlyRate);
                if (Number.isNaN(normalizedRate)) {
                    return res.status(400).json({
                        message: "Invalid hourly rate"
                    });
                }
                teacherProfile.hourlyRate = normalizedRate;
            }

            if (req.body.zoomLink !== undefined) {
                teacherProfile.zoomLink = req.body.zoomLink;
            }

            if (req.body.phone !== undefined) {
                teacherProfile.phone = req.body.phone;
            }

            await teacherProfile.save();
        } else if (user.role === "student") {
            const studentProfile = await StudentProfile.findOne({ user: user._id });

            if (!studentProfile) {
                return res.status(404).json({
                    message: "Student profile not found"
                });
            }

            if (req.body.phone !== undefined) {
                studentProfile.phone = req.body.phone;
            }

            await studentProfile.save();
        }

        await user.save();

        let teacherProfile = null;
        let studentProfile = null;

        if (user.role === "teacher") {
            teacherProfile = await TeacherProfile.findOne({ user: user._id });
        } else if (user.role === "student") {
            studentProfile = await StudentProfile.findOne({ user: user._id });
        }

        return res.status(200).json({
            success: true,
            user: mapUserProfile(user, teacherProfile, studentProfile)
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};
