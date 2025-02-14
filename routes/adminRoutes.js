

import express from 'express';
import { adminAuth } from '../middleware/authMiddleware.js';
import {
    Login,
    adminLogin,
    adminLogout,
    renderDashboard,
    getCustomers,
    blockUser,
    unblockUser,
    searchCustomers,
    getCustomerDetails,
    updateCustomerStatus,
    exportCustomersData,
    isAdmin
} from '../controller/adminController.js';

export const adminRoutes = express.Router();

// Public routes
adminRoutes.get('/login', Login);
adminRoutes.post('/login', adminLogin);
adminRoutes.get('/logout',adminLogout)

// Protected routes
adminRoutes.use(adminAuth);

adminRoutes.get('/logout', adminLogout);
adminRoutes.get('/dashboard', isAdmin , renderDashboard);
adminRoutes.get('/customers', getCustomers);
adminRoutes.patch('/block-user/:userId', blockUser);
adminRoutes.patch('/unblock-user/:userId', unblockUser);
adminRoutes.get('/search-customers', searchCustomers);
adminRoutes.get('/customer/:userId', getCustomerDetails);
adminRoutes.patch('/customer/:userId/status', updateCustomerStatus);
adminRoutes.get('/export-customers', exportCustomersData);

