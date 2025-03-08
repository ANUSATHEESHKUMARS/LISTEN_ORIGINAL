import express from 'express';
import { getProductDetails } from '../controller/user/productViewController.js';
import productSchema from '../models/productModel.js';

const router = express.Router();

// Update the product details route to include related products
router.get('/product/:id', async (req, res) => {
    try {
        const product = await productSchema
            .findById(req.params.id)
            .populate('categoriesId');

        if (!product) {
            return res.status(404).render('error', { message: 'Product not found' });
        }

        // Fetch related products from the same category
        const relatedProducts = await productSchema
            .find({
                categoriesId: product.categoriesId,
                _id: { $ne: product._id },
                isActive: true
            })
            .limit(4)
            .select('productName imageUrl price _id');

        res.render('user/productdetails', { product, relatedProducts });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).render('error', { message: 'Server error' });
    }
});

export default router;