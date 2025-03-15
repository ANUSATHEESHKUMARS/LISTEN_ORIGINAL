import Product from '../../models/productModel.js'; 
import Offer from '../../models/offerModel.js'


export const getProductDetails = async (req, res) => {
    console.log("Heeeleeleoee");
    
    try {
        const productId = req.params.id;

        // Fetch product and populate categories
        const product = await Product.findById(productId).populate("categoriesId");

        if (!product) {
            return res.status(404).render('error', {
                message: 'Product not found'
            });
        }

        // Fetch active offers
        const activeOffers = await Offer.find({
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
            status: 'active'
        }).populate('categoryId productIds');

        // Find the best offer
        let bestDiscount = 0;
        let appliedOffer = null;

        // Product-specific offer
        activeOffers.forEach((offer) => {
            if (offer.productIds.some(pid => pid.toString() === productId)) {
                if (offer.discount > bestDiscount) {
                    bestDiscount = offer.discount;
                    appliedOffer = offer;
                }
            }

            // Category-specific offer
            if (offer.categoryId && product.categoriesId) {
                if (offer.categoryId._id.toString() === product.categoriesId._id.toString()) {
                    if (offer.discount > bestDiscount) {
                        bestDiscount = offer.discount;
                        appliedOffer = offer;
                    }
                }
            }
        });

        // Calculate discounted price
        const discountPrice = bestDiscount > 0
            ? Math.round(product.price * (1 - bestDiscount / 100))
            : product.price;

        // Get related products
        const relatedProducts = await Product.find({
            category: product.category,
            _id: { $ne: productId }
        }).limit(5);

        // Render product details with offer info
        res.render('user/productdetails', {
            title: product.productName,
            product: {
                ...product.toObject(),
                discountPrice,
                offerApplied: bestDiscount > 0,
                discountPercentage: bestDiscount,
                appliedOffer
            },
            relatedProducts
        });
        console.log("HIIIIIIII");
        
        console.log("Producttt", product);
        

    } catch (error) {
        console.error('Error in getProductDetails:', error);
        res.status(500).render('error', {
            message: 'Error loading product details'
        });
    }
};


// export const getProductDetails = async (req, res) => {
//     try {
//         const productId = req.params.id;
//         const product = await Product.findById(productId).populate("categoriesId"); 
//         console.log("PProductssssssss",product);
         
//         if (!product) {
//             return res.status(404).render('error', {
//                 message: 'Product not found'
//             });
//         }

      
//         const relatedProducts = await Product.find({
//             category: product.category,
//             _id: { $ne: productId }
//         }).limit(5);

//         res.render('user/productdetails', {
//             title: product.productName,
//             product,
//             relatedProducts
//         });
//     } catch (error) {
//         console.error('Error in getProductDetails:', error);
//         res.status(500).render('error', {
//             message: 'Error loading product details'
//         });
//     }
// };