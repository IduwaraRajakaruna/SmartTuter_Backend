const mongoose = require("mongoose");

const studentProfileSchema = new mongoose.Schema(
{
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true
    },

    phone: {
        type: String
    }
    // Enrollment is NOT tracked here.
    // Payment (status: "completed") is the single source of truth for enrollment.
    // To check if a student is enrolled in a class, query Payment by studentId + classId + status.
},
{
    timestamps: true
});

module.exports = mongoose.model("StudentProfile", studentProfileSchema);
