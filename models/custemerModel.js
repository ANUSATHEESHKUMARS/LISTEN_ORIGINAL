const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    mobile: {
        type: String,
        required: false
    },
    address: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Active', 'Blocked'],
        default: 'Active'
    },
    password: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Customer', customerSchema);