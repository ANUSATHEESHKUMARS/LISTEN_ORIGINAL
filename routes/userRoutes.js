import {Router } from 'express'
import authController from '../controller/user/authController.js'
import userMiddlewares from '../middleware/userMiddleware.js'
import userController from '../controller/user/shopnhomeController.js';
import profileController from "../controller/user/profileController.js"
import addressController from '../controller/user/addressController.js';
import cartController from '../controller/user/cartController.js';
import checkoutController from '../controller/user/checkoutController.js';
import viewOrdersController from '../controller/user/viewOrdersController.js';
import wishlistController from '../controller/user/wishlistController.js'

const route = Router()



route.get('/', userController.getHome)

route.get('/check-session', (req, res) => {
  if (req.session.user) {
      res.json({ isLoggedIn: true, user: req.session.user });
  } else {
      res.json({ isLoggedIn: false });
  }
});

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

route.get('/about',authController.getabout)

// Add this new route for product details
route.get('/', (req, res) => {
    res.render('your-template', {
      user: req.session.user, // or however you store your user
      cartCount: req.session.cartCount // if you're tracking cart items
    });
  });
// // routes/productRoutes.js


route.get('/profile', userMiddlewares.checkSession, profileController.getProfile);

route.post('/profile/update', userMiddlewares.checkSession, profileController.updateProfile);


route.get('/address', userMiddlewares.checkSession, addressController.getAddress);

route.post('/address/add', userMiddlewares.checkSession, addressController.addAddress);

route.delete('/address/:id', userMiddlewares.checkSession, addressController.deleteAddress);

route.put('/address/:id', userMiddlewares.checkSession, addressController.editAddress);


//user cart
route.get("/cart", userMiddlewares.checkSession, cartController.getCart)

route.post("/cart/add", userMiddlewares.checkSession, cartController.addToCart)

route.patch("/cart/update-quantity", userMiddlewares.checkSession, cartController.updateQuantity)

route.delete("/cart/remove/:productId", userMiddlewares.checkSession, cartController.removeFromCart)


route.get("/checkout", userMiddlewares.checkSession, checkoutController.getCheckoutPage)

route.post("/checkout/place-order", userMiddlewares.checkSession, checkoutController.placeOrder)


route.get("/orders", userMiddlewares.checkSession, viewOrdersController.getOrders)

route.patch("/orders/:orderId/items/:productId/cancel", userMiddlewares.checkSession , viewOrdersController.cancelOrder)

route.post("/orders/:orderId/items/:productId/return", userMiddlewares.checkSession, viewOrdersController.requestReturnItem)


route.get('/wishlist', userMiddlewares.checkSession, wishlistController.getWishlist);

route.post('/wishlist/add', userMiddlewares.checkSession, wishlistController.addToWishlist);

route.delete('/wishlist/remove/:productId', userMiddlewares.checkSession, wishlistController.removeFromWishlist);

route.get('/wishlist/check/:productId', userMiddlewares.checkSession, wishlistController.checkWishlistStatus);


export default route;