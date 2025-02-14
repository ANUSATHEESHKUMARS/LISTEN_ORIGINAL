import Admin from '../models/adminModels.js';
import bcrypt from 'bcrypt';
import asyncHandler from 'express-async-handler';

export const Login = (req,res)=>{
    res.render('adminpage/login', { error: null });
};

export const isAdmin = async (req, res, next) => {
    if (!req.session.adminId) {
        return res.redirect('/adminPage/login');
    }
    
    try {
        const admin = await Admin.findById(req.session.adminId);
        if (!admin) {
            return res.redirect('/adminPage/login');
        }
        
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.redirect('/admin/login');
    }
};

export const adminLogin = asyncHandler(async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both email and password'
            });
        }

        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Set session data
        req.session.adminId = admin._id;
        req.session.adminEmail = admin.email;
        req.session.isAdmin = true;

        // Force session save
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Error creating session'
                });
            }

            console.log('Session after login:', req.session); // Debug log
            
            res.status(200).json({
                success: true,
                message: 'Login successful'
            });
        });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred during login'
        });
    }
});

export const adminAuth = asyncHandler(async (req, res, next) => {
    if (!req.session.adminId || !req.session.isAdmin) {
        return res.render('/admin/login');
    }
    next();
});
export const isLoggedIn = asyncHandler(async (req, res, next) => {
    if (req.session.adminId && req.session.isAdmin) {
        return res.redirect('/admin/dashboard');
    }
    next();
});

// export const adminLogout = (req, res) => {
//     req.session.destroy();
//     res.json({ success: true });
// };
export const adminLogout = asyncHandler(async (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({
                success: false,
                message: 'Error during logout'
            });
        }
        res.clearCookie('connect.sid');
        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    });
});
export const renderDashboard = (req, res) => {
    // Change this line
    res.render('admin/dashboard'); // Instead of 'adminPage/dashboard'
};

export const getRecentOrders = async (req, res) => {
    try {
        // Implement order fetching logic
        const orders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(10);
        
        res.json(orders);
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
};

export const getDashboardStats = async (req, res) => {
    try {
        // Implement stats calculation logic
        const stats = {
            totalUsers: await User.countDocuments(),
            totalOrders: await Order.countDocuments(),
            revenue: await calculateRevenue(),
            totalProducts: await Product.countDocuments()
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
};




// Get all customers with pagination
export const getCustomers = asyncHandler(async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = 10;
        const skip = (page - 1) * itemsPerPage;

        // Get total count for pagination
        const totalUsers = await User.countDocuments({ role: 'user' });
        const totalPages = Math.ceil(totalUsers / itemsPerPage);

        // Get users for current page
        const users = await User.find({ role: 'user' })
            .select('-password -__v')
            .skip(skip)
            .limit(itemsPerPage)
            .lean();

        res.render('admin/customers', {
            users,
            currentPage: page,
            totalPages,
            itemsPerPage,
            totalUsers
        });

    } catch (error) {
        console.error('Error in getCustomers:', error);
        res.status(500).render('admin/error', {
            message: 'Error loading customers page'
        });
    }
});

// Block a user
export const blockUser = asyncHandler(async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        if (user.role === 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Cannot block an admin user'
            });
        }

        user.isBlocked = true;
        await user.save();

        res.status(200).json({
            status: 'success',
            message: 'User blocked successfully'
        });

    } catch (error) {
        console.error('Error in blockUser:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to block user'
        });
    }
});

// Unblock a user
export const unblockUser = asyncHandler(async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        user.isBlocked = false;
        await user.save();

        res.status(200).json({
            status: 'success',
            message: 'User unblocked successfully'
        });

    } catch (error) {
        console.error('Error in unblockUser:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to unblock user'
        });
    }
});

// Search customers
export const searchCustomers = asyncHandler(async (req, res) => {
    try {
        const { query } = req.query;
        
        if (!query) {
            return res.status(400).json({
                status: 'error',
                message: 'Search query is required'
            });
        }

        const users = await User.find({
            role: 'user',
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } },
                { mobile: { $regex: query, $options: 'i' } },
                { address: { $regex: query, $options: 'i' } }
            ]
        })
        .select('-password -__v')
        .lean();

        res.status(200).json({
            status: 'success',
            users,
            count: users.length
        });

    } catch (error) {
        console.error('Error in searchCustomers:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error searching customers'
        });
    }
});

// Get customer details
export const getCustomerDetails = asyncHandler(async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId)
            .select('-password -__v')
            .lean();

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        res.status(200).json({
            status: 'success',
            user
        });

    } catch (error) {
        console.error('Error in getCustomerDetails:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching customer details'
        });
    }
});

// Update customer status
export const updateCustomerStatus = asyncHandler(async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.body;

        if (!['Active', 'Blocked'].includes(status)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid status value'
            });
        }

        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        user.isBlocked = status === 'Blocked';
        await user.save();

        res.status(200).json({
            status: 'success',
            message: `User ${status.toLowerCase()} successfully`
        });

    } catch (error) {
        console.error('Error in updateCustomerStatus:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error updating customer status'
        });
    }
});

// Export all customers data (for reports)
export const exportCustomersData = asyncHandler(async (req, res) => {
    try {
        const users = await User.find({ role: 'user' })
            .select('-password -__v')
            .lean();

        const csvData = users.map(user => ({
            ID: user._id,
            Name: user.name,
            Email: user.email,
            Mobile: user.mobile,
            Address: user.address,
            Status: user.isBlocked ? 'Blocked' : 'Active',
            'Joined Date': new Date(user.createdAt).toLocaleDateString()
        }));

        res.status(200).json({
            status: 'success',
            data: csvData
        });

    } catch (error) {
        console.error('Error in exportCustomersData:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error exporting customers data'
        });
    }
});