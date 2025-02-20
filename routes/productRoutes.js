import express from 'express';
import { getProductDetails } from '../controller/user/productViewController.js';  // Fix path and add .js

const router = express.Router();

router.get('/product/:id', getProductDetails);

export default router;