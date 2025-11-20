import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../Axios/axios";
import useAuthStore from "../context/AuthContext";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { setToken, setUser } = useAuthStore();

  useEffect(() => {
    const handleAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      console.log("AuthCallback Params:", params.toString());

      const token = params.get("token");
      console.log("AuthCallback Token:", token);

      if (token) {
        setToken(token);
        try {
          const res = await api.get("/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const user = res.data.user || res.data;
          setUser(user);
          
          // If user has no role, they must complete registration
          if (!user || !user.role) {
            navigate('/complete-registration');
          } else if (user.role === 'lawyer' && !user.onboarded && (!user.specialties || user.specialties.length === 0)) {
            // Lawyer registered but hasn't submitted onboarding application
            navigate('/onboard-lawyer');
          } else {
            // User already has role and completed setup, go to home
            navigate('/home');
          }
        } catch (err) {
          setUser(null);
          navigate("/login");
        }
      } else {
        navigate("/login");
      }
    };

    handleAuth();
  }, [navigate, setToken, setUser]);

  return <div>Logging you in...</div>;
};

export default AuthCallback;
