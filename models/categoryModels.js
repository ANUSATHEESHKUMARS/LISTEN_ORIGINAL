import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
  

    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    currentOffer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Offer'
    }
});

// Add virtual for products
categorySchema.virtual('products', {
    ref: 'Product',
    localField: '_id',
    foreignField: 'categoriesId'
});

export default mongoose.model('Category', categorySchema);