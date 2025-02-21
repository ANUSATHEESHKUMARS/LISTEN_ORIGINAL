import { startOfYear, endOfYear, eachMonthOfInterval, format } from 'date-fns';
import Order from '../../models/categoryModels.js';  
import Category from '../../models/categoryModels.js';  



const  getDashboard = async (req,res)=>{
    res.render('admin/dashboard')

}

export default {
    getDashboard
}
