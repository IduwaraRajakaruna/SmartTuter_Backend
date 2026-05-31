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
},
{
    timestamps: true
});

module.exports = mongoose.model("StudentProfile", studentProfileSchema);
