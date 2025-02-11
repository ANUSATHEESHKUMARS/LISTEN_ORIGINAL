import express from 'express';
import { getLoginPage, getSignupPage } from '../controller/userController.js';

export const userRoutes = express.Router();


userRoutes.get('/login', getLoginPage);
 userRoutes.get('/signup', getSignupPage);

