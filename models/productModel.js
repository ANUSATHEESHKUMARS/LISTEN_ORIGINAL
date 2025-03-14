import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    productName: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    brand: {
        type: String,
        required: true,
        trim: true
   
    },
    categoriesId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    color: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true,
        minLength: 10,
        maxLength: 25
    },
    price: {
        type: Number,
        required: true,
        min: 0,
        default : function(){
            return this.price;
        }
    },
    stock: {
        type: Number,
        required: true,
        min: 0
    },
    imageUrl: [{
        type: String,
        required: true
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    offer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Offer'
    },
    offerApplied: {
        type: Boolean,
        default: false
    },
    offerType: {
        type: String,
        enum: ['product', 'category', null],
        default: null
    }
}, {
    timestamps: true
});

export default mongoose.model('Product', productSchema);