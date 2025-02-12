import Admin from '../models/adminModels.js';
import bcrypt from 'bcrypt';


export const Login = (req,res)=>{
    res.render('adminPage/login', { error: null });
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
export const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Set session
        req.session.adminId = admin._id;
        
        res.json({
            success: true,
            message: 'Login successful'
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.json({
            success: false,
            message: 'An error occurred'
        });
    }
};

export const adminLogout = (req, res) => {
    req.session.destroy();
    res.json({ success: true });
};

export const renderDashboard = (req, res) => {
    res.render('adminPage/dashboard');
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