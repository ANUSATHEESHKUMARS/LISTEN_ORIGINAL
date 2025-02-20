import Product from '../../models/productModel.js'; 

export const getProductDetails = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId);  
        if (!product) {
            return res.status(404).render('error', {
                message: 'Product not found'
            });
        }

      
        const relatedProducts = await Product.find({
            category: product.category,
            _id: { $ne: productId }
        }).limit(5);

        res.render('user/productdetails', {
            title: product.productName,
            product,
            relatedProducts
        });
    } catch (error) {
        console.error('Error in getProductDetails:', error);
        res.status(500).render('error', {
            message: 'Error loading product details'
        });
    }
};