const User = require("../models/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
    try {

        const {
            fullName,
            email,
            password,
            role,
            subject,
            qualification,
            experience
        } = req.body;

        if (!fullName || !email || !password || !role) {
            return res.status(400).json({
                message: "Missing required fields"
            });
        }

        if (!['student', 'teacher'].includes(role)) {
            return res.status(400).json({
                message: "Invalid role"
            });
        }

        if (role === 'teacher') {
            if (!subject || !qualification || experience === undefined || experience === null) {
                return res.status(400).json({
                    message: "Missing teacher details"
                });
            }
        }

        const existingUser = await User.findOne({ email });

        if(existingUser){
            return res.status(400).json({
                message: "User already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const normalizedExperience = role === 'teacher'
            ? Number(experience)
            : undefined;

        if (role === 'teacher' && Number.isNaN(normalizedExperience)) {
            return res.status(400).json({
                message: "Invalid experience value"
            });
        }

        const user = await User.create({
            fullName,
            email,
            password: hashedPassword,
            role,
            status: role === 'teacher' ? 'pending' : 'active',
            subject: role === 'teacher' ? subject : undefined,
            qualification: role === 'teacher' ? qualification : undefined,
            experience: role === 'teacher' ? normalizedExperience : undefined
        });

        res.status(201).json({
            success: true,
            message: role === 'teacher'
                ? "Teacher registration submitted for approval"
                : "User created successfully",
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                status: user.status
            }
        });

    } catch(error) {

        res.status(500).json({
            message: error.message
        });

    }
};


exports.login = async (req, res) => {

    try {

        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if(!user){
            return res.status(400).json({
                message: "Invalid email"
            });
        }

        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if(!isMatch){
            return res.status(400).json({
                message: "Invalid password"
            });
        }

        if (user.role === 'teacher' && user.status !== 'active') {
            return res.status(403).json({
                message: user.status === 'pending'
                    ? "Teacher account pending approval"
                    : "Teacher account inactive"
            });
        }

        if (user.status === 'inactive') {
            return res.status(403).json({
                message: "Account inactive"
            });
        }

        const token = jwt.sign(
            {
                id: user._id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN
            }
        );

        res.status(200).json({
            success: true,
            token,
            user: {
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
            }
        });

    } catch(error) {

        res.status(500).json({
            message: error.message
        });

    }
};