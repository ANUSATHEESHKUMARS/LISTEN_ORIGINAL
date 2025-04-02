import express from "express";
import path from "path";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import connectDB from "./models/db.js";
import dotenv from "dotenv";
import session from "express-session";
import cookieParser from "cookie-parser";
import cors from "cors";
import Admin from "./models/adminModels.js";
import nocache from "nocache";
import errorHandler from "./middleware/errorMiddleware.js";
import initializeCategories from "./utils/initCategories.js";
import passport from "./config/passport.js";
import morgan from "morgan";
import helmet from "helmet";

dotenv.config();

const app = express();

// Basic middleware
app.use(cors());
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(errorHandler);
app.use(cookieParser());
app.use(nocache());
app.use(morgan("dev"));

// View engine setup
app.set("views", path.join(process.cwd(), "views"));
app.set("view engine", "ejs");

// Create separate session middlewares for admin and user
const userSession = session({
    name: 'user_sid', // Different cookie name for user
    secret: process.env.USER_SESSION_SECRET || process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days for users
    }
});

const adminSession = session({
    name: 'admin_sid', // Different cookie name for admin
    secret: process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 12 * 60 * 60 * 1000 // 12 hours for admin
    }
});

// Apply sessions based on route
app.use('/admin', adminSession);
app.use(['/user', '/'], userSession);

// Initialize passport after sessions
app.use(passport.initialize());
app.use(passport.session());

// Static files
app.use(express.static(path.join(process.cwd(), "public")));

// Database and initial setup
connectDB();
const initializeAdmin = async () => {
    await Admin.createDefaultAdmin();
};
initializeAdmin().catch(console.error);
initializeCategories();

// Routes with their respective sessions
app.use("/admin", adminRoutes);
app.use("/user", userRoutes);
app.use("/", userRoutes);

// 404 handler
app.use("*", (req, res) => {
    res.status(404).render("partials/error");
});

app.listen(process.env.PORT, () => {
    console.log(`Server running at port ${process.env.PORT}`);
});
