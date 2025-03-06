import express from "express";
import path from "path";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import productRoutes from "./routes/productRoutes.js";
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
import csurf from "csurf";

dotenv.config();

const app = express();

connectDB();

const initializeAdmin = async () => {
  await Admin.createDefaultAdmin();
};
initializeAdmin().catch(console.error);

initializeCategories();

app.use(cors());

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(errorHandler);
app.use(cookieParser());
app.use(nocache());

app.use(morgan("dev"));

app.set("views", "./views");
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite : "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

const csrfProtection = csurf({
    cookie: {
      httpOnly: true, // CSRF cookie should not be accessible via JS
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
    },
  });
app.use(csrfProtection);

app.use((req, res, next) => {
    res.cookie("XSRF-TOKEN", req.csrfToken(), {
      httpOnly: false, 
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
    });
    res.locals.csrfToken = req.csrfToken(); // Make available to EJS
    next();
  });


app.use(express.static(path.join(process.cwd(), "public")));

app.use("/user", userRoutes);
app.use("/admin", adminRoutes);
app.use("/", productRoutes);
app.use("/", userRoutes);

app.use("*", (req, res) => {
  res.status(404).render("partials/error");
});

app.listen(process.env.PORT, () => {
  console.log("Server running at port ");
});
