const User = require("../models/user.model");

const mapUserProfile = (user) => ({
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    subject: user.subject,
    qualification: user.qualification,
    experience: user.experience,
    phone: user.phone,
    bio: user.bio,
    hourlyRate: user.hourlyRate,
    zoomLink: user.zoomLink,
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

        return res.status(200).json({
            success: true,
            user: mapUserProfile(user)
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

        if (req.body.phone !== undefined) {
            user.phone = req.body.phone;
        }

        if (user.role === "teacher") {
            if (req.body.subject !== undefined) {
                user.subject = req.body.subject;
            }

            if (req.body.qualification !== undefined) {
                user.qualification = req.body.qualification;
            }

            if (req.body.experience !== undefined) {
                const normalizedExperience = Number(req.body.experience);
                if (Number.isNaN(normalizedExperience)) {
                    return res.status(400).json({
                        message: "Invalid experience value"
                    });
                }
                user.experience = normalizedExperience;
            }

            if (req.body.bio !== undefined) {
                user.bio = req.body.bio;
            }

            if (req.body.hourlyRate !== undefined) {
                const normalizedRate = Number(req.body.hourlyRate);
                if (Number.isNaN(normalizedRate)) {
                    return res.status(400).json({
                        message: "Invalid hourly rate"
                    });
                }
                user.hourlyRate = normalizedRate;
            }

            if (req.body.zoomLink !== undefined) {
                user.zoomLink = req.body.zoomLink;
            }
        }

        await user.save();

        return res.status(200).json({
            success: true,
            user: mapUserProfile(user)
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};
