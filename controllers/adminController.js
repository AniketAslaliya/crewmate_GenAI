import { User } from "../models/User.js";
import { sendApprovalEmail, sendRejectionEmail } from "../utils/emailService.js";

// Get all pending lawyer verifications
export const getPendingLawyers = async (req, res) => {
  try {
    const pendingLawyers = await User.find({ 
      role: "lawyer", 
      verificationStatus: "pending",
      isOnboarded: true 
    }).select("name email picture bio phone specialties location city yearsExperience fee modes languages courts freeFirst firmType education successRate responseTimeHours organization proofDocument degreeCertificate createdAt updatedAt");
    
    res.json({ lawyers: pendingLawyers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch pending lawyers" });
  }
};

// Get all verified lawyers
export const getVerifiedLawyers = async (req, res) => {
  try {
    const verifiedLawyers = await User.find({ 
      role: "lawyer", 
      verificationStatus: "approved",
      isOnboarded: true 
    }).select("name email picture bio specialties location city yearsExperience fee verified verificationDate");
    
    res.json({ lawyers: verifiedLawyers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch verified lawyers" });
  }
};

// Get all rejected lawyers
export const getRejectedLawyers = async (req, res) => {
  try {
    const rejectedLawyers = await User.find({ 
      role: "lawyer", 
      verificationStatus: "rejected",
      isOnboarded: true 
    }).select("name email picture bio specialties verificationNotes verificationDate");
    
    res.json({ lawyers: rejectedLawyers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch rejected lawyers" });
  }
};

// Get detailed lawyer information for review
export const getLawyerDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const lawyer = await User.findById(id);
    
    if (!lawyer || lawyer.role !== "lawyer") {
      return res.status(404).json({ error: "Lawyer not found" });
    }
    
    res.json({ lawyer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch lawyer details" });
  }
};

// Approve a lawyer verification
export const approveLawyer = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    const lawyer = await User.findByIdAndUpdate(
      id,
      {
        verificationStatus: "approved",
        verified: true,
        verificationDate: new Date(),
        verificationNotes: notes || "Approved by admin"
      },
      { new: true }
    );
    
    if (!lawyer) {
      return res.status(404).json({ error: "Lawyer not found" });
    }

    // Send approval email notification
    if (lawyer.email) {
      await sendApprovalEmail(lawyer.email, lawyer.name || "Lawyer");
    }
    
    res.json({ 
      message: "Lawyer approved successfully. Notification email sent.", 
      lawyer 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to approve lawyer" });
  }
};

// Reject a lawyer verification
export const rejectLawyer = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    if (!notes) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }
    
    const lawyer = await User.findByIdAndUpdate(
      id,
      {
        verificationStatus: "rejected",
        verified: false,
        verificationDate: new Date(),
        verificationNotes: notes
      },
      { new: true }
    );
    
    if (!lawyer) {
      return res.status(404).json({ error: "Lawyer not found" });
    }

    // Send rejection email notification
    if (lawyer.email) {
      await sendRejectionEmail(lawyer.email, lawyer.name || "Lawyer", notes);
    }
    
    res.json({ 
      message: "Lawyer verification rejected. Notification email sent.", 
      lawyer 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reject lawyer" });
  }
};

// Get admin dashboard statistics
export const getAdminStats = async (req, res) => {
  try {
    const totalLawyers = await User.countDocuments({ role: "lawyer", isOnboarded: true });
    const pendingCount = await User.countDocuments({ role: "lawyer", verificationStatus: "pending", isOnboarded: true });
    const approvedCount = await User.countDocuments({ role: "lawyer", verificationStatus: "approved" });
    const rejectedCount = await User.countDocuments({ role: "lawyer", verificationStatus: "rejected" });
    const totalUsers = await User.countDocuments({ role: "helpseeker" });
    
    // Import SupportMessage model dynamically to avoid circular dependency
    const SupportMessage = (await import('../models/SupportMessage.js')).default;
    const pendingSupportMessages = await SupportMessage.countDocuments({ status: 'pending' });
    
    res.json({
      stats: {
        totalLawyers,
        pendingVerifications: pendingCount,
        approvedLawyers: approvedCount,
        rejectedLawyers: rejectedCount,
        totalUsers,
        pendingSupportMessages
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
};
