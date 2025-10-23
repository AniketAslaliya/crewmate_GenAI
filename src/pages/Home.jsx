import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../Axios/axios";
import papi from "../Axios/paxios";
import useAuthStore from "../context/AuthContext";
import NotebookPage from "./NotebookPage";
import Button from '../components/ui/Button';

// Modern legal background with subtle pattern
const ModernBackground = () => (
  <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#e5e9f2] via-[#f8fafc] to-[#e0e7ef]">
    <div className="absolute inset-0 -z-10 opacity-10 pointer-events-none"
      style={{
        backgroundImage: `url("https://www.transparenttextures.com/patterns/pw-maze-white.png")`,
        backgroundRepeat: "repeat"
      }}
    />
    {/* Deeper, more professional color overlay */}
    <div className="absolute inset-0 -z-10 bg-gradient-to-br from-transparent via-[#1e40af]/5 to-[#4b5563]/10" /> 
  </div>
);

const StatusIcon = ({ status }) => {
  if (status === 'completed') {
    // A bolder, more secure-looking checkmark
    return <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold">✓</motion.div>;
  }
  if (status === 'in-progress') {
    return <div className="w-5 h-5 flex items-center justify-center">
      <svg className="animate-spin h-5 w-5 text-[var(--palette-3)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>;
  }
  return <div className="w-5 h-5 bg-gray-300 rounded-full" />;
};

const IngestionLoader = ({ steps }) => {
  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const progress = (steps.length > 0) ? (completedSteps / steps.length) * 100 : 0;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div 
        className="bg-surface rounded-2xl shadow-3xl p-8 w-full max-w-md"
        style={{ borderColor: 'var(--palette-3)' }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 100 }}
      >
        {/* Title emphasizes security */}
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2 tracking-wide font-serif">Securing Your Legal Dossier</h2>
        <p className="text-center text-gray-500 mb-6 text-sm italic">
          Your documents are being encrypted with attorney-grade confidentiality.
        </p>

          <div className="space-y-4 mb-6">
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              className="flex items-center space-x-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <StatusIcon status={step.status} />
                <span className={`text-lg transition-colors duration-300 ${step.status === 'in-progress' ? 'font-medium' : step.status === 'completed' ? 'text-gray-600' : 'text-gray-400'}`} style={step.status === 'in-progress' ? { color: 'var(--palette-3)' } : {}}>
                {step.text}
              </span>
            </motion.div>
          ))}
        </div>
        
          <div className="w-full bg-gray-200 rounded-full h-2.5">
          {/* Progress bar uses palette accent */}
          <motion.div
            className="h-2.5 rounded-full"
            style={{ background: 'var(--palette-3)' }}
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          ></motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const Home = () => {
  const [chats, setChats] = useState([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState({ name: null, photo: "", id: null });
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState("newest");
  // logout is available from auth store when needed
  const [ingestionStatus, setIngestionStatus] = useState([]);
  const location = useLocation();
  const qs = new URLSearchParams(location.search);
  const initialFeature = qs.get("feature") || "home";
  const [selectedFeature, setSelectedFeature] = useState(initialFeature);
  const [openNotebookId, setOpenNotebookId] = useState(null);
  const authUser = useAuthStore((state)=>state.user);
  const token = useAuthStore((s)=>s.token);
  const setUserStore = useAuthStore((s)=>s.setUser);
  // removed reliance on showRole query param; show role modal whenever user has no role

  useEffect(() => {
    fetchChats();
    fetchUserProfile();
  }, []);

  // Keep selectedFeature in sync with the ?feature= query param
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const f = q.get("feature") || "home";
    setSelectedFeature(f);
  }, [location.search]);
 
  const fetchUserProfile = async () => {
    try {
      const res = await api.get("/auth/me");
      if (res.data && res.data.user) {
        setUserProfile({
          id: res.data.user._id,
          name: res.data.user.name,
          photo: res.data.user.picture || `https://avatar.vercel.sh/${res.data.user.id}.png`,
        });
      }
    } catch (err) {
      setUserProfile({ name: "Guest User", photo: "https://avatar.vercel.sh/guest.png" });
    }
  };

  const fetchChats = async () => {
    try {
      const res = await api.get("/api/getallchats");
      setChats(res.data.chats || []);
    } catch (err) {}
  };

  const handleOpen = (id) => {
    setOpenNotebookId(id);
  };

  const handleAddlegaldesk = async () => {
    if (!file || !title.trim()) {
      alert("Please provide both a title and a file.");
      return;
    }

    setUploading(true);

    try {
      const res1 = await api.post("/api/uploaddoc", { title });
      if (!res1.data?.chat) throw new Error("Failed to create legal desk entry.");

      const newChat = res1.data.chat;
      console.log("new chat data", newChat);
      setChats(prev => [newChat, ...prev]);
      setAdding(false);

      setIsLoading(true);

      const steps = [
        { id: 1, text: "Uploading secure document...", status: 'pending' },
        { id: 2, text: "Parsing and segmenting clauses...", status: 'pending' },
        { id: 3, text: "Generating legal knowledge embeddings...", status: 'pending' },
        { id: 4, text: "Encrypting with attorney-grade security...", status: 'pending' },
        { id: 5, text: "Indexing for rapid legal search...", status: 'pending' },
        { id: 6, text: "Finalizing your Legal Dossier...", status: 'pending' }
      ];
      setIngestionStatus(steps);
      
      const updateProgress = async () => {
        for (let i = 0; i < steps.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 800));
          setIngestionStatus(prev => prev.map((step, index) => ({
            ...step,
            status: index < i ? 'completed' : index === i ? 'in-progress' : 'pending'
          })));
        }
      };
      // console.log(userProfile);
      // console.log("new chat data", newChat);
      const formData = new FormData();
      formData.append("user_id", userProfile.id || "");
      formData.append("thread_id", newChat._id);
      formData.append("title", title);
      formData.append("file", file);

      const ingestPromise = papi.post("/api/ingest", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Run ingestion and progress update concurrently
      await Promise.all([ingestPromise, updateProgress()]);
      
      setIngestionStatus(prev => prev.map(step => ({ ...step, status: 'completed' })));
      await new Promise(resolve => setTimeout(resolve, 500));

      setOpenNotebookId(newChat._id);

    } catch (err) {
      alert("Error creating legal desk. Please try again.");
      setChats(prev => prev.filter(c => c.title !== title));
    } finally {
      setUploading(false);
      setIsLoading(false);
      setTitle("");
      setFile(null);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/delete/${id}`);
      setChats(chats.filter((chat) => chat._id !== id));
    } catch (err) {}
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) setFile(files[0]);
  };

  const filteredAndSortedChats = chats
    .filter((chat) => chat.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortOption === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortOption === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortOption === "title-asc") return a.title.localeCompare(b.title);
      if (sortOption === "title-desc") return b.title.localeCompare(a.title);
      return 0;
    });

  // logout function available via auth store; Home uses logout directly where needed

  return (
    <div className="relative w-full text-[var(--text)] font-sans bg-[var(--bg)] min-h-0 flex flex-col">
      <ModernBackground />

      {/* Header - More authoritative gradient and better background opacity */}
      

      <AnimatePresence>
        {isLoading && <IngestionLoader steps={ingestionStatus} />}
      </AnimatePresence>

  <div className="flex w-full flex-1 min-h-0">

    {/* Main Content — Sidebar moved to global layout; this area is just the page content */}
  <main className={`flex-1 min-h-0 overflow-auto px-6 py-10`}>
          {selectedFeature === "home" && (
      <motion.div
        className="w-full mt-24 bg-card rounded-3xl shadow-3xl border p-12 text-center backdrop-blur-sm"
        style={{ borderColor: 'var(--palette-3)' }}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <h2 className="text-5xl font-extrabold mb-4 text-[var(--color-primary)] font-serif">Welcome to Legal SahAI 👋</h2>
              <p className="text-gray-700 text-xl mb-3">
                Your **secure, confidential, and expert** legal workspace.
              </p>
              <p className="text-gray-600 text-lg">
                Effortlessly upload documents, organize your **Legal Desks**, and get <br />
                <span className="text-[var(--color-accent)] font-bold">AI-powered insights</span> on any file.
              </p>
              
                <div className="mt-8">
                  <Button variant="primary" onClick={() => { 
                    const search = new URLSearchParams(location.search);
                    search.set('feature', 'chatpdf');
                    navigate({ pathname: '/home', search: search.toString() });
                  }} className="px-8 py-3 font-semibold rounded-full shadow-lg">Go to Legal Desks</Button>
                </div>

            </motion.div>
          )}
          {selectedFeature === "chatpdf" && (
            <>
              {!openNotebookId && (
                <motion.div
                  className="flex flex-col sm:flex-row justify-between items-center mb-8 p-6 bg-surface backdrop-blur-md rounded-2xl shadow-xl"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                    <div className="relative w-full sm:w-1/2">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none" style={{ color: 'var(--palette-3)' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search Legal Dossiers..."
                      className="w-full pl-12 pr-4 py-3 rounded-2xl border bg-surface text-primary placeholder-[var(--color-subtext)] focus:outline-none motion-safe"
                      style={{ borderColor: 'var(--palette-3)', boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.02)' }}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center space-x-3 w-full sm:w-auto mt-4 sm:mt-0">
                    <label htmlFor="sort" className="text-sm" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Sort by:</label>
                    <select
                      id="sort"
                      className="w-full sm:w-auto px-4 py-3 border rounded-2xl bg-surface text-primary focus:outline-none motion-safe"
                      style={{ borderColor: 'var(--palette-3)' }}
                      value={sortOption}
                      onChange={(e) => setSortOption(e.target.value)}
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="title-asc">Title (A-Z)</option>
                      <option value="title-desc">Title (Z-A)</option>
                    </select>
                  </div>
                </motion.div>
              )}

              {openNotebookId ? (
                <div className="h-[85vh] bg-surface rounded-2xl shadow-2xl p-0 overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
                  <NotebookPage id={openNotebookId} onClose={() => setOpenNotebookId(null)} inline />
                </div>
              ) : (
                <>
                  {/* Main Content Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 p-2 w-full">
                    

          {/* Role selection modal: show whenever user is logged in but has no role */}
          {authUser && !authUser.role && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                <div className="bg-surface rounded-xl p-8 w-full max-w-md shadow-xl" style={{ borderColor: 'var(--palette-3)' }}>
                <h3 className="text-xl font-semibold mb-3">Welcome — choose your role</h3>
                <p className="text-sm text-gray-600 mb-6">Are you a Helpseeker (someone seeking legal help) or a Lawyer? You can sign up/login with Google or create local credentials.</p>
                <div className="flex gap-4">
                    <Button variant="primary" onClick={async ()=>{
                    try{
                      await api.post('/auth/set-role',{ role: 'helpseeker' }, { headers: { Authorization: `Bearer ${token}` } });
                      // fetch updated profile and update store
                      const me = await api.get('/auth/me');
                      setUserStore(me.data.user || me.data);
                    }catch(e){console.error(e); alert('Failed to set role')}
                  }} className="flex-1 px-4 py-2">Helper</Button>
                    <Button variant="secondary" onClick={async ()=>{
                    try{
                      await api.post('/auth/set-role',{ role: 'lawyer' }, { headers: { Authorization: `Bearer ${token}` } });
                      const me = await api.get('/auth/me');
                      setUserStore(me.data.user || me.data);
                    }catch(e){console.error(e); alert('Failed to set role')}
                  }} className="flex-1 px-4 py-2">Lawyer</Button>
                </div>
              </div>
            </div>
          )}
                    {/* Create New Legal Dossier Card - HIGHLY EMPHASIZED */}
                    <motion.div
                      onClick={() => setAdding(true)}
                      className="flex flex-col items-center justify-between border-4 border-dashed rounded-3xl cursor-pointer transition-all duration-300 p-8 group relative overflow-hidden shadow-xl bg-card"
                      style={{ borderColor: 'var(--palette-1)', minHeight: '200px' }}
                      whileHover={{ scale: 1.03, rotate: 0 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="w-full text-center">
                        {/* High-contrast Icon */}
                        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 mx-auto transition-colors duration-300 shadow-lg" style={{ background: 'var(--palette-1)', color: 'white' }}>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-10 w-10 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                        <h3 className="text-xl font-extrabold text-primary mb-2">New Legal Dossier</h3>
                        <p className="text-[var(--color-muted)] text-center text-sm">
                          Upload a file and create a secure legal research space.
                        </p>
                      </div>

                      {/* Prominent, Full-Width Button */}
                      <div className="w-full mt-6">
                        <Button variant="primary" className="w-full">Start Upload</Button>
                      </div>
                    </motion.div>

                    <AnimatePresence>
                      {filteredAndSortedChats.map((chat) => (
                        /* Legal Desk Card - Dossier Style with Security emphasis */
                        <motion.div
                          key={chat._id}
                          className="relative group bg-white rounded-xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 border border-gray-100 flex"
                          whileHover={{ y: -4, scale: 1.01 }}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 20 }}
                          transition={{ duration: 0.4 }}
                        >
                          {/* File Spine - Gives a professional, bound document feel */}
                          <div className="w-2 transition-colors duration-300" style={{ background: 'var(--palette-3)' }}></div>

                          <div className="flex-1 p-5 flex flex-col justify-between">
                            <div className="mb-4 text-left"> 
                              {/* Enhanced Icon/Security Badge */}
                              <div className="relative inline-block mb-3">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-9 w-9"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1.5}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                  </svg>
                                  {/* Security Lock Overlay */}
                                  <svg xmlns="http://www.w3.org/2000/svg" className="absolute bottom-0 right-0 h-4 w-4 text-green-600 bg-white rounded-full p-0.5 border border-white" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                  </svg>
                              </div>
                              <h2 className="font-extrabold text-xl truncate px-0 mt-2" style={{ color: 'var(--color-primary)' }}>{chat.title}</h2> {/* Extrabold title */}
                            </div>

                            <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                              {/* Date Tag */}
                              <span className="text-xs font-semibold px-3 py-1 rounded-lg" style={{ color: 'var(--palette-3)', background: 'rgba(69,104,130,0.06)' }}>
                                <span className="mr-1">🗓️</span> {new Date(chat.createdAt).toLocaleDateString()}
                              </span>

                              <div className="flex items-center space-x-2">
                                {/* Open File Button - Made bolder */}
                                <Button variant="primary" onClick={() => handleOpen(chat._id)} className="text-sm px-3 py-1 rounded-lg">Open File</Button>
                                
                                {/* Delete button remains small for secondary action */}
                                <motion.button
                                  onClick={() => handleDelete(chat._id)}
                                  className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-all"
                                  title="Delete legaldesk"
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </motion.button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </>
              )}

              <AnimatePresence>
                {adding && (
                  <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <motion.div
                      className="absolute inset-0 bg-black bg-opacity-40 backdrop-blur-sm"
                      onClick={() => {
                        setAdding(false);
                        setFile(null);
                        setTitle("");
                      }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    ></motion.div>

                    <motion.div
                      className="relative bg-white rounded-3xl shadow-3xl max-w-2xl w-full overflow-hidden border border-blue-200"
                      initial={{ scale: 0.8, opacity: 0, y: 50 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.8, opacity: 0, y: 50 }}
                      transition={{ type: "spring", stiffness: 120 }}
                    >
                      <div className="p-6 border-b flex justify-between items-center bg-surface" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
                        <h2 className="text-xl font-bold text-primary">Create New Legal Dossier</h2>
                        <button
                          onClick={() => {
                            setAdding(false);
                            setFile(null);
                            setTitle("");
                          }}
                          className="rounded-full p-2 text-muted hover:bg-[rgba(0,0,0,0.02)] transition"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="p-8">
                        <div className="mb-6">
                          <label className="block text-sm font-semibold text-primary mb-2">Dossier Title</label>
                          <input
                            type="text"
                            placeholder="e.g., 'NDA Review - Project Alpha'"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="border p-3 rounded-xl w-full bg-surface text-primary placeholder-[var(--color-subtext)] focus:outline-none motion-safe"
                            style={{ borderColor: 'var(--palette-3)' }}
                          />
                        </div>

                        <div
                          className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all"
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                          onClick={() => document.getElementById("file-upload").click()}
                          style={{ borderColor: 'var(--palette-3)' }}
                        >
                          <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-16 w-16 mx-auto text-[var(--palette-3)]"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                              />
                            </svg>
                          </motion.div>
                          <p className="mt-4 text-xl font-bold text-primary">Upload Legal Document</p>
                          <p className="text-sm text-muted mt-1">Drag & drop or click to browse. Max size: 100MB.</p>
                          <p className="text-xs text-gray-400 mt-1">Supported formats: PDF, DOCX, TXT, common image files.</p>
                          <input
                            id="file-upload"
                            type="file"
                            className="hidden"
                            onChange={(e) => setFile(e.target.files[0])}
                          />
                        </div>

                        {file && (
                          <div className="mt-4 p-4 rounded-lg flex items-center justify-between bg-surface border" style={{ borderColor: 'var(--palette-3)' }}>
                            <p className="font-medium text-sm text-primary">Selected File: **{file.name}**</p>
                            <span className="text-xs font-bold text-green-600">READY</span>
                          </div>
                        )}

                        <div className="flex gap-3 justify-end mt-8">
                          <div className="flex gap-3 justify-end mt-8">
                            <Button variant="secondary" onClick={() => { setAdding(false); setFile(null); setTitle(""); }}>Cancel</Button>
                            <Button variant="primary" onClick={handleAddlegaldesk} className="px-6" disabled={!title.trim() || !file || uploading}>
                              {uploading ? (
                                <>
                                  <svg
                                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                  >
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                  </svg>
                                  Securing...
                                </>
                              ) : (
                                "Create Dossier"
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Home;