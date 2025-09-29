import { Navigate } from "react-router-dom";
import useAuthStore from "../context/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { token, user } = useAuthStore();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
