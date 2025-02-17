import express from 'express';
import authController from '../controller/admin/authController.js';
import adminMiddleware from '../middleware/adminMiddleware.js';
import userController from '../controller/admin/userController.js';
import dashboardController from '../controller/admin/dashboardController.js';
import categoryController from '../controller/admin/categoryController.js';
import productController from '../controller/admin/productController.js';


const router = express.Router();


router.get('/login', authController.getAdmin);

router.post('/login', authController.postAdmin);

router.get('/dashboard', adminMiddleware.checkSession, dashboardController.getDashboard);

router.get('/dashboard/data', adminMiddleware.checkSession, dashboardController.getDashboardData);

router.get('/logout', adminMiddleware.checkSession, authController.getLogout);

// User listing Routes

router.get('/userList', adminMiddleware.checkSession, userController.getUserList)

router.post('/user/:id/toggle-block', adminMiddleware.checkSession, userController.getToggle);

// Category Routes

router.get('/category', adminMiddleware.checkSession, categoryController.getCategories);

router.post('/category/add', adminMiddleware.checkSession, categoryController.addCategory);

router.post('/category/edit', adminMiddleware.checkSession, categoryController.editCategory);

router.get('/category/toggle', adminMiddleware.checkSession, categoryController.toggleCategory);

// Product Routes


router.get('/product', adminMiddleware.checkSession,productController.renderProductPage);

router.post('/product/add', adminMiddleware.checkSession, productController.addProduct);

router.get('/product/:id', adminMiddleware.checkSession, productController.getProductDetails);

router.post('/product/edit/:id', adminMiddleware.checkSession, productController.updateProduct);

router.post('/product/delete/:id', adminMiddleware.checkSession, productController.deleteProduct);

router.post('/product/toggle-status/:id', adminMiddleware.checkSession, productController.toggleProductStatus);


export default router;
