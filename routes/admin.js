import { Router } from "express";
import authMiddleware from "../middlewares/auth.js";
import adminAuthMiddleware from "../middlewares/adminAuth.js";
import {
  getPendingLawyers,
  getVerifiedLawyers,
  getRejectedLawyers,
  getLawyerDetails,
  approveLawyer,
  rejectLawyer,
  getAdminStats
} from "../controllers/adminController.js";

const router = Router();

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(adminAuthMiddleware);

// Get statistics
router.get("/stats", getAdminStats);

// Get lawyers by verification status
router.get("/lawyers/pending", getPendingLawyers);
router.get("/lawyers/verified", getVerifiedLawyers);
router.get("/lawyers/rejected", getRejectedLawyers);

// Get specific lawyer details
router.get("/lawyers/:id", getLawyerDetails);

// Approve or reject lawyer
router.post("/lawyers/:id/approve", approveLawyer);
router.post("/lawyers/:id/reject", rejectLawyer);

export default router;
