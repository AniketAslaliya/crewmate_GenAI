import express, { json } from "express";
import passport from "passport"; // <-- change this line
import cookieParser from "cookie-parser";
import cors from "cors";
import { config } from "dotenv";
config();
import connectDB from "./config/db.js";
import "./config/passport.js";
import session from "express-session";
import authRoutes from "./routes/routes.js";
import chatRoutes from "./routes/chatroutes.js";
import messageRoutes from "./routes/messageroutes.js";
const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.use(json());
app.use(cookieParser());
app.use(passport.initialize()); // <-- change this line

app.use("/auth", authRoutes);
app.use("/api",chatRoutes);
app.use("/api/messages", messageRoutes);
app.get("/", (req, res) => res.json({ ok: true }));

connectDB().then(() => {
  app.listen(process.env.PORT, () => {
    console.log(`http://localhost:${process.env.PORT}`);
  });
});
