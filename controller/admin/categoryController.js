import Category from '../../models/categoryModels.js';
import Offer from '../../models/offerModel.js';
import Product from '../../models/productModel.js';

const categoryController = {
    // Get all categories
    getCategories: async (req, res) => {
        try {
            const categories = await Category.find()
                .sort({ createdAt: -1 })
                .lean();

            // Get product count for each category
            for (let category of categories) {
                category.productCount = await Product.countDocuments({
                    categoriesId: category._id,
                    isActive: true
                });
            }

            res.render('admin/categories', { categories });
        } catch (error) {
            console.error('Error fetching categories:', error);
            res.status(500).render('admin/error', {
                message: 'Error loading categories',
                error: error.message
            });
        }
    },

    // Add new category
    addCategory: async (req, res) => {
        try {
            const { categoryName, categoryDescription, type } = req.body;

            // Validate input
            if (!categoryName || !categoryDescription || !type) {
                return res.status(400).json({
                    success: false,
                    message: 'Category name, description, and type are required'
                });
            }

            // Check if category already exists
            const existingCategory = await Category.findOne({ 
                name: categoryName.trim() 
            });

            if (existingCategory) {
                return res.status(400).json({
                    success: false,
                    message: 'Category already exists'
                });
            }

            // Create new category
            const newCategory = new Category({
                name: categoryName.trim(),
                description: categoryDescription.trim(),
                type: type
            });

            await newCategory.save();

            res.status(200).json({
                success: true,
                message: 'Category added successfully'
            });
        } catch (error) {
            console.error('Error adding category:', error);
            res.status(500).json({
                success: false,
                message: 'Error adding category'
            });
        }
    },

    // Edit category
    editCategory: async (req, res) => {
        try {
            const { categoryId, categoryName, categoryDescription } = req.body;

            // Validate input
            if (!categoryId || !categoryName || !categoryDescription) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid input data'
                });
            }

            // Check if category exists
            const existingCategory = await Category.findById(categoryId);
            if (!existingCategory) {
                return res.status(404).json({
                    success: false,
                    message: 'Category not found'
                });
            }

            // Update category
            existingCategory.name = categoryName.trim();
            existingCategory.description = categoryDescription.trim();
            await existingCategory.save();

            res.status(200).json({
                success: true,
                message: 'Category updated successfully'
            });
        } catch (error) {
            console.error('Error updating category:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating category'
            });
        }
    },

    // Toggle category status
    toggleCategory: async (req, res) => {
        try {
            const { id } = req.query;
            const category = await Category.findById(id);

            if (!category) {
                return res.status(404).json({
                    success: false,
                    message: 'Category not found'
                });
            }

            category.isActive = !category.isActive;
            await category.save();

            res.status(200).json({
                success: true,
                message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`
            });
        } catch (error) {
            console.error('Error toggling category:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating category status'
            });
        }
    },

    // Get category offers
    getCategoryOffers: async (req, res) => {
        try {
            const { id } = req.params;
            const offers = await Offer.find({ 
                categoryId: id,
                status: 'active'
            });

            res.json({
                success: true,
                offers
            });
        } catch (error) {
            console.error('Error fetching category offers:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching offers'
            });
        }
    },

    // Add category offer
    addCategoryOffer: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, discount, startDate, endDate } = req.body;

            // Validate input
            if (!name || !discount || !startDate || !endDate) {
                return res.status(400).json({
                    success: false,
                    message: 'All fields are required'
                });
            }

            // Create new offer
            const offer = new Offer({
                name,
                type: 'category',
                categoryId: id,
                discount,
                startDate,
                endDate,
                status: 'active'
            });

            await offer.save();

            res.json({
                success: true,
                message: 'Offer added successfully',
                offer
            });
        } catch (error) {
            console.error('Error adding category offer:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Error adding offer'
            });
        }
    }
};

export default categoryController;

