import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import useAuthStore from "../context/AuthContext";

const ProtectedRoute = ({ children, allowGuest = false }) => {
  const { token, user } = useAuthStore();
  const location = useLocation();
  const [isHydrated, setIsHydrated] = useState(false);

  // Wait for Zustand to hydrate from sessionStorage
  useEffect(() => {
    // Small delay to ensure Zustand has hydrated
    const timer = setTimeout(() => {
      setIsHydrated(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Show loading state while hydrating
  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

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
