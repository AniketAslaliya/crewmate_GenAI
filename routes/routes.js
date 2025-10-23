import { Router } from "express";
import passport from "passport";
import pkg from 'jsonwebtoken';
const { sign, verify } = pkg;
import { User } from "../models/User.js";
import bcrypt from "bcryptjs";
import { uploadDocument, deleteChat, getUserChats} from "../controllers/chatController.js";
import authMiddleware from "../middlewares/auth.js";
import lawyersRouter from "./lawyers.js";
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
        // create new user
        user = await User.create({
          email: req.user.email,
          name: req.user.name,
          picture: req.user.picture,
          googleId: req.user.id, // optional if you store googleId
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



// Get current user by JWT
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Local signup: email + password + name + role (optional)
router.post("/signup", async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: "Missing fields" });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: "Email already exists" });

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
    if (!email || !password) return res.status(400).json({ error: "Missing fields" });

    const user = await User.findOne({ email });
    if (!user || !user.password) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

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
    const { role } = req.body;
    if (!['helpseeker','lawyer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const user = await User.findByIdAndUpdate(req.user.id, { role }, { new: true });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// mount lawyer-related routes
router.use('/api/lawyers', lawyersRouter);

export default router;
