import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import api from "../Axios/axios";
import papi from "../Axios/paxios";
import useAuthStore from "../context/AuthContext";
import NotebookPage from "./NotebookPage";

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
      <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
        className="bg-white border border-blue-200 rounded-2xl shadow-3xl p-8 w-full max-w-md"
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
              <span className={`text-lg transition-colors duration-300 ${step.status === 'in-progress' ? 'text-blue-700 font-medium' : step.status === 'completed' ? 'text-gray-600' : 'text-gray-400'}`}>
                {step.text}
              </span>
            </motion.div>
          ))}
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          {/* Progress bar uses a deep, solid blue */}
          <motion.div
            className="bg-blue-700 h-2.5 rounded-full"
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
  const logout = useAuthStore((state) => state.logout);
  const [ingestionStatus, setIngestionStatus] = useState([]);
  const [selectedFeature, setSelectedFeature] = useState("home");
  const [openNotebookId, setOpenNotebookId] = useState(null);

  useEffect(() => {
    fetchChats();
    fetchUserProfile();
  }, []);
 
  const fetchUserProfile = async () => {
    try {
      const res = await api.get("/auth/me");
      if (res.data && res.data.user) {
        setUserProfile({
          id: res.data.user.id,
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

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="relative min-h-screen bg-white text-gray-900 font-sans">
      <ModernBackground />

      {/* Header - More authoritative gradient and better background opacity */}
      <header className="w-full flex flex-col items-center px-8 py-6 border-b border-blue-200 bg-white/95 z-20 shadow-lg">
        <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-800 via-blue-600 to-gray-700 bg-clip-text text-transparent drop-shadow-lg font-serif">
          Legal Sah<span className="text-gray-900">AI</span>
        </h1>
        <span className="mt-2 text-lg text-blue-700 font-medium tracking-wide italic">Your Trusted Legal AI Desk</span>
      </header>

      <AnimatePresence>
        {isLoading && <IngestionLoader steps={ingestionStatus} />}
      </AnimatePresence>

      <div className="flex" style={{height: "calc(100vh - 110px)"}}>
        
        {/* Sidebar - Solid white background for stability and icon integration */}
        <aside className="w-72 bg-white border-r border-blue-100 flex flex-col py-10 px-6 shadow-xl">
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-blue-800 mb-6 tracking-wide font-serif">Features</h2>
            
            {/* Feature Button with Icon: Home */}
            <button
              className={`mb-4 w-full flex items-center px-5 py-3 rounded-xl text-left font-semibold transition ${
                selectedFeature === "home" ? "bg-blue-700 text-white shadow-lg" : "text-blue-700 hover:bg-blue-50"
              }`}
              onClick={() => { setSelectedFeature("home"); setOpenNotebookId(null); }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              Dashboard
            </button>
            
            {/* Feature Button with Icon: Legal Desks */}
            <button
              className={`mb-4 w-full flex items-center px-5 py-3 rounded-xl text-left font-semibold transition ${
                selectedFeature === "chatpdf" ? "bg-blue-700 text-white shadow-lg" : "text-blue-700 hover:bg-blue-50"
              }`}
              onClick={() => { setSelectedFeature("chatpdf"); setOpenNotebookId(null); }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.414l3.707 3.707A2 2 0 0116 6.586V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 10a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0-3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0-3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              Legal Desks
            </button>
            {/* Add more features here */}
          </div>
          <div className="mt-auto flex flex-col items-center">
            <img
              src={userProfile.photo}
              alt="Profile"
              className="w-16 h-16 rounded-full border-4 border-blue-300 mb-2 shadow-lg"
            />
            <span className="text-lg font-semibold text-blue-800">{userProfile.name}</span>
            <motion.button
              onClick={handleLogout}
              className="text-xs text-red-500 hover:text-red-700 transition-colors duration-200 mt-2 p-1"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Logout
            </motion.button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 h-full overflow-y-auto p-10">
          {selectedFeature === "home" && (
            <motion.div
              className="max-w-3xl mx-auto mt-24 bg-white/90 rounded-3xl shadow-3xl border border-blue-200 p-12 text-center backdrop-blur-sm"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <h2 className="text-5xl font-extrabold mb-4 text-blue-800 font-serif">Welcome to Legal SahAI 👋</h2>
              <p className="text-gray-700 text-xl mb-3">
                Your **secure, confidential, and expert** legal workspace.
              </p>
              <p className="text-gray-600 text-lg">
                Effortlessly upload documents, organize your **Legal Desks**, and get <br />
                <span className="text-blue-700 font-bold">AI-powered insights</span> on any file.
              </p>
              
              <motion.button
                className="mt-8 px-8 py-3 bg-blue-700 text-white font-semibold rounded-full shadow-lg hover:bg-blue-800 transition-colors duration-300"
                onClick={() => { setSelectedFeature("chatpdf"); }}
                whileHover={{ scale: 1.05, boxShadow: "0 10px 15px -3px rgba(37, 99, 235, 0.5)" }}
                whileTap={{ scale: 0.98 }}
              >
                Go to Legal Desks
              </motion.button>

            </motion.div>
          )}
          {selectedFeature === "chatpdf" && (
            <>
              {!openNotebookId && (
                <motion.div
                  className="flex flex-col sm:flex-row justify-between items-center mb-8 p-6 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-blue-100"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  <div className="relative w-full sm:w-1/2">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-blue-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search Legal Dossiers..."
                      className="w-full pl-12 pr-4 py-3 rounded-2xl border border-blue-200 bg-white text-gray-700 placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all duration-200"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center space-x-3 w-full sm:w-auto mt-4 sm:mt-0">
                    <label htmlFor="sort" className="text-sm text-blue-700 font-medium">Sort by:</label>
                    <select
                      id="sort"
                      className="w-full sm:w-auto px-4 py-3 border border-blue-200 rounded-2xl bg-white text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all duration-200"
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
                <div className="h-[75vh] bg-white rounded-2xl shadow-2xl p-0 overflow-hidden border border-blue-200">
                  <NotebookPage id={openNotebookId} onClose={() => setOpenNotebookId(null)} inline />
                </div>
              ) : (
                <>
                  {/* Main Content Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 p-4">
                    
                    {/* Create New Legal Dossier Card - HIGHLY EMPHASIZED */}
                    <motion.div
                      onClick={() => setAdding(true)}
                      className="flex flex-col items-center justify-between border-4 border-dashed border-blue-600 rounded-3xl cursor-pointer hover:border-blue-800 bg-blue-50 hover:bg-blue-100 transition-all duration-300 p-8 group relative overflow-hidden shadow-xl"
                      whileHover={{ scale: 1.03, rotate: 0 }}
                      whileTap={{ scale: 0.98 }}
                      style={{ minHeight: '200px' }} // Ensure cards are roughly the same height
                    >
                      <div className="w-full text-center">
                        {/* High-contrast Icon */}
                        <div className="w-20 h-20 bg-blue-700 rounded-full flex items-center justify-center mb-4 mx-auto group-hover:bg-blue-800 transition-colors duration-300 shadow-lg">
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
                        <h3 className="text-xl font-extrabold text-blue-800 mb-2">New Legal Dossier</h3>
                        <p className="text-blue-700 text-center text-sm">
                          Upload a file and create a secure legal research space.
                        </p>
                      </div>

                      {/* Prominent, Full-Width Button */}
                      <div className="w-full mt-6">
                        <motion.button
                          className="w-full py-3 bg-blue-700 text-white rounded-xl text-lg font-bold group-hover:bg-blue-800 transition-colors shadow-xl"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          Start Upload
                        </motion.button>
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
                          <div className="w-2 bg-blue-700 group-hover:bg-blue-800 transition-colors duration-300"></div> 

                          <div className="flex-1 p-5 flex flex-col justify-between">
                            <div className="mb-4 text-left"> 
                              {/* Enhanced Icon/Security Badge */}
                              <div className="relative inline-block mb-3">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-9 w-9 text-blue-500"
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
                              <h2 className="font-extrabold text-xl text-gray-800 truncate px-0 mt-2">{chat.title}</h2> {/* Extrabold title */}
                            </div>

                            <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                              {/* Date Tag */}
                              <span className="text-xs font-semibold text-blue-800 bg-blue-100 px-3 py-1 rounded-lg">
                                <span className="mr-1">🗓️</span> {new Date(chat.createdAt).toLocaleDateString()}
                              </span>

                              <div className="flex items-center space-x-2">
                                {/* Open File Button - Made bolder */}
                                <motion.button
                                  onClick={() => handleOpen(chat._id)}
                                  className="text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-lg transition-colors shadow-md"
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                >
                                  Open File
                                </motion.button>
                                
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
                      <div className="p-6 border-b border-blue-100 flex justify-between items-center bg-blue-50">
                        <h2 className="text-xl font-bold text-blue-800">Create New Legal Dossier</h2>
                        <button
                          onClick={() => {
                            setAdding(false);
                            setFile(null);
                            setTitle("");
                          }}
                          className="rounded-full p-2 text-blue-500 hover:bg-blue-100 transition"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="p-8">
                        <div className="mb-6">
                          <label className="block text-sm font-semibold text-blue-700 mb-2">Dossier Title</label>
                          <input
                            type="text"
                            placeholder="e.g., 'NDA Review - Project Alpha'"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="border border-blue-200 p-3 rounded-xl w-full focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white text-gray-800 placeholder-gray-400"
                          />
                        </div>

                        <div
                          className="border-2 border-dashed border-blue-300 rounded-2xl p-10 text-center cursor-pointer hover:border-blue-600 hover:bg-blue-50 transition-all"
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                          onClick={() => document.getElementById("file-upload").click()}
                        >
                          <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-16 w-16 mx-auto text-blue-500"
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
                          <p className="mt-4 text-xl font-bold text-blue-800">Upload Legal Document</p>
                          <p className="text-sm text-blue-500 mt-1">Drag & drop or click to browse. Max size: 100MB.</p>
                          <p className="text-xs text-gray-400 mt-1">Supported formats: PDF, DOCX, TXT, common image files.</p>
                          <input
                            id="file-upload"
                            type="file"
                            className="hidden"
                            onChange={(e) => setFile(e.target.files[0])}
                          />
                        </div>

                        {file && (
                          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200 text-blue-800 flex items-center justify-between">
                            <p className="font-medium text-sm">Selected File: **{file.name}**</p>
                            <span className="text-xs font-bold text-green-600">READY</span>
                          </div>
                        )}

                        <div className="flex gap-3 justify-end mt-8">
                          <motion.button
                            onClick={() => {
                              setAdding(false);
                              setFile(null);
                              setTitle("");
                            }}
                            className="px-6 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 transition text-gray-700 font-medium"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            Cancel
                          </motion.button>
                          <motion.button
                            onClick={handleAddlegaldesk}
                            disabled={!title.trim() || !file || uploading}
                            className="px-6 py-2 rounded-xl bg-blue-700 text-white font-medium hover:bg-blue-800 disabled:bg-blue-200 disabled:text-blue-400 transition flex items-center shadow-lg"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
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
                          </motion.button>
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