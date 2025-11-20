import express, { json } from "express";
import passport from "passport";
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
import lawyersRouter from "./routes/lawyers.js";
import formsRouter from "./routes/forms.js";
import adminRouter from "./routes/admin.js";
import http from "http";
import { Server } from "socket.io";
import crypto from "crypto";
import { Message } from "./models/Message.js";

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
app.use(passport.initialize());

app.use("/auth", authRoutes);
app.use("/api", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/lawyers", lawyersRouter);
app.use("/api/forms", formsRouter);
app.use("/api/admin", adminRouter);
app.get("/", (req, res) => res.json({ ok: true }));

// Message encryption helper (same logic as messageController)
const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;
const SECRET_KEY = crypto.createHash("sha256").update(process.env.SECRET_KEY || "default-secret-key").digest();
const encrypt = (text) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
};
const decrypt = (encryptedText) => {
  const [ivHex, encrypted] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};

connectDB().then(() => {
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // expose io on the app so controllers can emit events on REST paths
  app.set('io', io);

  io.on("connection", (socket) => {
    console.log("socket connected:", socket.id);

    socket.on("join", (chatId) => {
      socket.join(chatId);
      console.log(`socket ${socket.id} joined ${chatId}`);
    });

    socket.on("leave", (chatId) => {
      socket.leave(chatId);
    });

    socket.on("send_message", async (data) => {
      try {
        const { chatId, content, userId, role, clientTempId } = data;
        if (!chatId || !content || !userId) return;
        const encrypted = encrypt(content);
        const message = new Message({ chat: chatId, user: userId, role, content: encrypted });
        await message.save();

        const payload = {
          _id: message._id,
          chat: chatId,
          user: userId,
          role,
          content: content, // send decrypted content to clients
          createdAt: message.createdAt,
        };

        // If the client provided a temp id, echo it back so the client can reconcile
        if (clientTempId) payload.clientTempId = clientTempId;

        io.to(chatId).emit("new_message", payload);
      } catch (err) {
        console.error("socket send_message error:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log("socket disconnected", socket.id);
    });
  });

  server.listen(process.env.PORT, () => {
    console.log(`http://localhost:${process.env.PORT}`);
  });
});
