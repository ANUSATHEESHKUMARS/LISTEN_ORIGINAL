import cartSchema from '../../models/cartModels.js';
import productSchema from '../../models/productModel.js';
import Category from '../../models/categoryModels.js';
import Offer from '../../models/offerModel.js';

const getCart = async (req, res) => {
    try {
        const userId = req.session.user;
        
        // Get active categories
        const activeCategories = await Category.find({ isActive: true }).distinct('_id');
        
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

        const cart = await cartSchema.findOne({ userId }).populate({
            path: 'items.productId',
            populate: {
                path: 'categoriesId',
                match: { isActive: true }
            }
        });

        if (!cart) {
            return res.render('user/cart', { 
                cartItems: [],
                total: 0
            });
        }

        // Filter out items with inactive categories or products
        const validItems = cart.items.filter(item => 
            item.productId && 
            item.productId.categoriesId && 
            item.productId.isActive &&
            activeCategories.some(catId => catId.equals(item.productId.categoriesId._id))
        );

        // Update cart if invalid items were removed
        if (validItems.length !== cart.items.length) {
            cart.items = validItems;
            await cart.save();
        }

        // Process remaining items with offers
        const updatedItems = validItems.map(item => {
            const product = item.productId;
            const quantity = parseInt(item.quantity) || 1;
            
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
                    stock: product.stock,
                    color: product.color
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

        // Calculate total with discounts
        const total = updatedItems.reduce((sum, item) => sum + item.subtotal, 0);

        // Update cart in database with new prices
        cart.items = cart.items.map((item, index) => ({
            ...item,
            subtotal: updatedItems[index].subtotal
        }));
        cart.total = total;
        await cart.save();

        res.render('user/cart', { 
            cartItems: updatedItems,
            total: total
        });
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).render('user/cart', { 
            cartItems: [],
            total: 0,
            error: 'Failed to load cart'
        });
    }
};

const addToCart = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.session.user;

        // Check if product exists and is active
        const product = await productSchema.findById(productId).populate({
            path: 'categoriesId',
            match: { isActive: true }
        });

        if (!product || !product.isActive || !product.categoriesId) {
            return res.status(400).json({
                success: false,
                message: 'Product is not available'
            });
        }

        let cart = await cartSchema.findOne({ userId });

        if (!cart) {
            cart = new cartSchema({
                userId,
                items: [{
                    productId,
                    quantity,
                    price: product.price,
                    subtotal: quantity * product.price
                }],
                total: quantity * product.price
            });
        } else {
            const existingItem = cart.items.find(item => item.productId.toString() === productId);

            if (existingItem) {
                const newQuantity = existingItem.quantity + parseInt(quantity);
                if (newQuantity > 3) {
                    return res.status(400).json({ 
                        message: `Cannot add more items. Maximum limit is 3 (Current quantity: ${existingItem.quantity})`
                    });
                }
                if (newQuantity > product.stock) {
                    return res.status(400).json({ 
                        message: 'Not enough stock available'
                    });
                }

                existingItem.quantity = newQuantity;
                existingItem.subtotal = newQuantity * product.price;
            } else {
                cart.items.push({
                    productId,
                    quantity,
                    price: product.price,
                    subtotal: quantity * product.price
                });
            }
            cart.total = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
        }

        await cart.save();

        res.status(200).json({ 
            message: 'Product added to cart successfully',
            cartCount: cart.items.length,
            total: cart.total
        });
    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ message: 'Failed to add product to cart' });
    }
};

const updateQuantity = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
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
            if (offer.productIds?.length > 0) {
                offer.productIds.forEach(pid => {
                    if (!productOfferMap.has(pid.toString()) ||
                        productOfferMap.get(pid.toString()).discount < offer.discount) {
                        productOfferMap.set(pid.toString(), offer);
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

        // Find and validate product
        const product = await productSchema.findById(productId).populate('categoriesId');
        if (!product || !product.isActive) {
            return res.status(400).json({ success: false, message: 'Product not available' });
        }

        // Calculate offer price
        const productOffer = productOfferMap.get(productId);
        const categoryOffer = product.categoriesId ? 
            categoryOfferMap.get(product.categoriesId._id.toString()) : null;

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

        const originalPrice = product.price;
        const discountPrice = bestDiscount > 0 
            ? Math.round(originalPrice * (1 - bestDiscount / 100))
            : originalPrice;
        const subtotal = discountPrice * quantity;

        // Update cart
        const cart = await cartSchema.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        const cartItem = cart.items.find(item => item.productId.toString() === productId);
        if (!cartItem) {
            return res.status(404).json({ success: false, message: 'Item not found in cart' });
        }

        cartItem.quantity = quantity;
        cartItem.subtotal = subtotal;
        await cart.save();

        // Calculate new total
        const total = cart.items.reduce((sum, item) => sum + item.subtotal, 0);

        res.json({
            success: true,
            item: {
                productId,
                originalPrice,
                discountPrice,
                discountPercentage: bestDiscount,
                subtotal,
                offerApplied: bestDiscount > 0,
                quantity
            },
            total,
            itemCount: cart.items.length
        });

    } catch (error) {
        console.error('Update quantity error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update quantity' 
        });
    }
};

const removeFromCart = async (req, res) => {
    try {
        const { productId } = req.params;
        const userId = req.session.user;

        // Find the cart
        const cart = await cartSchema.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        // Remove the item
        cart.items = cart.items.filter(item => 
            item.productId.toString() !== productId
        );

        await cart.save();

        // Calculate new totals
        const updatedCart = await cartSchema.findOne({ userId }).populate('items.productId');
        const cartItems = updatedCart.items.map(item => ({
            product: item.productId,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.quantity * item.price
        }));

        const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0);

        res.status(200).json({ 
            message: 'Item removed from cart',
            total,
            itemCount: cart.items.length
        });

    } catch (error) {
        console.error('Error removing item from cart:', error);
        res.status(500).json({ message: 'Failed to remove item from cart' });
    }
};

export default {
    getCart,
    addToCart,
    updateQuantity,
    removeFromCart
};