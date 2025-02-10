import express from 'express';
import { getLoginPage } from '../controller/userController.js';

export const userRoutes = express.Router();

userRoutes.get('/login', getLoginPage);