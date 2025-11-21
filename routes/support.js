import express from 'express';
import authenticate from '../middlewares/auth.js';
import adminAuth from '../middlewares/adminAuth.js';
import {
  createSupportMessage,
  getUserSupportMessages,
  getAllSupportMessages,
  getSupportMessageById,
  updateSupportMessageStatus,
  deleteSupportMessage
} from '../controllers/supportController.js';

const router = express.Router();

// User routes
router.post('/create', authenticate, createSupportMessage);
router.get('/my-messages', authenticate, getUserSupportMessages);

// Admin routes
router.get('/all', authenticate, adminAuth, getAllSupportMessages);
router.get('/:id', authenticate, adminAuth, getSupportMessageById);
router.put('/:id', authenticate, adminAuth, updateSupportMessageStatus);
router.delete('/:id', authenticate, adminAuth, deleteSupportMessage);

export default router;
