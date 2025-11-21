import { User } from "../models/User.js";
import { ConnectionRequest } from "../models/ConnectionRequest.js";
import { Chat } from "../models/Chat.js";
import { uploadToGCS, deleteFromGCS } from "../utils/gcs.js";

// List accepted incoming connections for a lawyer (return requests with status accepted and populate from)
export const listAcceptedForLawyer = async (req, res) => {
  try {
    const lawyerId = req.user.id;
    
    // Guest users have no connections
    if (lawyerId === 'guest' || req.user.role === 'guest') {
      return res.json({ connections: [] });
    }
    
    // populate the 'from' user and the associated chat (if any) so the frontend can distinguish private chats vs dossiers
    const requests = await ConnectionRequest.find({ to: lawyerId, status: 'accepted' })
      .populate('from', 'name email picture')
      .populate({ path: 'chat', select: 'title channel' });
    res.json({ connections: requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server' });
  }
};

// List accepted outgoing connections for a helpseeker (return requests they've sent that are accepted)
export const listAcceptedForUser = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Guest users have no connections
    if (userId === 'guest' || req.user.role === 'guest') {
      return res.json({ connections: [] });
    }
    
    const requests = await ConnectionRequest.find({ from: userId, status: 'accepted' })
      .populate('to', 'name email picture')
      .populate({ path: 'chat', select: 'title channel' });
    res.json({ connections: requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server' });
  }
};

export const listLawyers = async (req, res) => {
  try {
    // Only return lawyers who completed onboarding and are verified (approved)
    const lawyers = await User.find({ 
      role: "lawyer", 
      isOnboarded: true,
      verificationStatus: "approved"
    }).select("name picture bio specialties location city yearsExperience fee modes languages courts verified rating freeFirst firmType education successRate responseTimeHours organization");
    res.json({ lawyers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server" });
  }
};

export const onboardLawyer = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Guest users cannot onboard as lawyers
    if (userId === 'guest' || req.user.role === 'guest') {
      return res.status(403).json({ error: 'Guest users cannot become lawyers. Please sign up to continue.' });
    }
    
    // Parse JSON strings from FormData
    const {
      bio,
      phone,
      location,
      city,
      yearsExperience,
      fee,
      freeFirst,
      firmType,
      successRate,
      responseTimeHours,
      organization,
    } = req.body;

    // Parse array fields from JSON strings
    const specialties = req.body.specialties ? JSON.parse(req.body.specialties) : [];
    const modes = req.body.modes ? JSON.parse(req.body.modes) : [];
    const languages = req.body.languages ? JSON.parse(req.body.languages) : [];
    const courts = req.body.courts ? JSON.parse(req.body.courts) : [];
    const education = req.body.education ? JSON.parse(req.body.education) : [];

    // Validation
    const errors = {};

    // Bio validation
    if (!bio || !bio.trim()) {
      errors.bio = 'Bio is required';
    } else if (bio.trim().length < 50) {
      errors.bio = 'Bio must be at least 50 characters';
    } else if (bio.trim().length > 2000) {
      errors.bio = 'Bio must not exceed 2000 characters';
    }

    // Phone validation
    if (!phone || !phone.trim()) {
      errors.phone = 'Phone number is required';
    } else {
      const phoneRegex = /^[6-9]\d{9}$/; // Indian phone number format
      const cleanPhone = phone.replace(/\s+/g, '').replace(/[()-]/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        errors.phone = 'Phone number must be a valid 10-digit Indian mobile number';
      }
    }

    // City validation
    if (!city || !city.trim()) {
      errors.city = 'City is required';
    }

    // Specialties validation
    if (!specialties || !Array.isArray(specialties) || specialties.length === 0) {
      errors.specialties = 'At least one specialty is required';
    } else if (specialties.length > 10) {
      errors.specialties = 'Maximum 10 specialties allowed';
    }

    // Document validation - require both proof and degree certificate
    if (!req.files || !req.files.proofDocument) {
      errors.proofDocument = 'Proof document (Bar Council ID/License) is required';
    } else {
      const proofFile = req.files.proofDocument[0];
      const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!validTypes.includes(proofFile.mimetype)) {
        errors.proofDocument = 'Proof document must be PDF, JPG, or PNG';
      } else if (proofFile.size > 5 * 1024 * 1024) { // 5MB limit
        errors.proofDocument = 'Proof document must be less than 5MB';
      }
    }

    if (!req.files || !req.files.degreeCertificate) {
      errors.degreeCertificate = 'Degree certificate is required';
    } else {
      const degreeFile = req.files.degreeCertificate[0];
      const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!validTypes.includes(degreeFile.mimetype)) {
        errors.degreeCertificate = 'Degree certificate must be PDF, JPG, or PNG';
      } else if (degreeFile.size > 5 * 1024 * 1024) { // 5MB limit
        errors.degreeCertificate = 'Degree certificate must be less than 5MB';
      }
    }

    // Years of experience validation
    if (yearsExperience !== undefined && yearsExperience !== null) {
      const exp = Number(yearsExperience);
      if (isNaN(exp) || exp < 0 || exp > 70) {
        errors.yearsExperience = 'Years of experience must be between 0 and 70';
      }
    }

    // Fee validation
    if (fee !== undefined && fee !== null) {
      const feeNum = Number(fee);
      if (isNaN(feeNum) || feeNum < 0 || feeNum > 1000000) {
        errors.fee = 'Fee must be between 0 and 10,00,000';
      }
    }

    // Success rate validation
    if (successRate !== undefined && successRate !== null && successRate !== '') {
      const rate = Number(successRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        errors.successRate = 'Success rate must be between 0 and 100';
      }
    }

    // Response time validation
    if (responseTimeHours !== undefined && responseTimeHours !== null) {
      const hours = Number(responseTimeHours);
      const validHours = [1, 2, 6, 12, 24, 48];
      if (!validHours.includes(hours)) {
        errors.responseTimeHours = 'Invalid response time';
      }
    }

    // Modes validation
    if (modes && Array.isArray(modes) && modes.length > 0) {
      const validModes = ['In-Person', 'Video Call', 'Phone Call', 'Chat'];
      const invalidModes = modes.filter(m => !validModes.includes(m));
      if (invalidModes.length > 0) {
        errors.modes = 'Invalid consultation mode(s)';
      }
    }

    // Languages validation
    if (languages && Array.isArray(languages) && languages.length > 0) {
      const validLanguages = ['English', 'Hindi', 'Bengali', 'Telugu', 'Marathi', 'Tamil', 'Gujarati', 'Urdu', 'Kannada', 'Malayalam', 'Punjabi', 'Odia'];
      const invalidLanguages = languages.filter(l => !validLanguages.includes(l));
      if (invalidLanguages.length > 0) {
        errors.languages = 'Invalid language(s)';
      }
    }

    // Courts validation
    if (courts && Array.isArray(courts) && courts.length > 0) {
      const validCourts = ['District Court', 'High Court', 'Supreme Court', 'Magistrate Court', 'Family Court', 'Consumer Court', 'Labor Court', 'Tax Tribunal', 'NCLT', 'NCLAT'];
      const invalidCourts = courts.filter(c => !validCourts.includes(c));
      if (invalidCourts.length > 0) {
        errors.courts = 'Invalid court(s)';
      }
    }

    // Education validation
    if (education && Array.isArray(education) && education.length > 0) {
      const validEducation = ['LLB', 'BA LLB', 'BBA LLB', 'LLM', 'PhD in Law', 'Diploma in Law', 'Corporate Law Certification', 'Intellectual Property Certification'];
      const invalidEducation = education.filter(e => !validEducation.includes(e));
      if (invalidEducation.length > 0) {
        errors.education = 'Invalid education qualification(s)';
      }
    }

    // Firm type validation
    if (firmType && !['independent', 'firm'].includes(firmType)) {
      errors.firmType = 'Invalid firm type';
    }

    // Organization validation
    if (organization && organization.length > 200) {
      errors.organization = 'Organization name must not exceed 200 characters';
    }

    // Return errors if any
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    // Clean phone number (remove spaces and special characters)
    const cleanedPhone = phone.replace(/\s+/g, '').replace(/[()-]/g, '');

    // Upload documents to Dropbox
    let proofDocData = {};
    let degreeCertData = {};

    try {
      // Upload proof document
      const proofFile = req.files.proofDocument[0];
      const proofUpload = await uploadToGCS(
        proofFile.buffer,
        proofFile.originalname,
        'lawyer-documents/proof',
        userId
      );
      proofDocData = {
        url: proofUpload.url,
        filename: proofUpload.filename,
        uploadedAt: new Date()
      };

      // Upload degree certificate
      const degreeFile = req.files.degreeCertificate[0];
      const degreeUpload = await uploadToGCS(
        degreeFile.buffer,
        degreeFile.originalname,
        'lawyer-documents/degree',
        userId
      );
      degreeCertData = {
        url: degreeUpload.url,
        filename: degreeUpload.filename,
        uploadedAt: new Date()
      };
    } catch (uploadError) {
      console.error('Document upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload documents. Please try again.' });
    }

    const update = {
      role: "lawyer",
      bio: bio.trim(),
      phone: cleanedPhone,
      specialties,
      location: location?.trim() || '',
      city: city.trim(),
      yearsExperience: Number(yearsExperience) || 0,
      fee: Number(fee) || 0,
      modes: modes || [],
      languages: languages || [],
      courts: courts || [],
      verified: false, // Admin will verify
      rating: 0, // Default rating
      freeFirst: Boolean(freeFirst),
      firmType: firmType || 'independent',
      education: education || [],
      successRate: successRate ? Number(successRate) : 0,
      responseTimeHours: Number(responseTimeHours) || 24,
      organization: organization?.trim() || '',
      isOnboarded: true,
      verificationStatus: 'pending', // Set to pending for admin review
      proofDocument: proofDocData,
      degreeCertificate: degreeCertData,
    };

    const user = await User.findByIdAndUpdate(userId, update, { new: true });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit lawyer application. Please try again." });
  }
};

export const createConnectionRequest = async (req, res) => {
  try {
    const from = req.user.id; // helpseeker
    
    // Guest users cannot create connection requests
    if (from === 'guest' || req.user.role === 'guest') {
      return res.status(403).json({ error: 'Guest users cannot request consultations. Please sign up to continue.' });
    }
    
    const { to, message } = req.body; // to = lawyer id
    // Prevent duplicate outstanding requests (requested or accepted) from same user to same lawyer
    const existing = await ConnectionRequest.findOne({ from, to, status: { $in: ['requested','accepted'] } });
    if (existing) return res.status(400).json({ error: 'You already have an active request to this lawyer' });
    const reqDoc = await ConnectionRequest.create({ from, to, message });
    res.json({ request: reqDoc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server" });
  }
};

export const listRequestsForUser = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Guest users have no requests
    if (userId === 'guest' || req.user.role === 'guest') {
      return res.json({ requests: [] });
    }
    
    const requests = await ConnectionRequest.find({ from: userId }).populate('to', 'name email picture');
    res.json({ requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server' });
  }
};

export const listRequestsForLawyer = async (req, res) => {
  try {
    const lawyerId = req.user.id;
    
    // Guest users have no requests
    if (lawyerId === 'guest' || req.user.role === 'guest') {
      return res.json({ requests: [] });
    }
    
    const requests = await ConnectionRequest.find({ to: lawyerId, status: "requested" }).populate("from", "name email picture");
    res.json({ requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server" });
  }
};

export const acceptRequest = async (req, res) => {
  try {
    const { id } = req.params; // request id
    const requestDoc = await ConnectionRequest.findById(id);
    if (!requestDoc) return res.status(404).json({ error: "not found" });

    // authorization: only the intended lawyer can accept
    if (requestDoc.to.toString() !== req.user.id) {
      return res.status(403).json({ error: 'forbidden' });
    }

    // create chat between users
  const chat = await Chat.create({ user: requestDoc.from, title: `Chat: ${requestDoc.from} <> ${requestDoc.to}`, channel: 'private' });
    requestDoc.status = "accepted";
    requestDoc.chat = chat._id;
    await requestDoc.save();

    res.json({ request: requestDoc, chat });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server" });
  }
};

export const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const requestDoc = await ConnectionRequest.findById(id);
    if (!requestDoc) return res.status(404).json({ error: 'not found' });
    if (requestDoc.to.toString() !== req.user.id) return res.status(403).json({ error: 'forbidden' });
    requestDoc.status = 'rejected';
    await requestDoc.save();
    res.json({ request: requestDoc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server' });
  }
};
