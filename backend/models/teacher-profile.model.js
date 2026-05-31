const mongoose = require("mongoose");

const teacherProfileSchema = new mongoose.Schema(
{
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true
    },

    subject: {
        type: String,
        required: true
    },

    qualification: {
        type: String,
        required: true
    },

    experience: {
        type: Number,
        required: true
    },

    phone: {
        type: String
    },

    bio: {
        type: String
    },

    hourlyRate: {
        type: Number
    },

    zoomLink: {
        type: String
    },

    approvalStatus: {
        type: String,
        enum: ["pending", "active", "inactive"],
        default: "pending"
    },

    rejectionReason: {
        type: String
    }
},
{
    timestamps: true
});

module.exports = mongoose.model("TeacherProfile", teacherProfileSchema);
