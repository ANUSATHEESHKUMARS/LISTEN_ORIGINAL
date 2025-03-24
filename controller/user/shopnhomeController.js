import Product from '../../models/productModel.js'
import Category from '../../models/categoryModels.js';
import Offer from '../../models/offerModel.js';
import mongoose from 'mongoose';

const getHome = async (req, res) => {
    try {
        // Get active categories
        const activeCategories = await Category.find({ isActive: true }).distinct('_id');

        // Get active offers
        const activeOffers = await Offer.find({
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
            status: 'active'
        }).populate('categoryId productIds');

        // Create maps for offers
        const productOfferMap = new Map();
        const categoryOfferMap = new Map();

        activeOffers.forEach(offer => {
            if (offer.productIds && offer.productIds.length > 0) {
                offer.productIds.forEach(productId => {
                    const productIdStr = productId.toString();
                    if (!productOfferMap.has(productIdStr) ||
                        productOfferMap.get(productIdStr).discount < offer.discount) {
                        productOfferMap.set(productIdStr, offer);
                    }
                });
            } else if (offer.categoryId) {
                const categoryIdStr = offer.categoryId._id.toString();
                if (!categoryOfferMap.has(categoryIdStr) ||
                    categoryOfferMap.get(categoryIdStr).discount < offer.discount) {
                    categoryOfferMap.set(categoryIdStr, offer);
                }
            }
        });

        // Fetch active products
        const products = await Product.find({
            isActive: true,
            categoriesId: { $in: activeCategories }
        })
        .populate('categoriesId')
        .sort({ createdAt: -1 })
        .limit(5);

        // Process products with offers
        const processedProducts = products.map(product => {
            const productData = product.toObject();

            // Get product-specific offer
            const productOffer = productOfferMap.get(product._id.toString());
            
            // Get category offer
            const categoryOffer = product.categoriesId ?
                categoryOfferMap.get(product.categoriesId._id.toString()) : null;

            // Calculate best discount
            let bestDiscount = 0;
            let appliedOffer = null;

            if (productOffer) {
                bestDiscount = productOffer.discount;
                appliedOffer = productOffer;
            }
            if (categoryOffer && categoryOffer.discount > bestDiscount) {
                bestDiscount = categoryOffer.discount;
                appliedOffer = categoryOffer;
            }

            // Calculate discounted price
            const discountedPrice = bestDiscount > 0 
                ? Math.round(product.price * (1 - bestDiscount / 100))
                : product.price;

            return {
                ...productData,
                price: product.price,
                discountPrice: discountedPrice,
                offerApplied: bestDiscount > 0,
                discountPercentage: bestDiscount,
                appliedOffer: appliedOffer
            };
        });
        
        res.render('user/home', {
            products: processedProducts,
            title: 'Home'
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.render('user/home', {
            products: [],
            title: 'Home'
        });
    }
};

const getShop = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;

        // Get active categories for the filter dropdown
        const categories = await Category.find({ isActive: true }).sort({ name: 1 });

        // Get active offers first
        const activeOffers = await Offer.find({
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
            status: 'active'
        }).populate('categoryId productIds');

        // Create maps for offers
        const productOfferMap = new Map();
        const categoryOfferMap = new Map();

        activeOffers.forEach(offer => {
            if (offer.productIds && offer.productIds.length > 0) {
                offer.productIds.forEach(pid => {
                    const productIdStr = pid.toString();
                    if (!productOfferMap.has(productIdStr) ||
                        productOfferMap.get(productIdStr).discount < offer.discount) {
                        productOfferMap.set(productIdStr, offer);
                    }
                });
            } else if (offer.categoryId) {
                const categoryIdStr = offer.categoryId._id.toString();
                if (!categoryOfferMap.has(categoryIdStr) ||
                    categoryOfferMap.get(categoryIdStr).discount < offer.discount) {
                    categoryOfferMap.set(categoryIdStr, offer);
                }
            }
        });

        // Build base filter query
        const filter = { isActive: true };

        // Add search filter
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search.trim(), 'i');
            filter.$or = [
                { productName: searchRegex },
                { brand: searchRegex },
                { description: searchRegex }
            ];
        }

        // Add category filter
        if (req.query.category) {
            filter.categoriesId = new mongoose.Types.ObjectId(req.query.category);
        }

        // Add stock filter
        if (req.query.stock === 'inStock') {
            filter.stock = { $gt: 0 };
        } else if (req.query.stock === 'outOfStock') {
            filter.stock = 0;
        }

        // Fetch all products first to apply price filter after discount calculation
        let products = await Product.find(filter)
            .populate('categoriesId')
            .lean();

        // Process products with offers and apply price filter
        let processedProducts = products.map(product => {
            const productOffer = productOfferMap.get(product._id.toString());
            const categoryOffer = product.categoriesId ?
                categoryOfferMap.get(product.categoriesId._id.toString()) : null;

            let bestDiscount = 0;
            let appliedOffer = null;

            if (productOffer) {
                bestDiscount = productOffer.discount;
                appliedOffer = productOffer;
            }
            if (categoryOffer && categoryOffer.discount > bestDiscount) {
                bestDiscount = categoryOffer.discount;
                appliedOffer = categoryOffer;
            }

            const discountedPrice = bestDiscount > 0 
                ? Math.round(product.price * (1 - bestDiscount / 100))
                : product.price;

            return {
                ...product,
                price: product.price,
                discountPrice: discountedPrice,
                offerApplied: bestDiscount > 0,
                discountPercentage: bestDiscount,
                appliedOffer: appliedOffer
            };
        });

        // Apply price filter after discount calculation
        if (req.query.minPrice || req.query.maxPrice) {
            processedProducts = processedProducts.filter(product => {
                const effectivePrice = product.discountPrice;
                const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : 0;
                const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : Infinity;
                return effectivePrice >= minPrice && effectivePrice <= maxPrice;
            });
        }

        // Apply sorting after processing
        const sortField = req.query.sort;
        if (sortField) {
            processedProducts.sort((a, b) => {
                switch (sortField) {
                    case 'priceLowToHigh':
                        return a.discountPrice - b.discountPrice;
                    case 'priceHighToLow':
                        return b.discountPrice - a.discountPrice;
                    case 'nameAZ':
                        return a.productName.localeCompare(b.productName);
                    case 'nameZA':
                        return b.productName.localeCompare(a.productName);
                    default:
                        return 0;
                }
            });
        }

        // Apply pagination after filtering and sorting
        const totalProducts = processedProducts.length;
        const totalPages = Math.ceil(totalProducts / limit);
        processedProducts = processedProducts.slice(skip, skip + limit);

        if (req.xhr) {
            return res.json({
                products: processedProducts,
                pagination: {
                    currentPage: page,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            });
        }

        res.render('user/shop', {
            products: processedProducts,
            categories,
            pagination: {
                currentPage: page,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            },
            filters: {
                search: req.query.search || '',
                category: req.query.category || '',
                minPrice: req.query.minPrice || '',
                maxPrice: req.query.maxPrice || '',
                sort: req.query.sort || '',
                stock: req.query.stock || ''
            }
        });

    } catch (error) {
        console.error('Error in getShop:', error);
        res.status(500).render('user/shop', {
            products: [],
            categories: [],
            pagination: {
                currentPage: 1,
                totalPages: 0,
                hasNextPage: false,
                hasPrevPage: false
            },
            filters: {
                search: '',
                category: '',
                minPrice: '',
                maxPrice: '',
                sort: '',
                stock: ''
            }
        });
    }
};

export default {
    getHome,
    getShop
};