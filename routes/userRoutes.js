import express from 'express';
import {
     getLoginPage,
      getSignupPage,
      userHome,
      verifyOTP,
      resendOTP,
      signUp,
      
     
    } from '../controller/userController.js';

export const userRoutes = express.Router();

userRoutes.get('/signup', getSignupPage)
userRoutes.get('/login', getLoginPage)
userRoutes.get('/',userHome)

userRoutes.post('/signup',signUp)
userRoutes.post('/verify-otp',verifyOTP)
userRoutes.post('resend-otp',resendOTP)


// userRoutes.get('/login', getLoginPage);
//  userRoutes.get('/signup', getSignupPage);

//  router.post('/userPage/verify-otp', verifyOTP);
//  router.post('/userPage/resend-otp', resendOTP);

