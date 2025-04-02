import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    description: String,
    date: {
        type: Date,
        default: Date.now
    },
    paymentId: String,
    orderId: String,
    previousBalance: Number,
    currentBalance: Number
});

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        default: 0
    },
    transactions: [transactionSchema]
}, {
    timestamps: true
});

export default mongoose.model('Wallet', walletSchema); 