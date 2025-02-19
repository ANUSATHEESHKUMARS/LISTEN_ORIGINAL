import {Router } from 'express'
import authController from '../controller/user/authController.js'
import userMiddlewares from '../middleware/userMiddleware.js'
import userController from '../controller/user/shopnhomeController.js';

const route = Router()



route.get('/', userController.getHome)

route.get('/home', userController.getHome);

route.get('/signup', userMiddlewares.isLogin, authController.getSignUp);

route.post('/signup', authController.postSignUp);

route.post('/validate-otp', authController.postOtp);

route.post('/resend-otp', authController.postResendOtp);

route.get('/login', userMiddlewares.isLogin, authController.getLogin);

route.post('/login', authController.postLogin);

route.get('/forgot-password', userMiddlewares.isLogin, authController.getForgotPassword);

route.post('/forgot-password/send-otp', authController.sendForgotPasswordOTP);

route.post('/forgot-password/verify-otp', authController.verifyForgotPasswordOTP);

route.post('/forgot-password/reset-password', authController.resetPassword);

route.get('/change-password', userMiddlewares.checkSession, authController.getChangePassword);

route.post('/change-password', userMiddlewares.checkSession, authController.postChangePassword);

route.get('/auth/google', authController.getGoogle);

route.get('/auth/google/callback' , authController.getGoogleCallback)

route.get('/shop', userController.getShop);

route.get('/logout', userMiddlewares.checkSession, authController.getLogout);



export default route;