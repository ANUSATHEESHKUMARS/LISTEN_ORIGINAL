import express from 'express'
import { adminLogin,  Login, renderDashboard, }from '../controller/adminController.js'


const adminRoutes = express.Router()
adminRoutes.get('/login',Login)
adminRoutes.post('/login',adminLogin)

// adminRoutes.get("/dashbord",(req,res)=>{return res.render('admin/dashbord')})
adminRoutes.get('/dashboard',renderDashboard)

export default adminRoutes