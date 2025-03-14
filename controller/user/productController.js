import Product from '../../models/productModel.js';
import Offer from "../../models/offerModel.js";

const getProductDetails = async (req, res) => {
    try {
        const productId = req.params.id;
        console.log('Fetching product with ID:', productId); // Debug log

        const product = await Product.findById(productId)
            .populate('categoriesId');

        if (!product || !product.isActive) {
            console.log('Product not found or inactive'); // Debug log
            return res.status(404).redirect('/home');
        }

        // Fetch active offers
        const now = new Date();
        console.log('Fetching offers for date:', now); // Debug log

        const offers = await Offer.find({
            status: 'active',
            startDate: { $lte: now },
            endDate: { $gte: now },
            $or: [
                { productIds: product._id },
                { categoryId: product.categoriesId._id }
            ]
        });

        console.log('Found offers:', offers); // Debug log

        // Find best applicable offer
        let bestDiscount = 0;
        let appliedOffer = null;

        // Check product-specific offers first
        const productOffer = offers.find(offer =>
            offer.productIds && offer.productIds.some(id => id.equals(product._id))
        );
        if (productOffer) {
            bestDiscount = productOffer.discount;
            appliedOffer = productOffer;
            console.log('Applied product offer:', productOffer); // Debug log
        }

        // Check category offers
        const categoryOffer = offers.find(offer =>
            offer.categoryId && offer.categoryId.equals(product.categoriesId._id)
        );
        if (categoryOffer && categoryOffer.discount > bestDiscount) {
            bestDiscount = categoryOffer.discount;
            appliedOffer = categoryOffer;
            console.log('Applied category offer:', categoryOffer); // Debug log
        }

        // Calculate discounted price
        const discountPrice = bestDiscount > 0 
            ? Math.round(product.price * (1 - bestDiscount / 100))
            : product.price;

        // Process the product data
        const processedProduct = {
            ...product.toObject(),
            price: product.price,
            discountPrice: discountPrice,
            offerApplied: bestDiscount > 0,
            discountPercentage: bestDiscount,
            appliedOffer: appliedOffer
        };

        console.log('Processed product:', {
            productName: processedProduct.productName,
            price: processedProduct.price,
            discountPrice: processedProduct.discountPrice,
            offerApplied: processedProduct.offerApplied,
            discountPercentage: processedProduct.discountPercentage
        }); // Debug log

        // Find and process related products
        const relatedProducts = await Product.find({
            categoriesId: product.categoriesId,
            isActive: true,
            _id: { $ne: productId }
        }).limit(4);

        const processedRelatedProducts = await Promise.all(relatedProducts.map(async (p) => {
            const relatedOffers = await Offer.find({
                status: 'active',
                startDate: { $lte: now },
                endDate: { $gte: now },
                $or: [
                    { productIds: p._id },
                    { categoryId: p.categoriesId }
                ]
            });

            let relatedBestDiscount = 0;
            let relatedAppliedOffer = null;

            // Process offers for related products
            const pProductOffer = relatedOffers.find(offer =>
                offer.productIds && offer.productIds.some(id => id.equals(p._id))
            );
            if (pProductOffer) {
                relatedBestDiscount = pProductOffer.discount;
                relatedAppliedOffer = pProductOffer;
            }

            const pCategoryOffer = relatedOffers.find(offer =>
                offer.categoryId && offer.categoryId.equals(p.categoriesId)
            );
            if (pCategoryOffer && pCategoryOffer.discount > relatedBestDiscount) {
                relatedBestDiscount = pCategoryOffer.discount;
                relatedAppliedOffer = pCategoryOffer;
            }

            const relatedDiscountPrice = relatedBestDiscount > 0 
                ? Math.round(p.price * (1 - relatedBestDiscount / 100))
                : p.price;

            return {
                ...p.toObject(),
                price: p.price,
                discountPrice: relatedDiscountPrice,
                offerApplied: relatedBestDiscount > 0,
                discountPercentage: relatedBestDiscount,
                appliedOffer: relatedAppliedOffer
            };
        }));

        res.render('user/productdetails', {
            product: processedProduct,
            relatedProducts: processedRelatedProducts
        });

    } catch (error) {
        console.error('Error in getProductDetails:', error);
        res.status(500).render('error', { 
            message: 'Error loading product details',
            error: error.message
        });
    }
};

export default {
    getProductDetails,
};