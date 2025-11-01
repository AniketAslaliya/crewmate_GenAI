import { Navigate, useLocation } from "react-router-dom";
import useAuthStore from "../context/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { token, user } = useAuthStore();
  const location = useLocation();

  // Not authenticated -> send to login
  if (!token || !user) {
    return <Navigate to="/login" replace />;
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
