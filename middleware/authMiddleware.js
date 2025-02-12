import asyncHandler from 'express-async-handler';

export const adminAuth = asyncHandler(async (req, res, next) => {
    if (!req.session.adminId || !req.session.isAdmin) {
        // Change this line
        return res.redirect('/admin/login'); // Instead of res.render('/admin/login')
    }
    next();
});
export const isLoggedIn = asyncHandler(async (req, res, next) => {
    if (req.session.adminId && req.session.isAdmin) {
        return res.redirect('/admin/dashboard');
    }
    next();
});