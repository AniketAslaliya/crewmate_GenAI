import "./App.css";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Home from "./pages/Home";
import LegalDesk from "./pages/LegalDesk";
import Login from "./pages/Login";
import NotebookPage from "./pages/NotebookPage";
import GeneralAsk from './pages/GeneralAsk';
import FindLawyer from "./pages/FindLawyer";
import LawyerOnboard from "./pages/LawyerOnboard";
import LawyerRequests from "./pages/LawyerRequests";
import ChatView from "./pages/ChatView";
import MyClients from "./pages/MyClients";
import CompleteRegistration from './pages/CompleteRegistration';
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Footer from "./components/Footer";
import api from "./Axios/axios";
import { MdMenu } from 'react-icons/md';
import useAuthStore from "./context/AuthContext";
import AuthCallback from "./pages/AuthCallback";
import FormAutoFill from './pages/FormAutoFill';
import { applyPalette, defaultPalette } from './utils/palette';
// import { LanguageProvider, useLanguage } from './context/LanguageContext';
// Google Translate widget loader
 


function App() {
  const token = useAuthStore((state) => state.token);
    const user = useAuthStore((state) => state.user);
    const setUser = useAuthStore((state) => state.setUser);
  const [theme] = useState("light");
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
  {/* header moved inside the right-side app column so it scrolls with main content */}

        

  <main className=" w-full px-0 sm:px-0 lg:px-0 py-0 flex-1 overflow-auto">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Protected area with sidebar + inner routes */}
            <Route
              path="/*"
              element={
                <div className="flex w-full h-[100vh] min-h-0 overflow-y-clip ">
                  {user?.role ? (
                    <Sidebar isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(s => !s)} />
                  ) : null}
                  {/* small open button when sidebar is closed */}
                  {!sidebarOpen && (
                    <button onClick={() => setSidebarOpen(true)} className=" fixed top-4 left-4 z-50 p-2 rounded-md bg-white shadow-md text-primary/90 hover:bg-gray-50">
                      <MdMenu size={20} />
                    </button>
                  )}
                  <div className="flex-1 min-h-0 flex flex-col">
                            {/* <Header /> */}
                            <div className="flex-1 min-h-0 overflow-auto ">
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
                        path="/legal-desk"
                        element={
                          <ProtectedRoute>
                            <LegalDesk />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/legal-desk/:id"
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
                      <Route
                        path="/forms/auto-fill"
                        element={
                          <ProtectedRoute>
                            <FormAutoFill />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/general-ask"
                        element={
                          <ProtectedRoute>
                            <GeneralAsk />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="/chat/:id" element={<ProtectedRoute><ChatView /></ProtectedRoute>} />
                      {/* Chats list (role-aware). ChatView reads ?target=lawyer|client and filters connections accordingly. */}
                      <Route path="/chats" element={<ProtectedRoute><ChatView /></ProtectedRoute>} />
                      <Route path="/chats/:id" element={<ProtectedRoute><ChatView /></ProtectedRoute>} />
                      <Route path="*" element={<Navigate to={'/home'} />} />
                      </Routes>
                    </div>
                  </div>
                </div>
              }
            />
          </Routes>
          
        </main>
        {/* <Footer /> */}
      </div>
    </Router>
  );
}

export default App;