import { Router } from "express";
import multer from "multer";
import authMiddleware from "../middlewares/auth.js";
import {
  listLawyers,
  onboardLawyer,
  createConnectionRequest,
  listRequestsForLawyer,
  listRequestsForUser,
  acceptRequest,
  rejectRequest,
  listAcceptedForLawyer,
  listAcceptedForUser,
} from "../controllers/lawyerController.js";

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const router = Router();

router.get("/list", authMiddleware, listLawyers); // list all lawyers
router.post("/onboard", authMiddleware, upload.fields([
  { name: 'proofDocument', maxCount: 1 },
  { name: 'degreeCertificate', maxCount: 1 }
]), onboardLawyer); // user becomes lawyer with document uploads
router.post("/request", authMiddleware, createConnectionRequest); // helpseeker requests lawyer
router.get('/my-requests', authMiddleware, listRequestsForUser); // helpseeker views own requests
router.get("/requests", authMiddleware, listRequestsForLawyer); // lawyer checks requests
router.post("/requests/:id/accept", authMiddleware, acceptRequest); // lawyer accepts
router.post('/requests/:id/reject', authMiddleware, rejectRequest); // lawyer rejects
router.get('/connections/lawyer', authMiddleware, listAcceptedForLawyer); // lawyer's accepted connections
router.get('/connections/me', authMiddleware, listAcceptedForUser); // helpseeker's accepted connections

export default router;
