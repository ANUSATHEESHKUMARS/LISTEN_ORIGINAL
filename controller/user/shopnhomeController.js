import Product from '../../models/productModel.js'
import Category from '../../models/categoryModels.js';

const getHome = async (req, res) => {
    try {
        // Get IDs of active categories
        const activeCategories = await Category.find({ isActive: true }).distinct('_id');

        // Fetch active products with active categories and populate offers
        const products = await Product.find({ 
            isActive: true,
            categoriesId: { $in: activeCategories }
        })
        .populate({
            path: 'categoriesId',
            match: { isActive: true }
        })
        .populate('offer') // Add this to populate offer details
        .sort({ createdAt: -1 })
        .limit(5);
        
        // Filter out products where category wasn't populated
        const filteredProducts = products.filter(product => product.categoriesId).map(product => {
            const productObj = product.toObject();
            
            // Calculate discounted price if there's an active offer
            if (product.offer && product.offer.status === 'active') {
                const currentDate = new Date();
                if (currentDate >= product.offer.startDate && currentDate <= product.offer.endDate) {
                    productObj.discountPrice = Math.round(product.price * (1 - product.offer.discount / 100));
                } else {
                    productObj.discountPrice = product.price;
                }
            } else {
                productObj.discountPrice = product.price;
            }
            
            return productObj;
        });
        
        console.log('products with offers:', filteredProducts);
        res.render('user/home', { 
            products: filteredProducts,
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

        // Build filter query
        const filter = { 
            isActive: true,
            $expr: {
                $and: [
                    { $eq: ["$isActive", true] },
                    {
                        $in: [
                            "$categoriesId",
                            await Category.find({ isActive: true }).distinct('_id')
                        ]
                    }
                ]
            }
        };

        // Add search filter
        if (req.query.search) {
            filter.$or = [
                { productName: { $regex: req.query.search, $options: 'i' } },
                { brand: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        // Add color filter
        if (req.query.color && req.query.color !== '') {
            filter.color = { $regex: new RegExp(`^${req.query.color}$`, 'i') };
        }

        // Add price range filter
        if (req.query.minPrice || req.query.maxPrice) {
            filter.price = {};
            if (req.query.minPrice) filter.price.$gte = Number(req.query.minPrice);
            if (req.query.maxPrice) filter.price.$lte = Number(req.query.maxPrice);
        }

        // Add stock filter
        if (req.query.stock === 'inStock') {
            filter.stock = { $gt: 0 };
        } else if (req.query.stock === 'outOfStock') {
            filter.stock = 0;
        }

        // Build sort query
        let sortQuery = {};
        switch (req.query.sort) {
            case 'priceLowToHigh':
                sortQuery = { price: 1 };
                break;
            case 'priceHighToLow':
                sortQuery = { price: -1 };
                break;
            case 'ratingHighToLow':
                sortQuery = { rating: -1 };
                break;
            case 'newArrivals':
                sortQuery = { createdAt: -1 };
                break;
            default:
                sortQuery = { createdAt: -1 };
        }

        // Fetch products
        const products = await Product.find(filter)
            .populate({
                path: 'categoriesId',
                match: { isActive: true }
            })
            .sort(sortQuery)
            .skip(skip)
            .limit(limit);

        // Filter out products where category wasn't populated
        const filteredProducts = products.filter(product => product.categoriesId);

        // Get total count for pagination
        const totalProducts = await Product.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limit);

        // Process products
        const processedProducts = filteredProducts.map(product => ({
            ...product.toObject(),
            price: product.price,
            discountPrice: product.price // Set discount price same as regular price for now
        }));

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
            pagination: {
                currentPage: page,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            },
            title: 'Shop'
        });
    } catch (error) {
        console.error('Error in getShop:', error);
        if (req.xhr) {
            return res.status(500).json({ error: 'Failed to load products' });
        }
        res.status(500).render('user/shop', {
            products: [],
            pagination: {
                currentPage: 1,
                totalPages: 1,
                hasNextPage: false,
                hasPrevPage: false
            },
            title: 'Shop',
            error: 'Failed to load products'
        });
    }
};

export default {
    getHome,
    getShop,
}