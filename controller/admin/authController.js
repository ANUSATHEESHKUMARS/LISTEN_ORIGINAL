import { config } from 'dotenv';

config()

const getAdmin = (req, res) => {
    res.render('admin/login');
}

const postAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Input validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid email address'
            });
        }

        // Check credentials against environment variables
        if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
            req.session.isAdmin = true;
            return res.json({
                success: true,
                message: 'Login successful',
                redirectUrl: '/admin/dashboard'
            });
        } else {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }
    } catch (error) {
        console.error('Admin login error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred during login',
// Remove this in production!
        });
    }
}

export const getLogout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Admin logout error:", err);
            return res.status(500).json({ message: "Logout failed" });
        }
        res.clearCookie('admin_sid'); // Clear only admin cookie
        res.redirect('/admin/login');
    });
}


export default { getAdmin, postAdmin, getLogout }
