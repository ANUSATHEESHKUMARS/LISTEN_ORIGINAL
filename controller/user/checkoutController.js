import cartSchema from '../../models/cartModels.js';
import Order from '../../models/orderModels.js';
import addressSchema from '../../models/addressModels.js';
import productSchema from '../../models/productModel.js';

const userCheckoutController = {
    getCheckoutPage: async (req, res) => {
        try {
            const userId = req.session.user; // Get user ID from session
            const addresses = await addressSchema.find({ userId }); // Fetch addresses for the user
            const cart = await cartSchema.findOne({ userId }).populate('items.productId');

            if (!cart || cart.items.length === 0) {
                return res.redirect('/cart');
            }

            // Populate product details and calculate subtotals
            const populatedCart = await cartSchema.findOne({ userId })
                .populate({
                    path: 'items.productId',
                    model: 'Product',
                    select: 'productName imageUrl price stock'
                });

            // Check stock availability
            const stockCheck = populatedCart.items.every(item => 
                item.productId.stock >= item.quantity
            );

            if (!stockCheck) {
                return res.redirect('/cart?error=stock');
            }

            // Format cart items for the template
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

            // Calculate total
            const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0);

            res.render('user/checkout', {
                addresses,
                cartItems,
                total
            });
        } catch (error) {
            console.error('Checkout page error:', error);
            res.status(500).render('error', { 
                message: 'Error loading checkout page',
                user: req.session.user
            });
        }
    },
    placeOrder: async (req, res) => {
        try {
            console.log('Request body:', req.body); // Log the incoming request body
            const { addressId, paymentMethod, total, items } = req.body;
    
            // Validate required fields
            if (!addressId || !paymentMethod || !total || !items || items.length === 0) {
                
                return res.status(400).json({
                    
                    success: false,
                    message: 'Missing required fields'
                    
                });
            }
    
            const userId = req.session.user;
            console.log(userId)
            console.log(addressId)
            // Get address
            const address = await addressSchema.findById({ _id: addressId});
            if (!address) {
                return res.status(400).json({
                    success: false,
                    message: 'Delivery address not found'
                });
            }
            console.log(address)
            console.log("place order : ",items)
            // Create the order
            const order = await Order.create({
                userId,
                items: items.map(item => ({
                    product: item.product,
                    quantity: item.quantity,
                    price: item.price,
                    subtotal: item.subtotal,
                    order: {
                        status: 'Pending',
                        statusHistory: [{ status: 'Pending', date: new Date(), comment: 'Order placed' }]
                    }
                })),
                total: Math.round(total),
                addressId: addressId,  // Store address as reference ID
                paymentMethod: {
                    method: paymentMethod,
                    paymentStatus: paymentMethod === 'cod' ? 'processing' : 'completed'
                }
            });
            console.log("order_id: ",order._id)
            res.json({
                success: true,
                message: 'Order placed successfully',
                orderId: order._id // Return the order ID
            });
            console.log(order)
        } catch (error) { 
            console.error('Place order error:', error);
            res.status(500).json({
                success: false,
                message: 'Error placing order'
            });
        }
    }}

export default userCheckoutController;
