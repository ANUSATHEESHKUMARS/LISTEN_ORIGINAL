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

        if (!amount || amount < 1) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid amount'
            });
        }

        const options = {
            amount: Math.round(amount * 100),
            currency: "INR",
            receipt: `wallet_rcpt_${Date.now()}`,
            payment_capture: 1
        };

        const razorpayOrder = await razorpay.orders.create(options);

        res.status(200).json({
            success: true,
            key: process.env.RAZORPAY_KEY_ID,
            amount: options.amount,
            currency: options.currency,
            order_id: razorpayOrder.id
        });

    } catch (error) {
        console.error('Recharge initiation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to initiate recharge'
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