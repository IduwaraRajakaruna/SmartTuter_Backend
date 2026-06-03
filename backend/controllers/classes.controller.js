const Class = require('../models/class.model');

const buildClassPayload = (classDoc) => ({
    id: classDoc._id,
    title: classDoc.title,
    subject: classDoc.subject,
    description: classDoc.description,
    price: classDoc.price,
    teacherId: classDoc.teacherId,
    capacity: classDoc.capacity,
    studentsEnrolled: classDoc.studentsEnrolled,
    schedule: classDoc.schedule,
    createdAt: classDoc.createdAt,
    updatedAt: classDoc.updatedAt,
});

exports.getAllClasses = async (req, res) => {
    try {
        const classes = await Class.find({}).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            classes: classes.map(buildClassPayload)
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

exports.getClassById = async (req, res) => {
    try {
        const { id } = req.params;

        const classDoc = await Class.findById(id);

        if (!classDoc) {
            return res.status(404).json({
                message: 'Class not found'
            });
        }

        return res.status(200).json({
            success: true,
            class: buildClassPayload(classDoc)
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

exports.createClass = async (req, res) => {
    try {
        const {
            title,
            subject,
            description,
            price,
            teacherId,
            capacity,
            schedule,
        } = req.body;

        if (!title || price === undefined || price === null) {
            return res.status(400).json({
                message: 'title and price are required'
            });
        }

        const ownerTeacherId = req.user?.role === 'admin'
            ? (teacherId || req.user.id)
            : req.user?.id;

        const classDoc = await Class.create({
            title,
            subject,
            description,
            price,
            teacherId: ownerTeacherId,
            capacity,
            studentsEnrolled: 0,
            schedule,
        });

        return res.status(201).json({
            success: true,
            class: buildClassPayload(classDoc)
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

exports.updateClass = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            subject,
            description,
            price,
            teacherId,
            capacity,
            studentsEnrolled,
            schedule,
        } = req.body;

        const classDoc = await Class.findById(id);

        if (!classDoc) {
            return res.status(404).json({
                message: 'Class not found'
            });
        }

        const isOwner = req.user?.role === 'teacher' && classDoc.teacherId?.toString() === req.user.id;
        const isAdmin = req.user?.role === 'admin';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        if (title !== undefined) classDoc.title = title;
        if (subject !== undefined) classDoc.subject = subject;
        if (description !== undefined) classDoc.description = description;
        if (price !== undefined) classDoc.price = price;
        if (capacity !== undefined) classDoc.capacity = capacity;
        if (studentsEnrolled !== undefined) classDoc.studentsEnrolled = studentsEnrolled;
        if (schedule !== undefined) classDoc.schedule = schedule;

        if (isAdmin && teacherId !== undefined) {
            classDoc.teacherId = teacherId;
        }

        await classDoc.save();

        return res.status(200).json({
            success: true,
            class: buildClassPayload(classDoc)
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

exports.deleteClass = async (req, res) => {
    try {
        const { id } = req.params;

        const classDoc = await Class.findById(id);

        if (!classDoc) {
            return res.status(404).json({
                message: 'Class not found'
            });
        }

        const isOwner = req.user?.role === 'teacher' && classDoc.teacherId?.toString() === req.user.id;
        const isAdmin = req.user?.role === 'admin';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        await classDoc.deleteOne();

        return res.status(200).json({
            success: true,
            message: 'Class deleted successfully'
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};