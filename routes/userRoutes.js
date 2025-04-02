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
import walletController from '../controller/user/walletController.js';
import couponController from '../controller/user/couponController.js';
import productController from '../controller/user/productController.js';


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

route.post('/send-forgot-password-otp', authController.sendForgotPasswordOTP);

route.post('/verify-forgot-password-otp', authController.verifyForgotPasswordOTP);

route.post('/reset-password', authController.resetPassword);

route.get('/change-password', userMiddlewares.checkSession, authController.getChangePassword);

route.post('/change-password', userMiddlewares.checkSession, authController.postChangePassword);

route.get('/auth/google', authController.getGoogle);

route.get('/auth/google/callback' , authController.getGoogleCallback)

route.get('/shop', userController.getShop);

route.get('/logout', userMiddlewares.checkSession, authController.getLogout);

route.get('/about',authController.getabout)


route.get('/', (req, res) => {
    res.render('your-template', {
      user: req.session.user, // or however you store your user
      cartCount: req.session.cartCount // if you're tracking cart items
    });
  });
// // routes/productRoutes.js


route.get('/profile', userMiddlewares.checkSession, profileController.getProfile);

route.post('/profile/update', userMiddlewares.checkSession, profileController.updateProfile);

route.post('/profile/initiate-email-change', profileController.initiateEmailChange);

route.post('/profile/verify-email-otp', profileController.verifyEmailOTP);

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

route.get("/checkout/available-coupons", userMiddlewares.checkSession, checkoutController.getAvailableCoupons)

route.post("/checkout/apply-coupon", userMiddlewares.checkSession, checkoutController.applyCoupon)

route.post("/checkout/remove-coupon", userMiddlewares.checkSession, checkoutController.removeCoupon)

route.get("/orders", userMiddlewares.checkSession, viewOrdersController.getOrders)

route.post("/orders/:orderId/items/:productId/cancel", userMiddlewares.checkSession, viewOrdersController.cancelOrder)

route.post("/orders/:orderId/items/:productId/return", userMiddlewares.checkSession, viewOrdersController.requestReturnItem)

route.get('/orders/:orderId/invoice', userMiddlewares.checkSession, viewOrdersController.generateInvoice);

route.post('/orders/:orderId/cancel/:productId', userMiddlewares.checkSession, viewOrdersController.cancelOrder);




route.get('/wishlist', userMiddlewares.checkSession, wishlistController.getWishlist);

route.post('/wishlist/add', userMiddlewares.checkSession, wishlistController.addToWishlist);

route.delete('/wishlist/remove/:productId', userMiddlewares.checkSession, wishlistController.removeFromWishlist);

route.get('/wishlist/check/:productId', userMiddlewares.checkSession, wishlistController.checkWishlistStatus);

route.post('/wishlist/toggle', userMiddlewares.checkSession, wishlistController.toggleWishlist);



route.post('/checkout/create-razorpay-order', userMiddlewares.checkSession, checkoutController.createRazorpayOrder);

route.post('/checkout/verify-payment', userMiddlewares.checkSession, checkoutController.verifyPayment);



route.get("/wallet",userMiddlewares.checkSession,walletController.getWallet)

route.post("/checkout/wallet-payment",userMiddlewares.checkSession,checkoutController.walletPayment)

route.get("/coupons",userMiddlewares.checkSession ,couponController.getCoupons)

route.get('/order-success', checkoutController.getOrderSuccessPage);

route.get('/product/:id', productController.getProductDetails);

route.get('/contact',authController.getContact)

route.post('/wallet/recharge', walletController.initiateRecharge);
route.post('/wallet/verify-recharge', walletController.verifyRecharge);

export default route;