import express from 'express';
import {
     getLoginPage,
      getSignupPage,
      userHome,
      verifyOTP,
      resendOTP,
      signUp,
      logout,
      
     
    } from '../controller/userController.js';

export const userRoutes = express.Router();

const isAuthenticated = (req, res, next) => {
  if (!req.session.user) {
      return res.redirect('/user/login');
  }
  next();
};

userRoutes.get('/signup', getSignupPage)
userRoutes.get('/login', getLoginPage)
userRoutes.get('/',userHome)
userRoutes.post('/login',getLoginPage)
userRoutes.post('/signup',signUp)
userRoutes.post('/verify-otp',verifyOTP)
userRoutes.post('resend-otp',resendOTP)
userRoutes.get('/home-landing', isAuthenticated, getLoginPage);
userRoutes.get('/logout',logout );

// userRoutes.get('/login', getLoginPage);
//  userRoutes.get('/signup', getSignupPage);

//  router.post('/userPage/verify-otp', verifyOTP);
//  router.post('/userPage/resend-otp', resendOTP);

