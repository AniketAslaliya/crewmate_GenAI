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
          // If user has no role, try to read a pre-selected role stored before OAuth
          if (!user || !user.role) {
            try {
              const prefRole = localStorage.getItem('pre_oauth_role');
              if (prefRole) {
                // Attempt to set role on the server and refresh profile
                try {
                  await api.post('/auth/set-role', { role: prefRole }, { headers: { Authorization: `Bearer ${token}` } });
                  // remove the pref after applying
                  localStorage.removeItem('pre_oauth_role');
                  const me2 = await api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
                  const updatedUser = me2.data.user || me2.data;
                  setUser(updatedUser);
                  navigate('/home');
                  return;
                } catch (err) {
                  console.warn('Failed to set pref role automatically', err);
                  // fallthrough to complete-registration UI
                }
              }
            } catch (e) {
              console.warn('Could not read pre_oauth_role', e);
            }

            // If we couldn't apply prefRole or it didn't exist, go to complete-registration
            navigate('/complete-registration');
          } else {
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
