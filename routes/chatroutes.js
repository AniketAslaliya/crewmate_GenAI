import { Router } from "express";

import multer from 'multer';
import { uploadDocument, deleteChat, getUserChats, getChatbyId, updateChatSummary, saveChatRisk, getChatDownload } from "../controllers/chatController.js";
import { createGeneralChat, askGeneral, saveGeneralChat } from "../controllers/generalAskController.js";
import authMiddleware from "../middlewares/auth.js";
const upload = multer(); // memory storage
const router = Router();

router.patch("/chats/:id/summary", authMiddleware, updateChatSummary);
router.patch('/chats/:id', authMiddleware, (req, res, next) => {
  import('../controllers/chatController.js').then(m => m.updateChatMeta(req, res)).catch(next);
});


  router.post("/uploaddoc", authMiddleware, upload.single('file'), uploadDocument);
  router.delete("/delete/:id", authMiddleware, deleteChat);
  router.get("/getallchats", authMiddleware, getUserChats);
  router.get("/getchat/:id", authMiddleware, getChatbyId);
  router.post('/chats/:id/risk', authMiddleware, saveChatRisk);
  router.get('/chats/:id/download', authMiddleware, getChatDownload);
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