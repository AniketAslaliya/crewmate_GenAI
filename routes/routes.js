import { Router } from "express";
import passport from "passport";
import pkg from 'jsonwebtoken';
const { sign, verify } = pkg;
import { User } from "../models/User.js";
import { VerificationCode } from "../models/VerificationCode.js";
import bcrypt from "bcryptjs";
import { uploadDocument, deleteChat, getUserChats} from "../controllers/chatController.js";
import authMiddleware from "../middlewares/auth.js";
import lawyersRouter from "./lawyers.js";
import formsRouter from './forms.js';
import { sendVerificationCode, sendPasswordResetCode } from "../utils/emailService.js";
import crypto from "crypto";
const router = Router();

const signJwt = (payload) =>
  sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));


router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${process.env.CLIENT_URL}/login`,
    session: false,
  }),
  async (req, res) => {
    try {
      // check if user already exists
      let user = await User.findOne({ email: req.user.email });

      if (!user) {
        // Generate random 8-character password with letters and numbers
        const generateRandomPassword = () => {
          const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
          const numbers = '0123456789';
          let password = '';
          
          // Ensure at least one letter and one number
          password += letters[Math.floor(Math.random() * letters.length)];
          password += numbers[Math.floor(Math.random() * numbers.length)];
          
          // Fill remaining 6 characters with random mix
          const allChars = letters + numbers;
          for (let i = 0; i < 6; i++) {
            password += allChars[Math.floor(Math.random() * allChars.length)];
          }
          
          // Shuffle the password
          return password.split('').sort(() => Math.random() - 0.5).join('');
        };

        const randomPassword = generateRandomPassword();
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        // create new user with hashed random password
        user = await User.create({
          email: req.user.email,
          name: req.user.name,
          picture: req.user.picture,
          googleId: req.user.id,
          password: hashedPassword
        });
      }

      // Issue JWT
      const token = signJwt({
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      });

      console.log("Generated Token:", token);

      // Redirect back to frontend with token in query string
      res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
    } catch (err) {
      console.error("Error in Google callback:", err);
      res.redirect(`${process.env.CLIENT_URL}/login?error=server`);
    }
  }
);



// Guest login - no authentication required
router.post("/guest-login", async (req, res) => {
  try {
    // Create a guest token with limited access
    const guestToken = signJwt({
      id: 'guest',
      email: 'guest@legal-sahai.com',
      name: 'Guest User',
      role: 'guest',
      isGuest: true
    });
    
    res.json({ 
      token: guestToken,
      user: {
        id: 'guest',
        email: 'guest@legal-sahai.com',
        name: 'Guest User',
        role: 'guest',
        isGuest: true
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user by JWT
router.get("/me", authMiddleware, async (req, res) => {
  try {
    // Handle guest users
    if (req.user.isGuest) {
      return res.json({ 
        user: {
          id: 'guest',
          email: 'guest@legal-sahai.com',
          name: 'Guest User',
          role: 'guest',
          isGuest: true
        }
      });
    }
    
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send verification code for signup
router.post("/send-verification-code", async (req, res) => {
  try {
    const { email, name } = req.body;
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!name || !name.trim()) errors.name = 'Name is required';
    if (!email || !email.trim()) errors.email = 'Email is required';
    else if (!emailRegex.test(email)) errors.email = 'Invalid email format';

    if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

    // Check if email already exists
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ errors: { email: 'Email already registered' } });

    // Generate 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();
    
    // Store code in database (expires in 10 minutes)
    await VerificationCode.deleteMany({ email, type: 'signup' }); // Clear old codes
    await VerificationCode.create({
      email,
      code,
      type: 'signup',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    // Send email
    await sendVerificationCode(email, name, code);

    res.json({ message: 'Verification code sent to your email' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Verify code and complete signup
router.post("/verify-and-signup", async (req, res) => {
  try {
    const { email, code, password, name, role } = req.body;
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordRegex = /(?=.*[A-Za-z])(?=.*\d)/;

    if (!name || !name.trim()) errors.name = 'Name is required';
    if (!email || !email.trim()) errors.email = 'Email is required';
    else if (!emailRegex.test(email)) errors.email = 'Invalid email format';
    if (!code || !code.trim()) errors.code = 'Verification code is required';
    if (!password) errors.password = 'Password is required';
    else if (password.length < 8) errors.password = 'Password must be at least 8 characters';
    else if (!passwordRegex.test(password)) errors.password = 'Password must contain letters and numbers';

    if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

    // Verify code
    const verificationRecord = await VerificationCode.findOne({
      email,
      code,
      type: 'signup',
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    if (!verificationRecord) {
      return res.status(400).json({ errors: { code: 'Invalid or expired verification code' } });
    }

    // Check if email already exists (double-check)
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ errors: { email: 'Email already registered' } });

    // Create user
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, name, password: hash, role: role || null });

    // Mark code as verified
    verificationRecord.verified = true;
    await verificationRecord.save();

    const token = signJwt({ id: user._id, email: user.email, name: user.name, picture: user.picture });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Send password reset code
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !email.trim()) errors.email = 'Email is required';
    else if (!emailRegex.test(email)) errors.email = 'Invalid email format';

    if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      // Reject silently - don't reveal if email exists or not (security)
      // Still return success message to prevent email enumeration
      return res.json({ message: 'If the email exists, a reset code has been sent' });
    }

    // Generate 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();
    
    // Store code in database (expires in 15 minutes)
    await VerificationCode.deleteMany({ email, type: 'password-reset' }); // Clear old codes
    await VerificationCode.create({
      email,
      code,
      type: 'password-reset',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    });

    // Send email only if user exists
    await sendPasswordResetCode(email, user.name, code);

    res.json({ message: 'If the email exists, a reset code has been sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Verify reset code and update password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordRegex = /(?=.*[A-Za-z])(?=.*\d)/;

    if (!email || !email.trim()) errors.email = 'Email is required';
    else if (!emailRegex.test(email)) errors.email = 'Invalid email format';
    if (!code || !code.trim()) errors.code = 'Verification code is required';
    if (!newPassword) errors.password = 'New password is required';
    else if (newPassword.length < 8) errors.password = 'Password must be at least 8 characters';
    else if (!passwordRegex.test(newPassword)) errors.password = 'Password must contain letters and numbers';

    if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

    // Verify code
    const verificationRecord = await VerificationCode.findOne({
      email,
      code,
      type: 'password-reset',
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    if (!verificationRecord) {
      return res.status(400).json({ errors: { code: 'Invalid or expired verification code' } });
    }

    // Find user and update password
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ errors: { email: 'User not found' } });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    user.password = hash;
    await user.save();

    // Mark code as verified
    verificationRecord.verified = true;
    await verificationRecord.save();

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Local signup (deprecated - use verify-and-signup instead)
router.post("/signup", async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    // Validate inputs and build structured errors
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordRegex = /(?=.*[A-Za-z])(?=.*\d)/; // letters and numbers

    if (!name || !name.trim()) errors.name = 'Name is required';
    if (!email || !email.trim()) errors.email = 'Email is required';
    else if (!emailRegex.test(email)) errors.email = 'Invalid email format';
    if (!password) errors.password = 'Password is required';
    else if (password.length < 8) errors.password = 'Password must be at least 8 characters';
    else if (!passwordRegex.test(password)) errors.password = 'Password must contain letters and numbers';

    if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ errors: { email: 'Email already exists' } });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, name, password: hash, role: role || null });

    const token = signJwt({ id: user._id, email: user.email, name: user.name, picture: user.picture });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Local login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    // Validate inputs and provide structured errors
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !email.trim()) errors.email = 'Email is required';
    else if (!emailRegex.test(email)) errors.email = 'Invalid email format';
    if (!password) errors.password = 'Password is required';

    if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

    const user = await User.findOne({ email });
    if (!user || !user.password) return res.status(401).json({ errors: { email: 'Invalid credentials', password: 'Invalid credentials' } });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ errors: { email: 'Invalid credentials', password: 'Invalid credentials' } });

    const token = signJwt({ id: user._id, email: user.email, name: user.name, picture: user.picture });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Set role for authenticated user (or update other profile info)
router.post('/set-role', authMiddleware, async (req, res) => {
  try {
    // Guest users cannot set role
    if (req.user.id === 'guest' || req.user.role === 'guest') {
      return res.status(403).json({ error: 'Guest users cannot set a role. Please sign up to continue.' });
    }
    
    const { role, name } = req.body;
    if (!['helpseeker','lawyer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    
    // Prepare update object
    const updateData = { role };
    
    // If name is provided in the request, use it (from CompleteRegistration form)
    if (name && name.trim()) {
      updateData.name = name.trim();
    }
    
    const user = await User.findByIdAndUpdate(req.user.id, updateData, { new: true });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change password
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    // Guest users cannot change password
    if (req.user.id === 'guest' || req.user.role === 'guest') {
      return res.status(403).json({ error: 'Guest users cannot change password.' });
    }
    
    const { currentPassword, newPassword } = req.body;
    const errors = {};
    const passwordRegex = /(?=.*[A-Za-z])(?=.*\d)/;

    if (!currentPassword) errors.currentPassword = 'Current password is required';
    if (!newPassword) errors.newPassword = 'New password is required';
    else if (newPassword.length < 8) errors.newPassword = 'Password must be at least 8 characters';
    else if (!passwordRegex.test(newPassword)) errors.newPassword = 'Password must contain letters and numbers';

    if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

    // Get user with password
    const user = await User.findById(req.user.id);
    if (!user || !user.password) {
      return res.status(400).json({ error: 'Password change not available for this account' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ error: 'New password must be different from current password' });
    }

    // Hash and update password
    const hash = await bcrypt.hash(newPassword, 10);
    user.password = hash;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile (name, phone, location, and lawyer professional fields)
router.put('/profile/update', authMiddleware, async (req, res) => {
  try {
    // Guest users cannot update profile
    if (req.user.id === 'guest' || req.user.role === 'guest') {
      return res.status(403).json({ error: 'Guest users cannot update profile. Please sign up to continue.' });
    }
    
    const { 
      name, phone, location,
      // Lawyer fields
      bio, city, yearsExperience, fee, organization,
      specialties, languages, courts, modes, education
    } = req.body;
    const errors = {};

    // Validate name (required)
    if (!name || !name.trim()) {
      errors.name = 'Name is required';
    }

    // Validate phone (optional, but if provided must be valid 10-digit)
    if (phone && phone.trim()) {
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(phone.trim())) {
        errors.phone = 'Must be a valid 10-digit Indian mobile number starting with 6-9';
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    // Build update object
    const updateData = {
      name: name.trim(),
      updatedAt: new Date()
    };

    // Add optional basic fields if provided
    if (phone !== undefined) updateData.phone = phone.trim();
    if (location !== undefined) updateData.location = location.trim();

    // Add lawyer professional fields if user is a lawyer
    const user = await User.findById(req.user.id);
    if (user && user.role === 'lawyer') {
      if (bio !== undefined) updateData.bio = bio.trim();
      if (city !== undefined) updateData.city = city.trim();
      if (yearsExperience !== undefined) updateData.yearsExperience = parseInt(yearsExperience) || 0;
      if (fee !== undefined) updateData.fee = parseInt(fee) || 0;
      if (organization !== undefined) updateData.organization = organization.trim();
      if (specialties !== undefined) updateData.specialties = Array.isArray(specialties) ? specialties : [];
      if (languages !== undefined) updateData.languages = Array.isArray(languages) ? languages : [];
      if (courts !== undefined) updateData.courts = Array.isArray(courts) ? courts : [];
      if (modes !== undefined) updateData.modes = Array.isArray(modes) ? modes : [];
      if (education !== undefined) updateData.education = Array.isArray(education) ? education : [];
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id, 
      updateData, 
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// mount lawyer-related routes
router.use('/api/lawyers', lawyersRouter);

export default router;
