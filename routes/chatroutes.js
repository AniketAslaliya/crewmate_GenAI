import { Router } from "express";

import { uploadDocument, deleteChat, getUserChats, getChatbyId, updateChatSummary } from "../controllers/chatController.js";
import { createGeneralChat, askGeneral, saveGeneralChat } from "../controllers/generalAskController.js";
import authMiddleware from "../middlewares/auth.js";
const router = Router();

router.patch("/chats/:id/summary", authMiddleware, updateChatSummary);


  router.post("/uploaddoc", authMiddleware, uploadDocument);
  router.delete("/delete/:id", authMiddleware, deleteChat);
  router.get("/getallchats", authMiddleware, getUserChats);
  router.get("/getchat/:id", authMiddleware, getChatbyId);
  // General Ask endpoints (persisted chat + KB answer)
  router.post('/general-ask/create', authMiddleware, createGeneralChat);
  router.post('/general-ask', authMiddleware, askGeneral);
  router.post('/general-ask/rename', authMiddleware, (req, res, next) => {
    import('../controllers/generalAskController.js').then(m => m.renameGeneralChat(req, res)).catch(next);
  });
  router.post('/general-ask/save', authMiddleware, saveGeneralChat);
  router.get('/general-ask/list', authMiddleware, (req, res, next) => {
    // lazy require to avoid circulars in some environments
    import('../controllers/generalAskController.js').then(m => m.listGeneralChats(req, res)).catch(next);
  });
export default router;