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
        maxLength: 50
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
    }
}, {
    timestamps: true
});

export default mongoose.model('Product', productSchema);