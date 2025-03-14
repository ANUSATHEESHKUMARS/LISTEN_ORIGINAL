import orderSchema from "../../models/orderModels.js";
import userSchema from "../../models/userModels.js";
import productSchema from "../../models/productModel.js";
import Wallet from "../../models/walletModels.js";

const getOrders = async (req, res) => {
    try {
        const user = await userSchema.findById(req.session.user);
        const userId = req.session.user;
        const page = parseInt(req.query.page) || 1;
        const limit = 5;

        const totalOrders = await orderSchema.countDocuments({ userId })
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await orderSchema.find({ userId })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('items.product');

        // Process orders to handle null products and returns
        const processedOrders = orders.map(order => {
            const orderObj = order.toObject();
            
            // Ensure each item has a return property
            orderObj.items = orderObj.items.map(item => ({
                ...item,
                return: item.return || {
                    isReturnRequested: false,
                    reason: null,
                    requestDate: null,
                    status: null,
                    adminComment: null,
                    isReturnAccepted: false
                },
                product: item.product || {
                    productName: 'Product Unavailable',
                    imageUrl: ['/images/placeholder.jpg'],
                    price: item.price || 0
                }
            }));

            // Ensure shipping address has all required fields
            orderObj.shippingAddress = {
                fullName: orderObj.shippingAddress?.fullName || 'Name not available',
                mobileNumber: orderObj.shippingAddress?.mobileNumber || 'Not available',
                addressLine1: orderObj.shippingAddress?.addressLine1 || '',
                addressLine2: orderObj.shippingAddress?.addressLine2 || '',
                city: orderObj.shippingAddress?.city || '',
                state: orderObj.shippingAddress?.state || '',
                pincode: orderObj.shippingAddress?.pincode || ''
            };

            return orderObj;
        });

        res.render("user/viewOrder", {
            orders: processedOrders,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            user
        });

    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).render('error', {
            message: 'Error fetching orders',
            user: req.session.user
        });
    }
}

// Add this function to handle refunds to wallet
const handleWalletRefund = async (userId, amount, orderId) => {
    try {
        // Find or create wallet
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = await Wallet.create({ userId, balance: 0 });
        }

        // Add refund transaction
        const refundTransaction = {
            type: 'credit',
            amount: amount,
            description: `Refund for cancelled order #${orderId}`,
            orderId: orderId,
            date: new Date()
        };

        // Update wallet balance and add transaction
        wallet.balance += amount;
        wallet.transactions.push(refundTransaction);
        await wallet.save();

        return true;
    } catch (error) {
        console.error('Wallet refund error:', error);
        return false;
    }
};

// Update the cancelOrder function
const cancelOrder = async (req, res) => {
    try {
        const { orderId, productId } = req.params;
        const userId = req.session.user;

        const order = await orderSchema.findOne({
            _id: orderId,
            userId
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Find the specific item in the order
        const orderItem = order.items.find(item => 
            item.product.toString() === productId
        );

        if (!orderItem) {
            return res.status(404).json({
                success: false,
                message: 'Product not found in order'
            });
        }

        // Check if item can be cancelled
        if (!['processing', 'pending'].includes(orderItem.order.status)) {
            return res.status(400).json({
                success: false,
                message: 'Order cannot be cancelled at this stage'
            });
        }

        // Update order item status
        orderItem.order.status = 'cancelled';
        orderItem.order.statusHistory.push({
            status: 'cancelled',
            date: new Date(),
            comment: 'Order cancelled by customer'
        });

        // Calculate refund amount for this item
        const refundAmount = orderItem.subtotal;

        // Process refund based on payment method
        if (['razorpay', 'wallet'].includes(order.payment.method)) {
            // Handle refund to wallet
            const refundSuccess = await handleWalletRefund(userId, refundAmount, orderId);
            if (!refundSuccess) {
                throw new Error('Failed to process refund to wallet');
            }
        }

        // Restore product stock
        await productSchema.findByIdAndUpdate(
            productId,
            { $inc: { stock: orderItem.quantity } }
        );

        // Save the updated order
        await order.save();

        res.json({
            success: true,
            message: 'Order cancelled successfully. Refund will be processed to your wallet.'
        });

    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error cancelling order'
        });
    }
};

// Update the requestReturnItem function to handle refunds similarly
const requestReturnItem = async (req, res) => {
    try {
        const { orderId, productId } = req.params;
        const { reason } = req.body;
        const userId = req.session.user;

        const order = await orderSchema.findOne({
            _id: orderId,
            userId
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        const orderItem = order.items.find(item => 
            item.product.toString() === productId
        );

        if (!orderItem) {
            return res.status(404).json({
                success: false,
                message: 'Product not found in order'
            });
        }

        // Update return status
        orderItem.return = {
            isReturnRequested: true,
            reason: reason,
            requestDate: new Date(),
            status: 'pending',
            adminComment: null,
            isReturnAccepted: false
        };

        // If return is auto-accepted, process refund immediately
        if (process.env.AUTO_ACCEPT_RETURNS === 'true') {
            orderItem.return.isReturnAccepted = true;
            orderItem.return.status = 'accepted';
            orderItem.order.status = 'returned';

            // Process refund to wallet
            const refundAmount = orderItem.subtotal;
            const refundSuccess = await handleWalletRefund(userId, refundAmount, orderId);
            
            if (!refundSuccess) {
                throw new Error('Failed to process refund to wallet');
            }

            // Restore product stock
            await productSchema.findByIdAndUpdate(
                productId,
                { $inc: { stock: orderItem.quantity } }
            );
        }

        await order.save();

        res.json({
            success: true,
            message: process.env.AUTO_ACCEPT_RETURNS === 'true' 
                ? 'Return request accepted. Refund will be processed to your wallet.'
                : 'Return request submitted successfully'
        });

    } catch (error) {
        console.error('Return request error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error processing return request'
        });
    }
};

export default {
    getOrders,
    cancelOrder,
    requestReturnItem
}