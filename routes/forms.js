import { Router } from 'express';
import multer from 'multer';
import { extractFields, fillForm } from '../controllers/pdfFormController.js';

const upload = multer(); // memory storage
const router = Router();

// POST /api/forms/extract -> returns { fields: [name, ...] }
router.post('/extract', upload.single('file'), extractFields);

// POST /api/forms/fill -> accepts file + values(JSON) and returns filled PDF
router.post('/fill', upload.single('file'), fillForm);

export default router;
