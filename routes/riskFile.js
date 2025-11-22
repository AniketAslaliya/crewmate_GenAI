import { Router } from 'express';
import multer from 'multer';
import authMiddleware from '../middlewares/auth.js';
import { uploadRiskDoc } from '../controllers/riskFileController.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/risk-file/upload-risk-doc
router.post('/upload-risk-doc', authMiddleware, upload.single('file'), uploadRiskDoc);

export default router;
