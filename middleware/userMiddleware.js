import userModel from "../models/userModels.js"

const checkSession = async (req, res, next) => {
    try {
        // Check if session exists
        if (!req.session.user) {
            return res.redirect('/login?message=Please+login+to+continue&alertType=info');
        }

        // Verify user exists and is active
        const user = await userModel.findById(req.session.user);
        
        if (!user) {
            // User no longer exists
            req.session.destroy();
            return res.redirect('/login?message=Account+not+found&alertType=error');
        }

        if (user.blocked) {
            // User is blocked
            req.session.destroy();
            return res.redirect('/login?message=Your+account+has+been+blocked&alertType=error');
        }

        // Attach user to response locals for views
        res.locals.user = user;
        next();

    } catch (error) {
        console.error('Session Check Error:', error);
        return res.redirect('/login?message=Session+error+occurred&alertType=error');
    }
}

const isLogin = async (req, res, next) => {
    try {
        if (req.session.user) {
            return res.redirect('/home');
        }
        // Clear user from response locals
        res.locals.user = null;
        next();
    } catch (error) {
        console.error('Login Check Error:', error);
        res.locals.user = null;
        next();
    }
}

// Add new middleware to attach user to all routes
const attachUser = async (req, res, next) => {
    try {
        if (req.session.user) {
            const user = await userModel.findById(req.session.user);
            res.locals.user = user || null;
        } else {
            res.locals.user = null;
        }
        next();
    } catch (error) {
        console.error('Attach User Error:', error);
        res.locals.user = null;
        next();
    }
}

export default { 
    isLogin, 
    checkSession,
    attachUser
}