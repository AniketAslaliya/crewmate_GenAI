import { Router } from "express";

import { uploadDocument, deleteChat, getUserChats,getChatbyId} from "../controllers/chatController.js";
import authMiddleware from "../middlewares/auth.js";
const router = Router();


  router.post("/uploaddoc", authMiddleware, uploadDocument);
  router.delete("/delete/:id", authMiddleware, deleteChat);
  router.get("/getallchats", authMiddleware, getUserChats);
  router.get("/getchat/:id", authMiddleware, getChatbyId);
export default router;