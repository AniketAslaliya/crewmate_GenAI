import { Router } from "express";
import { sendMessage, getMessagesByChat } from "../controllers/messageController.js";
import authMiddleware from "../middlewares/auth.js";

const router = Router();

// Send a new message
router.post("/", authMiddleware, sendMessage);

// Get all messages for a chat by chat ID
router.get("/:chatId", authMiddleware, getMessagesByChat);

export default router;
