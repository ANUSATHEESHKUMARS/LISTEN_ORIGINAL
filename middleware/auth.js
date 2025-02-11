import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

export const isAuth = async (req, res, next) => {
    try {
        const token = req.cookies.token;

        if (!token) {
            return res.redirect('/login');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.redirect('/login');
        }

        req.user = user;
        next();
    } catch (error) {
        res.redirect('/login');
    }
};

export const isGuest = (req, res, next) => {
    const token = req.cookies.token;
    if (token) {
        return res.redirect('/dashboard');
    }
    next();
};