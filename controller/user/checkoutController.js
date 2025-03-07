import cartSchema from '../../models/cartModels.js';
import addressSchema from '../../models/addressModels.js';
import productSchema from '../../models/productModel.js';
import orderSchema from '../../models/orderModels.js';
import couponSchema from '../../models/couponModel.js';
import razorpay from '../../utils/razorpay.js';
import crypto from 'crypto';

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
        //get users addresses
        const addresses = await addressSchema.find({
            userId: req.session.user
        });

        //get cart items with populated product details
        const cart = await cartSchema.findOne({ userId: req.session.user })
            .populate({
                path: 'items.productId',
                model: 'Product',
                select: 'productName  price'
            });

        if (!cart || !cart.items || cart.items.length === 0) {
            return res.redirect('/cart');
        }

        //populate product details and calculate subtotals
        const populatedCart = await cartSchema.findOne({ userId: req.session.user })
            .populate({
                path: 'items.productId',
                model: 'Product',
                select: 'productName imageUrl price stock'
            });


        //check stock availability with detailed logging
        const stockValidationResults = populatedCart.items.map(item => ({
            productName: item.productId.productName,
            requested: item.quantity,
            available: item.productId.stock,
            hasError: item.productId.stock < item.quantity
        }));

        const hasStockError = stockValidationResults.some(item => item.hasError);

        if (hasStockError) {

            // Store the detailed error information in session
            req.session.stockError = stockValidationResults.filter(item => item.hasError);
            return res.redirect('/cart?error=stock');
        }



        //format cart items for the template 
        const cartItems = populatedCart.items.map(item => ({
            product: {
                _id: item.productId._id,
                productName: item.productId.productName,
                imageUrl: item.productId.imageUrl,
            },
            quantity: item.quantity,
            price: item.price,
            subtotal: item.quantity * item.price
        }));

        //calculate total
        const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0);

        res.render('user/checkout', {
            addresses,
            cartItems,
            total,
            user: req.session.user
        });
    } catch (error) {
        console.error('Checkout page error', error);
        res.status(500).render('notFound', {
            message: 'Error loading checkout page',
            user: req.session.user
        });
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

export default {
    getCheckoutPage,
    placeOrder,
    verifyPayment,
    createRazorpayOrder
};