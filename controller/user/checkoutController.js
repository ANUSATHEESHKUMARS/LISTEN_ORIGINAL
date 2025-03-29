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
import Offer from '../../models/offerModel.js';


// Function to create Razorpay order
const createRazorpayOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { addressId } = req.body;

        // Get cart with offers
        const cart = await cartSchema.findOne({ userId })
            .populate({
                path: 'items.productId',
                populate: {
                    path: 'categoriesId'
                }
            });

        // Get active offers and calculate discounted prices
        const activeOffers = await Offer.find({
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
            status: 'active'
        }).populate('categoryId productIds');

        // Create offer maps
        const productOfferMap = new Map();
        const categoryOfferMap = new Map();

        activeOffers.forEach(offer => {
            if (offer.productIds?.length > 0) {
                offer.productIds.forEach(pid => {
                    const productIdStr = pid.toString();
                    if (!productOfferMap.has(productIdStr) ||
                        productOfferMap.get(productIdStr).discount < offer.discount) {
                        productOfferMap.set(productIdStr, offer);
                    }
                });
            } else if (offer.categoryId) {
                const categoryIdStr = offer.categoryId._id.toString();
                if (!categoryOfferMap.has(categoryIdStr) ||
                    categoryOfferMap.get(categoryIdStr).discount < offer.discount) {
                    categoryOfferMap.set(categoryIdStr, offer);
                }
            }
        });

        // Calculate total with offers
        let amount = cart.items.reduce((total, item) => {
            const product = item.productId;
            const productOffer = productOfferMap.get(product._id.toString());
            const categoryOffer = product.categoriesId ?
                categoryOfferMap.get(product.categoriesId._id.toString()) : null;

            let bestDiscount = 0;
            if (productOffer) bestDiscount = productOffer.discount;
            if (categoryOffer && categoryOffer.discount > bestDiscount) {
                bestDiscount = categoryOffer.discount;
            }

            const discountedPrice = bestDiscount > 0 
                ? Math.round(item.price * (1 - bestDiscount / 100))
                : item.price;

            return total + (item.quantity * discountedPrice);
        }, 0);

        // Apply coupon discount if available
        if (req.session.coupon) {
            amount = amount - req.session.coupon.discount;
        }

        // Create Razorpay order
        const options = {
            amount: Math.round(amount * 100), // amount in paise
            currency: "INR",
            receipt: `order_rcpt_${Date.now()}`,
            payment_capture: 1
        };

        const razorpayOrder = await razorpay.orders.create(options);

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

        // Get active offers
        const activeOffers = await Offer.find({
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
            status: 'active'
        }).populate('categoryId productIds');

        // Create maps for offers
        const productOfferMap = new Map();
        const categoryOfferMap = new Map();

        activeOffers.forEach(offer => {
            if (offer.productIds && offer.productIds.length > 0) {
                offer.productIds.forEach(productId => {
                    const productIdStr = productId.toString();
                    if (!productOfferMap.has(productIdStr) ||
                        productOfferMap.get(productIdStr).discount < offer.discount) {
                        productOfferMap.set(productIdStr, offer);
                    }
                });
            } else if (offer.categoryId) {
                const categoryIdStr = offer.categoryId._id.toString();
                if (!categoryOfferMap.has(categoryIdStr) ||
                    categoryOfferMap.get(categoryIdStr).discount < offer.discount) {
                    categoryOfferMap.set(categoryIdStr, offer);
                }
            }
        });

        // Get user's addresses and cart items
        const [addresses, cart] = await Promise.all([
            addressSchema.find({ userId }),
            cartSchema.findOne({ userId }).populate({
                path: 'items.productId',
                populate: {
                    path: 'categoriesId'
                }
            })
        ]);

        if (!cart || !cart.items || cart.items.length === 0) {
            return res.redirect('/cart');
        }

        // Process cart items with offers
        const processedItems = cart.items.map(item => {
            const product = item.productId;
            const quantity = item.quantity;

            // Get product-specific offer
            const productOffer = productOfferMap.get(product._id.toString());
            
            // Get category offer
            const categoryOffer = product.categoriesId ?
                categoryOfferMap.get(product.categoriesId._id.toString()) : null;

            // Calculate best discount
            let bestDiscount = 0;
            let appliedOffer = null;

            if (productOffer) {
                bestDiscount = productOffer.discount;
                appliedOffer = productOffer;
            }
            if (categoryOffer && categoryOffer.discount > bestDiscount) {
                bestDiscount = categoryOffer.discount;
                appliedOffer = categoryOffer;
            }

            // Calculate prices
            const originalPrice = product.price;
            const discountedPrice = bestDiscount > 0 
                ? Math.round(originalPrice * (1 - bestDiscount / 100))
                : originalPrice;
            const subtotal = discountedPrice * quantity;

            return {
                product: {
                    _id: product._id,
                    productName: product.productName,
                    imageUrl: product.imageUrl,
                    stock: product.stock
                },
                quantity: quantity,
                price: originalPrice,
                discountPrice: discountedPrice,
                subtotal: subtotal,
                offerApplied: bestDiscount > 0,
                discountPercentage: bestDiscount,
                appliedOffer: appliedOffer
            };
        });

        // Calculate totals
        const subtotal = processedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const offerDiscount = processedItems.reduce((sum, item) => {
            return sum + ((item.price - item.discountPrice) * item.quantity);
        }, 0);
        const total = subtotal - offerDiscount;

        // Get wallet balance
        const userWallet = await wallet.findOne({ userId }) || { balance: 0 };

        // Get any previously applied coupon from session
        const couponDiscount = req.session.coupon ? req.session.coupon.discount : 0;
        const finalTotal = total - couponDiscount;

        res.render('user/checkout', {
            cartItems: processedItems,
            addresses,
            wallet: userWallet,
            subtotal,
            offerDiscount,
            total,
            couponDiscount,
            finalTotal,
            user: req.session.user
        });

    } catch (error) {
        console.error('Checkout page error:', error);
        res.redirect('/cart?error=Something went wrong. Please try again.');
    }
};
const verifyPayment = async (req, res) => {
    try {
        const userId = req.session.user;
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            addressId
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

            // Get cart with offers
        const cart = await cartSchema.findOne({ userId })
            .populate({
                path: 'items.productId',
                populate: {
                    path: 'categoriesId'
                }
            });

        // Get active offers
        const activeOffers = await Offer.find({
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
            status: 'active'
        }).populate('categoryId productIds');

        // Create offer maps
        const productOfferMap = new Map();
        const categoryOfferMap = new Map();

        activeOffers.forEach(offer => {
            if (offer.productIds?.length > 0) {
                offer.productIds.forEach(pid => {
                    const productIdStr = pid.toString();
                    if (!productOfferMap.has(productIdStr) ||
                        productOfferMap.get(productIdStr).discount < offer.discount) {
                        productOfferMap.set(productIdStr, offer);
                    }
                });
            } else if (offer.categoryId) {
                const categoryIdStr = offer.categoryId._id.toString();
                if (!categoryOfferMap.has(categoryIdStr) ||
                    categoryOfferMap.get(categoryIdStr).discount < offer.discount) {
                    categoryOfferMap.set(categoryIdStr, offer);
                }
            }
        });

        // Calculate totals with offers
        let subtotal = 0;
        const orderItems = cart.items.map(item => {
            const product = item.productId;
            const productOffer = productOfferMap.get(product._id.toString());
            const categoryOffer = product.categoriesId ?
                categoryOfferMap.get(product.categoriesId._id.toString()) : null;

            let bestDiscount = 0;
            if (productOffer) bestDiscount = productOffer.discount;
            if (categoryOffer && categoryOffer.discount > bestDiscount) {
                bestDiscount = categoryOffer.discount;
            }

            const originalPrice = item.price;
            const discountedPrice = bestDiscount > 0 
                ? Math.round(originalPrice * (1 - bestDiscount / 100))
                : originalPrice;
            const itemSubtotal = discountedPrice * item.quantity;
            subtotal += itemSubtotal;

            return {
                product: product._id,
                quantity: item.quantity,
                price: originalPrice,
                discountedPrice: discountedPrice,
                subtotal: itemSubtotal,
                order: {
                    status: 'processing',
                    statusHistory: [{
                        status: 'processing',
                        date: new Date(),
                        comment: 'Payment completed successfully'
                    }]
                }
            };
        });

        // Apply coupon discount if available
        let couponDiscount = 0;
        let couponCode = null;
        if (req.session.coupon) {
            couponDiscount = req.session.coupon.discount;
            couponCode = req.session.coupon.code;
        }

        const finalAmount = subtotal - couponDiscount;

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

        // Create order with discounted prices
        const order = await orderSchema.create({
            userId,
            items: orderItems,
            subtotal: subtotal,
            discount: couponDiscount,
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
        for (const item of orderItems) {
            try {
                const product = await productSchema.findById(item.product);
                if (!product) {
                    console.error(`Product not found: ${item.product}`);
                    continue;
                }

                // Check if there's enough stock
                if (product.stock < item.quantity) {
                    throw new Error(`Insufficient stock for product: ${product.productName}`);
                }

                // Update stock
                product.stock = product.stock - item.quantity;
                await product.save();

                console.log(`Stock updated for product ${item.product}: ${product.stock}`);
            } catch (error) {
                console.error(`Error updating stock for product ${item.product}:`, error);
                throw error;
            }
        }

        // Clear cart and coupon
        await cartSchema.findByIdAndUpdate(cart._id, {
            items: [],
            totalAmount: 0
        });
        delete req.session.coupon;

        res.status(200).json({
            success: true,
            message: 'Payment verified successfully',
            orderId: order._id,
            amount: finalAmount
        });

    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error verifying payment'
        });
    }
};
// Function to place the order
const placeOrder = async (req, res) => {
    try {
        const { addressId, paymentMethod } = req.body;
        const userId = req.session.user;
        
        // Get cart with offers
        const cart = await cartSchema.findOne({ userId })
            .populate({
                path: 'items.productId',
                populate: {
                    path: 'categoriesId'
                }
            });

        // Get active offers
        const activeOffers = await Offer.find({
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
            status: 'active'
        }).populate('categoryId productIds');

        // Create offer maps
        const productOfferMap = new Map();
        const categoryOfferMap = new Map();

        activeOffers.forEach(offer => {
            if (offer.productIds?.length > 0) {
                offer.productIds.forEach(pid => {
                    const productIdStr = pid.toString();
                    if (!productOfferMap.has(productIdStr) ||
                        productOfferMap.get(productIdStr).discount < offer.discount) {
                        productOfferMap.set(productIdStr, offer);
                    }
                });
            } else if (offer.categoryId) {
                const categoryIdStr = offer.categoryId._id.toString();
                if (!categoryOfferMap.has(categoryIdStr) ||
                    categoryOfferMap.get(categoryIdStr).discount < offer.discount) {
                    categoryOfferMap.set(categoryIdStr, offer);
                }
            }
        });

        // Calculate totals with offers
        let subtotal = 0;
        const orderItems = cart.items.map(item => {
            const product = item.productId;
            const productOffer = productOfferMap.get(product._id.toString());
            const categoryOffer = product.categoriesId ?
                categoryOfferMap.get(product.categoriesId._id.toString()) : null;

            let bestDiscount = 0;
            if (productOffer) bestDiscount = productOffer.discount;
            if (categoryOffer && categoryOffer.discount > bestDiscount) {
                bestDiscount = categoryOffer.discount;
            }

            const originalPrice = item.price;
            const discountedPrice = bestDiscount > 0 
                ? Math.round(originalPrice * (1 - bestDiscount / 100))
                : originalPrice;
            const itemSubtotal = discountedPrice * item.quantity;
            subtotal += itemSubtotal;

            return {
                product: product._id,
                quantity: item.quantity,
                price: originalPrice,
                discountedPrice: discountedPrice,
                subtotal: itemSubtotal,
                order: {
                    status: paymentMethod === 'cod' ? 'processing' : 'pending',
                    statusHistory: [{
                        status: paymentMethod === 'cod' ? 'processing' : 'pending',
                        date: new Date(),
                        comment: paymentMethod === 'cod' ?
                            'Order confirmed with cash on delivery' :
                            'Order placed, awaiting payment'
                    }]
                }
            };
        });

        // Apply coupon discount if available
        let couponDiscount = 0;
        let couponCode = null;
        if (req.session.coupon) {
            couponDiscount = req.session.coupon.discount;
            couponCode = req.session.coupon.code;
        }

        const finalAmount = subtotal - couponDiscount;

        // Validate COD payment method
        if (paymentMethod === 'cod' && finalAmount > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Cash on Delivery is not available for orders above ₹1000'
            });
        }

        // Create order
        const order = await orderSchema.create({
            userId,
            items: orderItems,
            subtotal: subtotal,
            discount: couponDiscount,
            couponCode: couponCode,
            totalAmount: finalAmount,
            shippingAddress: {
                fullName: addressId.fullName,
                mobileNumber: addressId.mobileNumber,
                addressLine1: addressId.addressLine1,
                addressLine2: addressId.addressLine2,
                city: addressId.city,
                state: addressId.state,
                pincode: addressId.pincode
            },
            payment: {
                method: paymentMethod,
                paymentStatus: paymentMethod === 'cod' ? 'processing' : 'completed'
            }
        });

        // Update product stock
        for (const item of orderItems) {
            try {
                const product = await productSchema.findById(item.product);
                if (!product) {
                    console.error(`Product not found: ${item.product}`);
                    continue;
                }

                // Check if there's enough stock
                if (product.stock < item.quantity) {
                    throw new Error(`Insufficient stock for product: ${product.productName}`);
                }

                // Update stock
                product.stock = product.stock - item.quantity;
                await product.save();

                console.log(`Stock updated for product ${item.product}: ${product.stock}`);
            } catch (error) {
                console.error(`Error updating stock for product ${item.product}:`, error);
                throw error;
            }
        }

        // Clear cart and coupon
        await cartSchema.findByIdAndUpdate(cart._id, {
            items: [],
            totalAmount: 0
        });
        
        delete req.session.appliedCoupon;

        res.json({
            success: true,
            message: 'Order placed successfully',
            orderId: order._id,
            redirectUrl: `/order-success?orderId=${order._id}`
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
            .populate({
                path: 'items.productId',
                populate: {
                    path: 'categoriesId'
                }
            });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }

        // Get active offers
        const activeOffers = await Offer.find({
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
            status: 'active'
        }).populate('categoryId productIds');

        // Create offer maps
        const productOfferMap = new Map();
        const categoryOfferMap = new Map();

        activeOffers.forEach(offer => {
            if (offer.productIds?.length > 0) {
                offer.productIds.forEach(pid => {
                    const productIdStr = pid.toString();
                    if (!productOfferMap.has(productIdStr) ||
                        productOfferMap.get(productIdStr).discount < offer.discount) {
                        productOfferMap.set(productIdStr, offer);
                    }
                });
            } else if (offer.categoryId) {
                const categoryIdStr = offer.categoryId._id.toString();
                if (!categoryOfferMap.has(categoryIdStr) ||
                    categoryOfferMap.get(categoryIdStr).discount < offer.discount) {
                    categoryOfferMap.set(categoryIdStr, offer);
                }
            }
        });

        // Calculate cart total with offers
        let subtotal = 0;
        const orderItems = cart.items.map(item => {
            const product = item.productId;
            
            // Get product-specific offer
            const productOffer = productOfferMap.get(product._id.toString());
            
            // Get category offer
            const categoryOffer = product.categoriesId ?
                categoryOfferMap.get(product.categoriesId._id.toString()) : null;

            // Calculate best discount
            let bestDiscount = 0;
            if (productOffer) bestDiscount = productOffer.discount;
            if (categoryOffer && categoryOffer.discount > bestDiscount) {
                bestDiscount = categoryOffer.discount;
            }

            // Calculate prices with offer discount
            const originalPrice = product.price;
            const discountedPrice = bestDiscount > 0 
                ? Math.round(originalPrice * (1 - bestDiscount / 100))
                : originalPrice;
            const itemSubtotal = discountedPrice * item.quantity;
            subtotal += itemSubtotal;

            return {
                product: product._id,
                quantity: item.quantity,
                price: originalPrice,
                discountedPrice: discountedPrice,
                subtotal: itemSubtotal,
                order: {
                    status: 'processing',
                    statusHistory: [{
                        status: 'processing',
                        date: new Date(),
                        comment: 'Order placed using wallet payment'
                    }]
                }
            };
        });

        // Apply coupon discount if available
        let couponDiscount = 0;
        if (couponCode) {
            const coupon = await Coupon.findOne({ code: couponCode });
            if (coupon) {
                couponDiscount = Math.min(
                    (subtotal * coupon.discountPercentage) / 100,
                    coupon.maximumDiscount || Infinity
                );
            }
        }

        const finalAmount = subtotal - couponDiscount;

        // Get wallet and check balance
        const userWallet = await Wallet.findOne({ userId });
        if (!userWallet || userWallet.balance < finalAmount) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient wallet balance'
            });
        }

        // Create order
        const order = await orderSchema.create({
            userId,
            items: orderItems,
            totalAmount: finalAmount,
            shippingAddress: addressId,
            payment: {
                method: 'wallet',
                paymentStatus: 'completed'
            },
            coupon: couponCode ? {
                code: couponCode,
                discount: couponDiscount
            } : null
        });

        // Update wallet balance
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

        // Clear cart and coupon
        await cartSchema.findOneAndUpdate(
            { userId },
            { $set: { items: [] } }
        );
        if (req.session.coupon) delete req.session.coupon;

        res.json({
            success: true,
            message: 'Order placed successfully',
            orderId: order._id
        });

    } catch (error) {
        console.error('Wallet payment error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error processing wallet payment'
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

        // Find the coupon
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

        // Check total coupon usage limit
        if (coupon.totalCoupon !== null && coupon.usedCouponCount >= coupon.totalCoupon) {
            return res.status(400).json({
                success: false,
                message: 'Coupon limit has been exceeded. This coupon is no longer available.'
            });
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

        // Get cart total
        const cart = await cartSchema.findOne({ userId })
            .populate('items.productId');

        const cartTotal = cart.items.reduce(
            (sum, item) => sum + (item.quantity * item.price),
            0
        );

        // Check minimum purchase required
        if (cartTotal < coupon.minimumPurchase) {
            return res.status(400).json({
                success: false,
                message: `Minimum purchase of ₹${coupon.minimumPurchase} required`
            });
        }

        // Calculate discount
        let discount = (cartTotal * coupon.discountPercentage) / 100;
        if (coupon.maximumDiscount) {
            discount = Math.min(discount, coupon.maximumDiscount);
        }

        // Store discount details in session
        req.session.coupon = {
            code: coupon.code,
            discount: discount,
            discountedTotal: cartTotal - discount
        };

        res.json({
            success: true,
            discount,
            couponCode: coupon.code,
            message: 'Coupon applied successfully'
        });

    } catch (error) {
        next(error);
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

        const order = await orderSchema.findById(orderId)
            .populate('items.product');

        if (!order || order.userId.toString() !== req.session.user.toString()) {
            return res.redirect('/orders');
        }

        res.render('user/order-success', {
            orderId: order._id,
            orderDetails: order,
            userEmail: req.session.userEmail
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