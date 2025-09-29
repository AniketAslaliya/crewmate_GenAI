import { Router } from "express";
import passport from "passport";
import pkg from 'jsonwebtoken';
const { sign, verify } = pkg;
import { User } from "../models/User.js";
import { uploadDocument, deleteChat, getUserChats} from "../controllers/chatController.js";
import authMiddleware from "../middlewares/auth.js";
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
router.get("/me",authMiddleware, async (req, res) => {
 res.json({
    user: req.user,  
  });
});

export default router;
