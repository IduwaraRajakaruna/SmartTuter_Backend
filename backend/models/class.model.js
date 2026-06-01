const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
{
    title: {
        type: String,
        required: true
    },

    subject: {
        type: String
    },

    description: {
        type: String
    },

    price: {
        type: Number,
        required: true
    },

    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    capacity: {
        type: Number
    },

    studentsEnrolled: {
        type: Number,
        default: 0
    },

    schedule: {
        type: mongoose.Schema.Types.Mixed
    }
},
{
    timestamps: true
});

module.exports = mongoose.model('Class', classSchema);