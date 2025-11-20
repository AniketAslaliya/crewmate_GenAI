import { Navigate, useLocation } from "react-router-dom";
import useAuthStore from "../context/AuthContext";

const ProtectedRoute = ({ children, allowGuest = false }) => {
  const { token, user } = useAuthStore();
  const location = useLocation();

  // Not authenticated -> send to login (unless guest access is allowed)
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // If guest access is allowed and user is a guest, allow access
  const isGuest = user?.isGuest === true || user?.role === 'guest';
  if (allowGuest && isGuest) {
    return children;
  }

  // Authenticated but no role assigned yet -> force complete-registration
  // Allow access to the complete-registration page itself.
  if (user.role && location.pathname === "/complete-registration") {
    // If user already has a role, they should not access complete-registration
    return <Navigate to="/home" replace />;
  }

  if (!user.role && location.pathname !== "/complete-registration") {
    return <Navigate to="/complete-registration" replace />;
  }

  return children;
};

export default ProtectedRoute;
