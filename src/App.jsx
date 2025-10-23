import "./App.css";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Home from "./pages/Home";
import Login from "./pages/Login";
import NotebookPage from "./pages/NotebookPage";
import FindLawyer from "./pages/FindLawyer";
import LawyerOnboard from "./pages/LawyerOnboard";
import LawyerRequests from "./pages/LawyerRequests";
import ChatView from "./pages/ChatView";
import MyClients from "./pages/MyClients";
import CompleteRegistration from './pages/CompleteRegistration';
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import Footer from "./components/Footer";
import api from "./Axios/axios";
import useAuthStore from "./context/AuthContext";
import AuthCallback from "./pages/AuthCallback";
import { applyPalette, defaultPalette } from './utils/palette';
import Button from './components/ui/Button';
// import { LanguageProvider, useLanguage } from './context/LanguageContext';
// Google Translate widget loader
function GoogleTranslateWidget() {
  // Only load once
  useEffect(() => {
    if (window.google && window.google.translate) return;
    const script = document.createElement('script');
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.body.appendChild(script);
    window.googleTranslateElementInit = () => {
      new window.google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'en,hi,gu,bn,mr',
        layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE
      }, 'google_translate_element');
      // Hide the top bar injected by Google Translate
      const hideBar = () => {
        const gtBar = document.querySelector('iframe.goog-te-banner-frame');
        if (gtBar) {
          gtBar.style.display = 'none';
        }
        const body = document.querySelector('body');
        if (body) {
          body.style.top = '0px';
        }
        const googBar = document.getElementById('goog-gt-tt');
        if (googBar) {
          googBar.style.display = 'none';
        }
      };
      setTimeout(hideBar, 500);
      setTimeout(hideBar, 1500);
      setTimeout(hideBar, 3000);
      // Also hide on language change
      document.addEventListener('DOMSubtreeModified', hideBar);
    };
  }, []);
  return <div id="google_translate_element" style={{ minWidth: 120 }} />;
}


function App() {
  const token = useAuthStore((state) => state.token);
  const setUser = useAuthStore((state) => state.setUser);
  const [theme] = useState("light");
  const authUser = useAuthStore((s) => s.user);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!token) return;
        const resp = await api.get("/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(resp.data.user);
      } catch (err) {
        console.error(err);
      }
    };
    fetchProfile();
  }, [token, setUser]);

  // Apply simple body-level theme class for light/dark toggling
  useEffect(() => {
    // initialize dynamic palette variables
    applyPalette(defaultPalette);
  }, [theme]);

  return (
    <Router>
      <div className="app-root min-h-screen">
      {/* LanguageProvider removed, not needed for Google Translate widget */}
  <header className="w-full border-b bg-surface" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="rounded-md px-4 py-2 cursor-pointer shadow-sm" onClick={()=> window.location.href = '/home'} style={{ borderRadius: 'var(--radius-md)', background: 'var(--btn-gradient)' }}>
                  <div className="text-sm font-semibold text-primary">Legal SahAI</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <GoogleTranslateWidget />
                {authUser ? (
                  <div className="flex items-center gap-3">
                    <img src={authUser.picture || `https://avatar.vercel.sh/${authUser._id || 'guest'}.png`} alt="avatar" className="w-10 h-10 rounded-full border" />
                    <div className="text-sm">
                      <div className="font-medium text-primary">{authUser.name || 'User'}</div>
                      <div className="text-xs text-muted">{authUser.role === 'lawyer' ? 'Lawyer' : 'Helpseeker'}</div>
                    </div>
                    <Button variant="secondary" className="ml-2" onClick={() => { useAuthStore.getState().logout(); window.location.href = '/login'; }}>Logout</Button>
                  </div>
                ) : (
                  <a href="/login"><Button variant="primary">Sign in</Button></a>
                )}
              </div>
            </div>
          </div>
  </header>

        

  <main className="w-full px-0 sm:px-0 lg:px-0 py-0 flex-1 overflow-auto">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Protected area with sidebar + inner routes */}
            <Route
              path="/*"
              element={
                <div className="flex w-full h-full min-h-0">
                  <Sidebar />
                  <div className="flex-1 min-h-0 flex flex-col">
                    <div className="flex-1 min-h-0 overflow-auto px-4 sm:px-6 lg:px-8 py-6">
                      <Routes>
                      <Route
                        path="/home"
                        element={
                          <ProtectedRoute>
                            <Home />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/legaldesk/:id"
                        element={
                          <ProtectedRoute>
                            <NotebookPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/find-lawyer"
                        element={
                          <ProtectedRoute>
                            <FindLawyer />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/onboard-lawyer"
                        element={
                          <ProtectedRoute>
                            <LawyerOnboard />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/complete-registration"
                        element={
                          <ProtectedRoute>
                            <CompleteRegistration />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/lawyer/requests"
                        element={
                          <ProtectedRoute>
                            <LawyerRequests />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/mylawyers"
                        element={
                          <ProtectedRoute>
                            <MyClients />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="/chat/:id" element={<ProtectedRoute><ChatView /></ProtectedRoute>} />
                      <Route path="*" element={<Navigate to={'/home'} />} />
                      </Routes>
                    </div>
                  </div>
                </div>
              }
            />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;