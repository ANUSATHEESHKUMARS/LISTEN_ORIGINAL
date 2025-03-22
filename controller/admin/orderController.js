import orderSchema from '../../models/orderModels.js';
import productSchema from '../../models/productModel.js';
import wallet from '../../models/walletModels.js'

const getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page || 1);
        const limit = 10;
        const skip = (page - 1) * limit;

        //get filter parameters
        const status = req.query.status;
        const dateFrom = req.query.dateFrom;
        const dateTo = req.query.dateTo;

        //build filter object 
        let filter = {};

        //exclude pending status by default 
        filter['items.order.status'] = { $ne: 'pending' };

        //add additional status filter if provided
        if (status) {
            filter['items.order.status'] = status;
        }

        if (dateFrom || dateTo) {
            filter.orderDate = {};
            if (dateFrom) filter.orderDate.$gte = new Date(dateFrom);
            if (dateTo) filter.orderDate.$lte = new Date(dateTo);
        }

        const totalOrders = await orderSchema.countDocuments(filter);
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await orderSchema.find(filter)
            .populate('userId', 'firstName lastName email')
            .populate('items.product')
            .sort({ orderDate: -1 })
            .skip(skip)
            .limit(limit);

        // Process orders to handle null products and ensure shipping address exists
        const processedOrders = orders.map(order => {
            const orderObj = order.toObject();
            
            // Ensure shipping address exists with default values
            orderObj.shippingAddress = orderObj.shippingAddress || {
                fullName: 'N/A',
                mobileNumber: 'N/A',
                addressLine1: 'N/A',
                addressLine2: '',
                city: 'N/A',
                state: 'N/A',
                pincode: 'N/A'
            };

            // Process items
            orderObj.items = orderObj.items.map(item => ({
                ...item,
                product: item.product || {
                    _id: 'unavailable',
                    productName: 'Product Unavailable',
                    imageUrl: ['/images/placeholder.jpg'],
                    price: item.price || 0
                }
            }));
            return orderObj;
        });

        res.render('admin/orders', {
            orders: processedOrders,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            admin: req.session.admin
        });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).render('admin/error', {
            message: 'Error fetching orders',
            error,
            admin: req.session.admin
        });
    }
};


const updateItemStatus = async (req, res, next) => {
    try {
        const { orderId, productId } = req.params;
        const { status } = req.body;

        const order = await orderSchema.findById(orderId)
            .populate('items.product');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const item = order.items.find(item =>
            item.product._id.toString() === productId
        );

        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        // Update item status
        item.order.status = status;
        item.order.statusHistory.push({
            status,
            date: new Date(),
            comment: `Status updated to ${status} by admin`
        });

        if (status === 'cancelled') {
            // Restore stock
            await productSchema.findByIdAndUpdate(
                item.product._id,
                { $inc: { stock: item.quantity } }
            );

            // Check if all items in the order are cancelled
            const allItemsCancelled = order.items.every(item => item.order.status === 'cancelled');

            // If all items are cancelled, update payment status to cancelled
            if (allItemsCancelled) {
                order.payment.paymentStatus = 'cancelled';
            }
        } else if (status === 'delivered' && order.payment.method === 'cod') {
            // Check if all items are either delivered or cancelled
            const allItemsCompleted = order.items.every(item =>
                item.order.status === 'delivered' || item.order.status === 'cancelled'
            );

            // Update payment status for COD orders when all items are delivered/cancelled
            if (allItemsCompleted) {
                order.payment.paymentStatus = 'completed';
            }
        }

        // Use markModified to ensure Mongoose detects nested updates
        order.markModified('items');
        order.markModified('payment');

        await order.save();
        res.json({ success: true, message: 'Item status updated successfully' });

    } catch (error) {
        next(error)
    }
};

const handleReturnRequest = async (req, res) => {
    try {
        const { orderId, productId } = req.params;
        const { returnStatus, adminComment } = req.body;

        const order = await orderSchema.findById(orderId)
            .populate('items.product')
            .populate('userId');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        const item = order.items.find(item => 
            item.product._id.toString() === productId
        );

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

        // Update return status and admin comment
        item.return.status = returnStatus;
        item.return.adminComment = adminComment;
        item.return.processedDate = new Date();

        if (returnStatus === 'approved') {
            // Update item status to returned
            item.order.status = 'returned';
            item.return.isReturnAccepted = true;
            
            // Update product stock
            await productSchema.findByIdAndUpdate(
                item.product._id,
                { $inc: { stock: item.quantity } }
            );

            // Process refund if payment was online
            if (['online', 'razorpay', 'wallet'].includes(order.payment.method)) {
                // Add refund to user's wallet
                const refundAmount = item.subtotal;
                await wallet.findOneAndUpdate(
                    { userId: order.userId._id },
                    {
                        $inc: { balance: refundAmount },
                        $push: {
                            transactions: {
                                type: 'credit',
                                amount: refundAmount,
                                description: `Refund for return of order #${order.orderCode}`,
                                orderId: order._id
                            }
                        }
                    },
                    { upsert: true }
                );
                
                item.order.statusHistory.push({
                    status: 'refund processed',
                    date: new Date(),
                    comment: `Refund of ₹${refundAmount} processed to wallet`
                });
            }

        } else if (returnStatus === 'rejected') {
            // Keep the item status as delivered
            item.order.status = 'delivered';
            item.return.isReturnAccepted = false;
        }

        // Add status history entry
        item.order.statusHistory.push({
            status: returnStatus === 'approved' ? 'returned' : 'return rejected',
            date: new Date(),
            comment: `Return ${returnStatus}. ${adminComment}`
        });

        await order.save();

        res.json({
            success: true,
            message: `Return request ${returnStatus}`,
            status: returnStatus
        });

    } catch (error) {
        console.error('Handle return error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error handling return request'
        });
    }
};

async function processRefund(order) {
    const wallet = await Wallet.findOne({ userId: order.userId });
    
    if (!wallet) {
        throw new Error('User wallet not found');
    }

    wallet.balance += order.totalAmount;
    wallet.transactions.push({
        type: 'credit',
        amount: order.totalAmount,
        description: `Refund for order #${order.orderCode}`,
        orderId: order._id
    });

    await wallet.save();
    order.payment.paymentStatus = 'refunded';
}


export default {
    getOrders,
    updateItemStatus,
    handleReturnRequest,
    processRefund
}