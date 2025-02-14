import express from "express"
import path from 'path'
import {userRoutes} from './routes/userRoutes.js'
import {adminRoutes} from './routes/adminRoutes.js'
import connectDB from "./models/db.js"
import dotenv from "dotenv";
import session from "express-session";
// import { adminLogin } from "./controller/adminController.js";
import { errorHandler } from './middleware/errorMiddleware.js';
import cookieParser from 'cookie-parser';
import cors from 'cors'
import Admin from "./models/adminModels.js"





dotenv.config()

const app = express()

connectDB()



const initializeAdmin = async () => {
    await Admin.createDefaultAdmin();
};
initializeAdmin().catch(console.error);

// Add this before your routes
// app.use((req, res, next) => {
//     console.log('Request URL:', req.url);
//     console.log('Request Method:', req.method);
//     next();
// });




app.use(cors())

app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(errorHandler);
app.use(cookieParser());


app.use(session({
    secret :  process.env.SESSION_SECRET,
    resave : false,
    saveUninitialized : false,
    cookie : {
        secure:process.env.NODE_ENV === 'production',
        httpOnly:true,
        maxAge : 24*60*1000
    }
}))

app.set('views', './views');
app.set('view engine','ejs')
app.set('views',path.join(process.cwd(),'views'))
app.use(express.static(path.join(process.cwd(),'public')))


app.use('/user', userRoutes)
app.use('/admin',adminRoutes)
app.use('/',userRoutes)

app.listen(process.env.PORT,()=>{
    console.log("Server running at port ")
})
