import cartSchema from '../../models/cartModels.js';
import addressSchema from '../../models/addressModels.js';
import productSchema from '../../models/productModel.js';
import orderSchema from '../../models/orderModels.js';
import couponSchema from '../../models/couponModel.js';

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
            // size: item.size,
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

        //get address 
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
            discount: discountAmount,
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

        //update product stock
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

        //clear cart and coupon
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


const applyCoupon = async (req, res) => {
    try {
        const { couponCode } = req.body;
        const userId = req.session.user;

        const coupon = await couponSchema.findOne({
            code: couponCode,
            isActive: true,
            expiryDate: { $gt: new Date() }
        });

        if (!coupon) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired coupon'
            });
        }

        // Check if user has already used this coupon
        if (coupon.usedBy && coupon.usedBy.includes(userId)) {
            return res.status(400).json({
                success: false,
                message: 'You have already used this coupon'
            });
        }

        // Get cart total
        const cart = await cartSchema.findOne({ userId })
            .populate({
                path: 'items.productId',
                model: 'Product'
            });

        const cartTotal = cart.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

        // Check minimum purchase requirement
        if (cartTotal < coupon.minPurchase) {
            return res.status(400).json({
                success: false,
                message: `Minimum purchase of ₹${coupon.minPurchase} required to use this coupon`
            });
        }

        // Store coupon in session
        req.session.appliedCoupon = {
            code: coupon.code,
            type: coupon.discountType,
            value: coupon.discountValue,
            maxDiscount: coupon.maxDiscount
        };

        // Calculate discount
        let discountAmount = 0;
        if (coupon.discountType === 'percentage') {
            discountAmount = (cartTotal * coupon.discountValue) / 100;
            if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
                discountAmount = coupon.maxDiscount;
            }
        } else {
            discountAmount = coupon.discountValue;
        }

        return res.json({
            success: true,
            message: 'Coupon applied successfully',
            discount: discountAmount,
            total: cartTotal - discountAmount
        });
    } catch (error) {
        console.error('Apply coupon error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error applying coupon'
        });
    }
};

const removeCoupon = (req, res) => {
    try {
        // Remove coupon from session
        delete req.session.appliedCoupon;

        return res.json({
            success: true,
            message: 'Coupon removed successfully'
        });
    } catch (error) {
        console.error('Remove coupon error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error removing coupon'
        });
    }
};

    

export default {
    getCheckoutPage,
    placeOrder,
    applyCoupon,
    removeCoupon
}