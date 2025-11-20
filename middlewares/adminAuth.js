import { User } from "../models/User.js";

// Middleware to check if the user is an admin
const adminAuthMiddleware = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Fetch full user from database to check role
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    // Attach full user to request
    req.user = user;
    next();
  } catch (err) {
    console.error('Admin auth error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

export default adminAuthMiddleware;
