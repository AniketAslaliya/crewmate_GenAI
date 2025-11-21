import "./App.css";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Landing from "./pages/Landing";
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
import ErrorBoundary from "./components/ErrorBoundary";
import Sidebar from "./components/Sidebar";
import api from "./Axios/axios";
import { MdMenu } from 'react-icons/md';
import useAuthStore from "./context/AuthContext";
import AuthCallback from "./pages/AuthCallback";
import FormAutoFill from './pages/FormAutoFill';
import AdminPanel from './pages/AdminPanel';
import Profile from './pages/Profile';
import Support from './pages/Support';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import { applyPalette, defaultPalette } from './utils/palette';

function App() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [theme] = useState("light");
  // Sidebar overlay open state for small screens
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Desktop sidebar collapse state
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);

  // On larger screens the sidebar is always visible via CSS (md:block),
  // so we only need overlay state for small screens.

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
    applyPalette(defaultPalette);
  }, [theme]);

  return (
    <Router>
      <div className="app-root min-h-screen w-full overflow-x-hidden">
        <main className="w-full px-0 py-0 flex-1 overflow-x-hidden">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={user ? <Navigate to="/home" /> : <Login />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Protected area with sidebar + inner routes */}
            <Route
              path="/*"
              element={
                <div className="flex w-full h-screen min-h-0 overflow-x-hidden">
                  {/* Persistent sidebar on md+ */}
                  {user?.role ? (
                    <div className="hidden md:block">
                      <Sidebar isOpen={desktopSidebarOpen} toggleSidebar={() => setDesktopSidebarOpen(!desktopSidebarOpen)} />
                    </div>
                  ) : null}

                  {/* Overlay sidebar for small screens */}
                  {user?.role && sidebarOpen && (
                    <div className="fixed inset-0 z-50 flex md:hidden">
                      <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setSidebarOpen(false)}
                      />
                      <div className="relative z-50 w-72 h-full shadow-lg bg-surface">
                        <Sidebar isOpen={true} toggleSidebar={() => setSidebarOpen(false)} />
                      </div>
                    </div>
                  )}

                  {/* Hamburger button for small screens */}
                  {user?.role && (
                    <button
                      onClick={() => setSidebarOpen(true)}
                      className="md:hidden fixed top-4 left-4 z-40 p-2 rounded-md bg-white shadow-md text-primary/90 hover:bg-gray-50 transition-colors duration-200"
                      aria-label="Open menu"
                    >
                      <MdMenu size={20} />
                    </button>
                  )}

                  <div className="flex-1 min-h-0 flex flex-col w-full">
                    {/* Mobile header placeholder (optional brand bar) */}
                    {/* <div className="md:hidden w-full border-b bg-white/80 backdrop-blur-md sticky top-0 z-30 px-4 flex items-center justify-center h-12 shadow-sm">
                      <div className="text-base font-semibold truncate" style={{ color: 'var(--color-primary)' }}>Legal SahAI</div>
                    </div> */}
                    
                    <div className="flex-1 min-h-0 overflow-auto w-full overflow-x-hidden">
                      <Routes>
                        <Route
                          path="/home"
                          element={
                            <ProtectedRoute>
                              <div className="w-full max-w-full overflow-x-hidden">
                                <Home />
                              </div>
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
                            <ProtectedRoute allowGuest={true}>
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
                        <Route
                          path="/admin"
                          element={
                            <ProtectedRoute>
                              <AdminPanel />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/profile"
                          element={
                            <ProtectedRoute>
                              <Profile />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/support"
                          element={
                            <ProtectedRoute>
                              <Support />
                            </ProtectedRoute>
                          }
                        />
                        <Route 
                          path="/chat/:id" 
                          element={
                            <ProtectedRoute>
                              <ChatView />
                            </ProtectedRoute>
                          } 
                        />
                        <Route
                          path="/chats"
                          element={
                            <ProtectedRoute>
                              <ChatView />
                            </ProtectedRoute>
                          }
                        />
                        <Route 
                          path="/chats/:id" 
                          element={
                            <ProtectedRoute>
                              <ChatView />
                            </ProtectedRoute>
                          } 
                        />
                        <Route path="*" element={<Navigate to={'/home'} />} />
                      </Routes>
                    </div>
                  </div>
                </div>
              }
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}