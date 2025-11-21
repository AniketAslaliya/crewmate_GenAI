import { Router } from 'express';
import multer from 'multer';
import { extractFields, fillForm } from '../controllers/pdfFormController.js';
import {
  uploadForm,
  saveAnalyzedFields,
  saveFilledValues,
  uploadFilledForm,
  listForms,
  getForm,
  deleteForm,
  downloadOriginalForm,
  downloadFilledForm,
  uploadFieldImage,
  deleteFieldImage
} from '../controllers/formStorageController.js';
import authMiddleware from '../middlewares/auth.js';

const upload = multer(); // memory storage
const router = Router();

// Legacy routes (keep for backward compatibility)
router.post('/extract', upload.single('file'), extractFields);
router.post('/fill', upload.single('file'), fillForm);

// Form storage routes with Dropbox
router.post('/upload', authMiddleware, upload.single('file'), uploadForm);
router.put('/:formId/fields', authMiddleware, saveAnalyzedFields);
router.put('/:formId/values', authMiddleware, saveFilledValues);
router.post('/:formId/upload-filled', authMiddleware, upload.single('file'), uploadFilledForm);
router.get('/list', authMiddleware, listForms);
router.get('/:formId', authMiddleware, getForm);
router.delete('/:formId', authMiddleware, deleteForm);
router.get('/:formId/download', authMiddleware, downloadOriginalForm);
router.options('/:formId/download', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(204).send();
});
router.get('/:formId/download-filled', authMiddleware, downloadFilledForm);

// Field image routes
router.post('/:formId/field/:fieldId/image', authMiddleware, upload.single('image'), uploadFieldImage);
router.delete('/:formId/field/:fieldId/image', authMiddleware, deleteFieldImage);
router.get('/:formId/field/:fieldId/image', authMiddleware, async (req, res) => {
  try {
    const { formId, fieldId } = req.params;
    const userId = req.user?._id || req.user?.id || req.user;
    const User = (await import('../models/User.js')).default;
    const { downloadFromGCS } = await import('../utils/gcs.js');

    const user = await User.findById(userId);
    const form = user?.formStorage?.find(f => f.formId === formId);
    const fieldImage = form?.fieldImages?.[fieldId];

    if (!fieldImage?.gcsPath) {
      return res.status(404).json({ message: 'Image not found' });
    }

    // Stream from GCS through backend
    const fileStream = await downloadFromGCS(fieldImage.gcsPath);
    
    // Set proper headers
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    fileStream.pipe(res);
  } catch (error) {
    console.error('Field image proxy error:', error);
    res.status(500).json({ message: 'Failed to load image' });
  }
});

export default router;
