import Wallet from "../../models/walletModels.js"
import userSchema from "../../models/userModels.js"
import razorpay from "../../utils/razorpay.js"
import crypto from 'crypto';

const getWallet = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await userSchema.findById(userId);

        //find or create wallet
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = await Wallet.create({ userId });

        }

        // get recent transactions 
        const transactions = wallet.transactions.sort((a, b) => b.date - a.date);


        res.render('user/wallet', {
            wallet,
            transactions,
            user
        });
    } catch (error) {
        console.error('Get wallet error', error);
        res.status(500).json({
            message: 'Error feteching wallet details',
            user: req.session.user
        });

    }
};

const initiateRecharge = async (req, res) => {
    try {
        const { amount } = req.body;
        const userId = req.session.user;

        // Validate amount
        const rechargeAmount = parseFloat(amount);
        if (isNaN(rechargeAmount) || rechargeAmount < 1) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid amount (minimum ₹1)'
            });
        }

        // Create shorter receipt ID (max 40 chars)
        const timestamp = Date.now().toString().slice(-8); // Last 8 digits of timestamp
        const shortUserId = userId.toString().slice(-6); // Last 6 digits of userId
        const receipt = `w${shortUserId}${timestamp}`; // Format: w{userId}{timestamp}

        // Create Razorpay order
        const options = {
            amount: Math.round(rechargeAmount * 100), // Convert to paise
            currency: "INR",
            receipt: receipt, // Shortened receipt
            payment_capture: 1,
            notes: {
                userId: userId,
                type: 'wallet_recharge'
            }
        };

        const razorpayOrder = await razorpay.orders.create(options);

        res.status(200).json({
            success: true,
            key: process.env.RAZORPAY_KEY_ID,
            amount: options.amount,
            currency: options.currency,
            order_id: razorpayOrder.id,
            receipt: options.receipt
        });

    } catch (error) {
        console.error('Recharge initiation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to initiate recharge. Please try again.'
        });
    }
};

const verifyRecharge = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature !== expectedSign) {
            return res.status(400).json({
                success: false,
                message: 'Invalid signature'
            });
        }

        const order = await razorpay.orders.fetch(razorpay_order_id);
        const amountInRupees = order.amount / 100;

        const userId = req.session.user;
        const wallet = await Wallet.findOne({ userId });

        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: 'Wallet not found'
            });
        }

        // Add transaction and update balance
        wallet.balance += amountInRupees;
        wallet.transactions.push({
            type: 'credit',
            amount: amountInRupees,
            description: 'Wallet recharge',
            date: new Date(),
            paymentId: razorpay_payment_id
        });

        await wallet.save();

        res.json({
            success: true,
            message: 'Recharge successful'
        });

    } catch (error) {
        console.error('Recharge verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify recharge'
        });
    }
};

export default{
    getWallet,
    initiateRecharge,
    verifyRecharge
}