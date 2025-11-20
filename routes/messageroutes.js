import { Router } from "express";
import { sendMessage, getMessagesByChat } from "../controllers/messageController.js";
import authMiddleware from "../middlewares/auth.js";
import multer from 'multer';

const router = Router();

// Configure multer for file upload (max 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Send a new message (with optional file attachment)
router.post("/", authMiddleware, upload.single('file'), sendMessage);

// Get all messages for a chat by chat ID
router.get("/:chatId", authMiddleware, getMessagesByChat);

export default router;
