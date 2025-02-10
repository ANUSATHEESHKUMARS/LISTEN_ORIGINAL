import express from "express"

import path from 'path'
import {userRoutes} from './routes/userRoutes.js'
import connectDB from "./models/db.js"
import dotenv from "dotenv";


dotenv.config()

const app = express()

connectDB()
app.set('views', './views');

app.use('/user', userRoutes);
app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.set('view engine','ejs')
app.set('views',path.join(process.cwd(),'views'))
app.use(express.static(path.join(process.cwd(),'public')))

app.use('/user',userRoutes)


app.listen(process.env.PORT,()=>{
    console.log("the server is runnning ")
})
