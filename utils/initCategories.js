import Category from '../models/categoryModels.js';

const initializeCategories = async () => {
    try {
        const categories = await Category.find();
        
        if (categories.length === 0) {
            // Add default categories
            const defaultCategories = [
                {
                    name: 'Wired Headphones',
                    description: 'Traditional headphones with cable connection',
                    isActive: true
                },
                {
                    name: 'Wireless Headphones',
                    description: 'Bluetooth-enabled wireless headphones',
                    isActive: true
                }
            ];

            await Category.insertMany(defaultCategories);
            console.log('Default categories initialized');
        }
    } catch (error) {
        console.error('Error initializing categories:', error);
    }
};

export default initializeCategories;