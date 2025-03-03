import cartSchema from '../../models/cartModels.js';
import productSchema from '../../models/productModel.js';
import Category from '../../models/categoryModels.js';

const getCart = async (req, res) => {
    try {
        const userId = req.session.user;
        
        // Get active categories
        const activeCategories = await Category.find({ isActive: true }).distinct('_id');
        
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

        // Process remaining items
        const updatedItems = validItems.map(item => {
            const product = item.productId;
            const quantity = parseInt(item.quantity) || 1;
            const subtotal = product.price * quantity;

            return {
                product: {
                    _id: product._id,
                    productName: product.productName,
                    imageUrl: product.imageUrl,
                    stock: product.stock,
                    color: product.color
                },
                quantity: quantity,
                price: product.price,
                subtotal: subtotal
            };
        });

        // Calculate total
        const total = updatedItems.reduce((sum, item) => sum + (parseFloat(item.subtotal) || 0), 0);

        // Update cart in database
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

        if (quantity < 1) {
            return res.status(400).json({ message: 'Quantity must be at least 1' });
        }

        // Check product availability and stock
        const product = await productSchema.findById(productId).populate({
            path: 'categoriesId',
            match: { isActive: true }
        });

        if (!product || !product.isActive || !product.categoriesId) {
            return res.status(400).json({ message: 'Product is not available' });
        }

        if (product.stock < quantity) {
            return res.status(400).json({ message: 'Not enough stock available' });
        }

        // Find and update cart
        const cart = await cartSchema.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const cartItem = cart.items.find(item => item.productId.toString() === productId);
        if (!cartItem) {
            return res.status(404).json({ message: 'Product not found in cart' });
        }

        cartItem.quantity = quantity;
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
            success: true,
            message: 'Quantity updated successfully',
            quantity: quantity,
            subtotal: quantity * cartItem.price,
            total: total
        });

    } catch (error) {
        console.error('Error updating quantity:', error);
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