

import User from '../models/userModels.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';



// Render signup page
export const renderSignup = (req, res) => {
    res.render('userPage/signup', { error: null });
};

// Handle signup
export const signup = async (req, res) => {
    try {
        const { name, email, mobile, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [{ email }, { mobile }] 
        });

        if (existingUser) {
            return res.render('signup', { 
                error: 'Email or mobile already registered' 
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        const user = new User({
            name,
            email,
            mobile,
            password: hashedPassword
        });

        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });

        res.redirect('/dashboard');

    } catch (error) {
        res.render('signup', { 
            error: 'Something went wrong. Please try again.' 
        });
    }
};

// Handle login
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.render('login', { 
                error: 'Invalid email or password' 
            });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.render('login', { 
                error: 'Invalid email or password' 
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });

        res.redirect('/dashboard');

    } catch (error) {
        res.render('login', { 
            error: 'Something went wrong. Please try again.' 
        });
    }
};

// Handle logout
export const logout = (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
};


export const getLoginPage = (req, res) => {
    res.render('userPage/login');
};


export const getSignupPage = (req, res) => {
    res.render('userPage/signup');  
};

export const getForgotPasswordPage = (req, res) => {
    res.render('userPage/forgot-password');
};

export const handleLogin = (req, res) => {
    // Handle login form submission
    const { email, password } = req.body;
    // Add your login logic here
};

export const handleSignup = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create new user
        const user = await User.create({
//             name,
            email,
            password,
            phone
        });

        // You might want to create a JWT token here
        res.status(201).json({ 
            message: 'User created successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        res.status(500).json({ 
            message: 'Error creating user',
            error: error.message 
        });
    }
};


export const handleForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate password reset token
        // Send email with reset instructions
        // You'll need to implement this part

        res.status(200).json({ 
            message: 'Password reset instructions sent to email' 
        });

    } catch (error) {
        res.status(500).json({ 
            message: 'Error processing request',
            error: error.message 
        });
    }
};




