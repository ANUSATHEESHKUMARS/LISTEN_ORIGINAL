import cartSchema from '../../models/cartModels.js';
import addressSchema from '../../models/addressModels.js';
import productSchema from '../../models/productModel.js';
import orderSchema from '../../models/orderModels.js';
import couponSchema from '../../models/couponModel.js';
import razorpay from '../../utils/razorpay.js';
import crypto from 'crypto';
import wallet from '../../models/walletModels.js';
import Wallet from '../../models/walletModels.js';
import Coupon from '../../models/couponModel.js';


// Function to create Razorpay order
const createRazorpayOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { addressId } = req.body;

        // Get cart and validate
        const cart = await cartSchema.findOne({ userId })
            .populate('items.productId');

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }

        // Calculate total
        const amount = cart.items.reduce((total, item) => {
            return total + (item.quantity * item.price);
        }, 0);

        // Create Razorpay order with proper formatting
        const options = {
            amount: Math.round(amount * 100), // amount in paise
            currency: "INR",
            receipt: `order_rcpt_${Date.now()}`,
            payment_capture: 1
        };

        const razorpayOrder = await razorpay.orders.create(options);

        // Send minimal response
        res.status(200).json({
            success: true,
            key: process.env.RAZORPAY_KEY_ID,
            amount: options.amount,
            currency: options.currency,
            order_id: razorpayOrder.id,
            name: "LISTEN",
            description: "Order Payment",
            prefill: {
                name: req.session.user.firstName + ' ' + req.session.user.lastName,
                email: req.session.user.email,
                contact: req.session.user.phone || ''
            }
        });

    } catch (error) {
        console.error('Razorpay order creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Payment initiation failed'
        });
    }
};
const getCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user;

        // Get user's addresses and cart items in parallel
        const [addresses, cart] = await Promise.all([
            addressSchema.find({ userId }),
            cartSchema.findOne({ userId }).populate({
                path: 'items.productId',
                model: 'Product',
                select: 'productName imageUrl price stock'
            })
        ]);

        // Check if cart exists and has items
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.redirect('/cart');
        }

        // Format cart items and check stock
        const cartItems = cart.items.map(item => ({
            product: {
                _id: item.productId._id,
                productName: item.productId.productName,
                imageUrl: item.productId.imageUrl,
            },
            quantity: item.quantity,
            price: item.price,
            subtotal: item.quantity * item.price
        }));

        // Calculate total
        const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0);

        // Get wallet balance
        const userWallet = await wallet.findOne({ userId }) || { balance: 0 };

        // Render checkout page
        return res.render('user/checkout', {
            addresses,
            cartItems,
            total,
            user: req.session.user,
            wallet: userWallet
        });

    } catch (error) {
        console.error('Checkout page error:', error);
        // Redirect to cart with error instead of showing notFound page
        return res.redirect('/cart?error=Something went wrong. Please try again.');
    }
};
const verifyPayment = async (req, res) => {
    try {
        const userId = req.session.user;
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            addressId  // Make sure this is passed from the frontend
        } = req.body;

        // Verify signature
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature !== expectedSign) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment signature'
            });
        }

        // Get cart and address details
        const [cart, address] = await Promise.all([
            cartSchema.findOne({ userId }).populate('items.productId'),
            addressSchema.findOne({ _id: addressId, userId })
        ]);

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }

        if (!address) {
            return res.status(400).json({
                success: false,
                message: 'Delivery address not found'
            });
        }

        // Create order items
        const orderItems = cart.items.map(item => ({
            product: item.productId._id,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.quantity * item.price,
            order: {
                status: 'processing',
                statusHistory: [{
                    status: 'processing',
                    date: new Date(),
                    comment: 'Payment completed successfully'
                }]
            }
        }));

        // Calculate totals
        const subtotal = cart.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

        // Create the order with shipping address
        const order = await orderSchema.create({
            userId,
            items: orderItems,
            subtotal: subtotal,
            totalAmount: subtotal,
            shippingAddress: {
                fullName: address.fullName,
                mobileNumber: address.mobileNumber,
                addressLine1: address.addressLine1,
                addressLine2: address.addressLine2,
                city: address.city,
                state: address.state,
                pincode: address.pincode
            },
            payment: {
                method: 'razorpay',
                paymentStatus: 'completed',
                razorpayTransaction: {
                    orderId: razorpay_order_id,
                    paymentId: razorpay_payment_id,
                    signature: razorpay_signature
                }
            }
        });

        // Update product stock
        for (const item of cart.items) {
            await productSchema.findByIdAndUpdate(
                item.productId._id,
                { $inc: { stock: -item.quantity } }
            );
        }

        // Clear cart
        await cartSchema.findByIdAndUpdate(cart._id, {
            items: [],
            totalAmount: 0
        });

        // Clear any pending order data from session
        if (req.session.pendingOrder) {
            delete req.session.pendingOrder;
        }

        res.status(200).json({
            success: true,
            message: 'Payment verified successfully',
            orderId: order._id
        });

    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying payment'
        });
    }
};
// Function to place the order
const placeOrder = async (req, res) => {
    try {
        const { addressId, paymentMethod } = req.body;
        const userId = req.session.user;
        const appliedCoupon = req.session.appliedCoupon;

        // Validate inputs
        if (!addressId || !paymentMethod) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Get cart and validate
        const cart = await cartSchema.findOne({ userId })
            .populate({
                path: 'items.productId',
                model: 'Product',
                select: 'productName price'
            });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }

        // Calculate the total amount
        const subtotal = cart.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        
        // Apply discount if coupon is used
        let discountAmount = 0;
        let couponCode = null;
        
        if (appliedCoupon) {
            couponCode = appliedCoupon.code;
            if (appliedCoupon.type === 'percentage') {
                discountAmount = (subtotal * appliedCoupon.value) / 100;
                if (appliedCoupon.maxDiscount && discountAmount > appliedCoupon.maxDiscount) {
                    discountAmount = appliedCoupon.maxDiscount;
                }
            } else {
                discountAmount = appliedCoupon.value;
            }
            
            // Update coupon usage
            await couponSchema.findOneAndUpdate(
                { code: couponCode },
                { $addToSet: { usedBy: userId } }
            );
        }
        
        const finalAmount = subtotal - discountAmount;
        
        // Validate COD payment method
        if (paymentMethod === 'cod' && finalAmount > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Cash on Delivery is not available for orders above ₹1000. Please choose a different payment method.'
            });
        }

        const orderItems = cart.items.map(item => ({
            product: item.productId._id,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.quantity * item.price,
            order: {
                status: paymentMethod === 'cod' ? 'processing' : 'pending',
                statusHistory: [{
                    status: paymentMethod === 'cod' ? 'processing' : 'pending',
                    date: new Date(),
                    comment: paymentMethod === 'cod' ?
                        'Order confirmed with cash on delivery' :
                        'Order placed, awaiting payment'
                }]
            },
            return: {
                isReturnRequested: false,
                reason: null,
                requestDate: null,
                status: null,
                adminComment: null,
                isReturnAccepted: false
            }
        }));

        // Get address 
        const address = await addressSchema.findOne({
            _id: addressId,
            userId
        });

        if (!address) {
            return res.status(400).json({
                success: false,
                message: 'Delivery address not found'
            });
        }

        const order = await orderSchema.create({
            userId,
            items: orderItems,
            subtotal: subtotal,
            discount: discountAmount, // Include the discount field
            couponCode: couponCode,
            totalAmount: finalAmount,
            shippingAddress: {
                fullName: address.fullName,
                mobileNumber: address.mobileNumber,
                addressLine1: address.addressLine1,
                addressLine2: address.addressLine2,
                city: address.city,
                state: address.state,
                pincode: address.pincode
            },
            payment: {
                method: paymentMethod,
                paymentStatus: paymentMethod === 'cod' ? 'processing' : 'completed'
            }
        });

        // Update product stock
        for (const item of orderItems) {
            await productSchema.findOneAndUpdate(
                {
                    _id: item.product,
                    'size.size': item.size
                },
                {
                    $inc: {
                        'size.$.stock': -item.quantity
                    }
                }
            );
        }

        // Clear cart and coupon
        await cartSchema.findByIdAndUpdate(cart._id, {
            items: [],
            totalAmount: 0
        });
        
        // Clear applied coupon from session
        delete req.session.appliedCoupon;

        res.json({
            success: true,
            message: 'Order placed successfully',
            orderId: order.orderCode
        });

    } catch (error) {
        console.error('Place order error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error placing order'
        });
    }
};
const walletPayment = async (req, res) => {
    try {
        const userId = req.session.user;
        const { addressId, couponCode } = req.body;

        // Get cart and validate
        const cart = await cartSchema.findOne({ userId })
            .populate('items.productId');

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }

        // Calculate cart total
        const cartTotal = cart.items.reduce(
            (sum, item) => sum + (item.quantity * item.price), 
            0
        );
        
        // Apply coupon discount if available
        let couponDiscount = 0;
        let appliedCoupon = null;
        if (couponCode) {
            appliedCoupon = await Coupon.findOne({ code: couponCode });
            if (appliedCoupon) {
                couponDiscount = (cartTotal * appliedCoupon.discountPercentage) / 100;
                if (appliedCoupon.maximumDiscount) {
                    couponDiscount = Math.min(couponDiscount, appliedCoupon.maximumDiscount);
                }
            }
        }

        // Calculate final amount
        const finalAmount = cartTotal - couponDiscount;

        // Get wallet and check balance
        const userWallet = await Wallet.findOne({ userId });
        if (!userWallet || userWallet.balance < finalAmount) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient wallet balance'
            });
        }

        // Get address details
        const address = await addressSchema.findOne({
            _id: addressId,
            userId
        });

        if (!address) {
            return res.status(400).json({
                success: false,
                message: 'Delivery address not found'
            });
        }

        // Create order items
        const orderItems = cart.items.map(item => ({
            product: item.productId._id,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.quantity * item.price,
            order: {
                status: 'processing',
                statusHistory: [{
                    status: 'processing',
                    date: new Date(),
                    comment: 'Order placed using wallet payment'
                }]
            },
            return: {
                isReturnRequested: false,
                reason: null,
                requestDate: null,
                status: null,
                adminComment: null,
                isReturnAccepted: false
            }
        }));

        // Create order
        const order = await orderSchema.create({
            userId,
            items: orderItems,
            subtotal: cartTotal,
            discount: couponDiscount,
            totalAmount: finalAmount,
            couponCode: couponCode,
            shippingAddress: {
                fullName: address.fullName,
                mobileNumber: address.mobileNumber,
                addressLine1: address.addressLine1,
                addressLine2: address.addressLine2,
                city: address.city,
                state: address.state,
                pincode: address.pincode
            },
            payment: {
                method: 'wallet',
                paymentStatus: 'completed',
                walletTransaction: {
                    amount: finalAmount
                }
            }
        });

        // Update product stock
        for (const item of cart.items) {
            await productSchema.findByIdAndUpdate(
                item.productId._id,
                { $inc: { stock: -item.quantity } }
            );
        }

        // Update wallet balance and add transaction
        const walletTransaction = {
            type: 'debit',
            amount: finalAmount,
            description: `Payment for order #${order._id}`,
            orderId: order._id,
            date: new Date()
        };

        userWallet.balance -= finalAmount;
        userWallet.transactions.push(walletTransaction);
        await userWallet.save();

        // Clear cart
        await cartSchema.findByIdAndUpdate(cart._id, {
            items: [],
            totalAmount: 0
        });

        // Update coupon usage if applicable
        if (appliedCoupon) {
            await Coupon.findOneAndUpdate(
                { code: couponCode },
                {
                    $inc: { usedCouponCount: 1 },
                    $push: {
                        usedBy: {
                            userId,
                            orderId: order._id
                        }
                    }
                }
            );
        }

        res.json({
            success: true,
            message: 'Order placed successfully',
            orderId: order._id
        });

    } catch (error) {
        console.error('Wallet payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing wallet payment'
        });
    }
};
const getAvailableCoupons = async (req, res) => {
    try {
        const userId = req.session.user;

        // Get active coupons within valid date range
        const coupons = await Coupon.find({
            isActive: true,
            startDate: { $lte: new Date() },
            expiryDate: { $gte: new Date() }
        });

        // Get user's cart total
        const cart = await cartSchema.findOne({ userId })
            .populate('items.productId');

        if (!cart) {
            return res.status(400).json({
                success: false,
                message: 'Cart not found'
            });
        }

        const cartTotal = cart.items.reduce(
            (sum, item) => sum + (item.quantity * item.price), 
            0
        );

        // Process coupons with validation info
        const processedCoupons = await Promise.all(coupons.map(async (coupon) => {
            // Check user's usage count for this coupon
            const userUsageCount = await Coupon.countDocuments({
                code: coupon.code,
                'usedBy.userId': userId
            });

            // Check if coupon is applicable
            const isApplicable = 
                cartTotal >= coupon.minimumPurchase &&
                (!coupon.totalCoupon || coupon.usedCouponCount < coupon.totalCoupon) &&
                userUsageCount < coupon.userUsageLimit;

            return {
                code: coupon.code,
                description: coupon.description,
                discountPercentage: coupon.discountPercentage,
                minimumPurchase: coupon.minimumPurchase,
                maximumDiscount: coupon.maximumDiscount,
                expiryDate: coupon.expiryDate,
                totalCoupon: coupon.totalCoupon,
                usedCouponCount: coupon.usedCouponCount,
                userUsageLimit: coupon.userUsageLimit,
                isApplicable
            };
        }));

        res.json({
            success: true,
            coupons: processedCoupons
        });

    } catch (error) {
        console.error('Get available coupons error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching coupons'
        });
    }
};
const applyCoupon = async (req, res, next) => {
    try {
        const { code } = req.body;
        const userId = req.session.user;

        //find the coupon
        const coupon = await Coupon.findOne({
            code: code.toUpperCase(),
            isActive: true,
            startDate: { $lte: new Date() },
            expiryDate: { $gte: new Date() }
        });

        if (!coupon) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired coupon'
            });
        }

        // Check total coupon usage limit first
        if (coupon.totalCoupon !== null) {
            if (coupon.usedCouponCount >= coupon.totalCoupon) {
                return res.status(400).json({
                    success: false,
                    message: 'Coupon limit has been exceeded. This coupon is no longer available.'
                });
            }
        }

        // Check individual user usage limit
        const userUsageCount = coupon.usedBy.filter(
            usage => usage.userId.toString() === userId.toString()
        ).length;

        if (userUsageCount >= coupon.userUsageLimit) {
            return res.status(400).json({
                success: false,
                message: `You have exceeded the usage limit (${coupon.userUsageLimit}) for this coupon`
            });
        }

        //get cart total 
        const cart = await cartSchema.findOne({ userId })
            .populate('items.productId');

        const cartTotal = cart.items.reduce(
            (sum, item) => sum + (item.quantity * item.price),
            0
        );

        //check minimum purchase required
        if (cartTotal < coupon.minimumPurchase) {
            return res.status(400).json({
                success: false,
                message: `Minimum purchase of ₹${coupon.minimumPurchase} required`
            });
        }

        //calculate discount 
        let discount = (cartTotal * coupon.discountPercentage) / 100;
        if (coupon.maximumDiscount) {
            discount = Math.min(discount, coupon.maximumDiscount);
        }

        res.json({
            success: true,
            discount,
            couponCode: coupon.code,
            message: 'Coupon applied successfully'
        });

    } catch (error) {
        next(error)
    }
};
const removeCoupon = async (req, res, next) => {
    try {
        res.json({
            success: true,
            message: 'Coupon removed successfully'
        });
    } catch (error) {
        next(error)
    }
}
const getOrderSuccessPage = async (req, res) => {
    try {
        const { orderId } = req.query;
        
        if (!orderId) {
            return res.redirect('/orders');
        }
        
        const order = await orderSchema.findOne({
            orderCode: orderId,
            userId: req.session.user
        });
        
        if (!order) {
            return res.redirect('/orders');
        }
        
        const user = await userSchema.findById(req.session.user);
        
        res.render('user/orderSuccess', {
            orderId: order.orderCode,
            userEmail: user.email,
            user: req.session.user
        });
    } catch (error) {
        console.error('Order success page error:', error);
        res.redirect('/orders');
    }
};


export default {
    getCheckoutPage,
    placeOrder,
    verifyPayment,
    createRazorpayOrder,
    walletPayment,
    getAvailableCoupons,
    getOrderSuccessPage,
    removeCoupon,
    applyCoupon


};