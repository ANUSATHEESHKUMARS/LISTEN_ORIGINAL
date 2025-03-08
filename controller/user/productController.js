const getProductDetails = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await productSchema.findById(productId).populate('categoriesId');
        
        if (!product) {
            return res.status(404).render('error', { message: 'Product not found' });
        }

        // Fetch related products from the same category, excluding current product
        const relatedProducts = await productSchema.find({
            categoriesId: product.categoriesId,
            _id: { $ne: productId },
            isActive: true,
            stock: { $gt: 0 }
        })
        .limit(3) // Limit to 3 related products
        .select('productName imageUrl price _id'); // Select only needed fields

        res.render('user/productdetails', { 
            product,
            relatedProducts
        });
    } catch (error) {
        console.error('Error fetching product details:', error);
        res.status(500).render('error', { message: 'Error loading product details' });
    }
};