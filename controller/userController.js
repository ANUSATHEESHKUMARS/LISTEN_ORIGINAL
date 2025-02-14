
import User from '../models/userModels.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';


export const userHome = (req,res) =>{
    res.render('userPage/home',{error:null})
}
// Render signup page
export const renderSignup = (req, res) => {
    res.render('userPage/signup', { error: null });
};

// Handle signup
export const signUp = async (req, res) => {
    try {
        const { name, email, mobile, password } = req.body;
        console.log(req.body);
        

        // Check if user exists
        const existingUser = await User.findOne({ 
            $or: [{ email }, { mobile }] 
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email or mobile already registered'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Generate OTP
        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Create new user with pending verification
        const user = new User({
            name,
            email,
            mobile,
            password: hashedPassword,
            isVerified: false,
            otp: {
                code: otp,
                expiry: otpExpiry
            }
        });

        await user.save();

        // Send OTP
        await sendOTP(email, otp);

        // Store email in session
        req.session.tempEmail = email;

        res.status(200).json({
            success: true,
            message: 'OTP sent successfully'
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred during signup'
        });
    }
};  

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.render('userPage/login', { 
                error: 'Invalid email or password' 
            });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.render('userPage/login', { 
                error: 'Invalid email or password' 
            });
        }

        // Set session data
        req.session.user = {
            id: user._id,
            name: user.name,
            email: user.email
        };

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

        // Redirect to home landing
        res.redirect('/userPage/homeLanding');

    } catch (error) {
        console.error('Login error:', error);
        res.render('userPage/login', { 
            error: 'Something went wrong. Please try again.' 
        });
    }
};
// Handle logout
export const logout = (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
};


export const isAuthenticated = (req, res, next) => {
    try {
        // Check for token in cookies
        const token = req.cookies.token;
        
        if (!token) {
            return res.redirect('/user/login');
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Add user data to request
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Auth error:', error);
        res.redirect('/user/login');
    }
};
export const getHomeLanding = async (req,res)=>{
    try{
        const user = await User.findById(req.user.id).select('-password')
        if(!user){
            return res.redirect('userPage/login')
        }
        const recendProduct = await Product.find().limit(4);
        res.render('userPage/homeLanding',{
            user : {
                name : user.name,
                email:user.email,


            },
            Products : recendProduct,
            error : null
        })

    }catch(error){
        console.error('Home landing error:', error);
        res.render('userPage/homeLanding', {
            user: req.user,
            products: [],
            error: 'Error loading page data'
        });
    }

}

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

                        //email configuration
// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Generate OTP
function generateOTP() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Send OTP email
async function sendOTP(email, otp) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Verify Your Account',
        html: `
            <h1>Email Verification</h1>
            <p>Your OTP for account verification is: <strong>${otp}</strong></p>
            <p>This OTP will expire in 2 minutes.</p>
        `
    };

    await transporter.sendMail(mailOptions);
}

// Signup controller
export const signup = async (req, res) => {
    try {
        const { name, email, mobile, password } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ 
            $or: [{ email }, { mobile }] 
        });

        if (existingUser) {
            return res.render('signup', { 
                error: 'Email or mobile already registered' 
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate OTP
        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

        // Create user
        const user = new User({
            name,
            email,
            mobile,
            password: hashedPassword,
            otp: {
                code: otp,
                expiry: otpExpiry
            }
        });

        await user.save();
        await sendOTP(email, otp);

        // Store email in session for OTP verification
        req.session.userEmail = email;

        res.render('verifyOTP', { 
            email,
            error: null 
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.render('signup', { 
            error: 'An error occurred during signup' 
        });
    }
};

// Verify OTP controller
// Update the verifyOTP function
export const verifyOTP = async (req, res) => {
    try {
        const email = req.session.tempEmail;
        const { otp } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Session expired. Please signup again.'
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'User not found'
            });
        }

        if (Date.now() > user.otp.expiry) {
            return res.status(400).json({
                success: false,
                message: 'OTP has expired'
            });
        }

        if (user.otp.code !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP'
            });
        }

        // Verify user
        user.isVerified = true;
        user.otp = undefined;
        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // Set cookie and session
        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000
        });

        req.session.user = {
            id: user._id,
            name: user.name,
            email: user.email
        };

        res.status(200).json({
            success: true,
            message: 'Email verified successfully',
            redirectUrl: '/user/home-landing'
        });

    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred during verification'
        });
    }
};

// Resend OTP controller
export const resendOTP = async (req, res) => {
    try {
        const email = req.session.userEmail;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Generate new OTP
        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 2 * 60 * 1000);

        user.otp = {
            code: otp,
            expiry: otpExpiry
        };
        await user.save();
        await sendOTP(email, otp);

        res.json({
            success: true,
            message: 'OTP resent successfully'
        });

    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resend OTP'
        });
    }
};

