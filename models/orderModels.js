import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        subtotal: { type: Number, required: true },
        order: {
            status: { type: String, default: 'Pending' },
            statusHistory: [{ status: String, date: Date, comment: String }]
        }
    }],
    total: { type: Number, required: true },
    paymentMethod: {
        method: { type: String, required: true },
        paymentStatus: { type: String, required: true, default: 'processing' }
    },
    addressId: { type: mongoose.Schema.Types.ObjectId, ref: 'Address' },
    orderDate: { type: Date, default: Date.now }
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);
export default Order;
