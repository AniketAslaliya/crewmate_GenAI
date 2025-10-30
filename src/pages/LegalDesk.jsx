import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import api from "../Axios/axios";
import papi from "../Axios/paxios";
import Button from '../components/ui/Button';

// Modern legal background with enhanced professional pattern
const ModernBackground = () => (
  <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
    <div className="absolute inset-0 -z-10 opacity-[0.03] pointer-events-none"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23000000' fill-opacity='0.1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat"
      }}
    />
    {/* Enhanced gradient overlays */}
    <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-blue-600/5 to-transparent" />
    <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-gradient-to-t from-indigo-600/3 to-transparent" />
  </div>
);

const StatusIcon = ({ status }) => {
  if (status === 'completed') {
    return (
      <motion.div 
        initial={{ scale: 0 }} 
        animate={{ scale: 1 }} 
        className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-emerald-500/25"
      >
        ✓
      </motion.div>
    );
  }
  if (status === 'in-progress') {
    return (
      <div className="w-6 h-6 flex items-center justify-center">
        <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }
  return <div className="w-6 h-6 bg-gray-300 rounded-full border-2 border-gray-400 border-dashed" />;
};

const IngestionLoader = ({ steps }) => {
  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const progress = (steps.length > 0) ? (completedSteps / steps.length) * 100 : 0;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-lg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div 
        className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-2xl mx-4 border border-blue-100"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 100 }}
      >
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2 font-serif">Securing Your Legal Desk</h2>
          <p className="text-gray-600 text-lg">
            Your documents are being encrypted with military-grade security protocols
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              className="flex items-center space-x-4 p-4 rounded-2xl bg-gray-50/50 border border-gray-100"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <StatusIcon status={step.status} />
              <div className="flex-1">
                <span className={`text-lg font-medium transition-all duration-300 ${
                  step.status === 'in-progress' ? 'text-blue-600' : 
                  step.status === 'completed' ? 'text-gray-900' : 'text-gray-500'
                }`}>
                  {step.text}
                </span>
                {step.status === 'in-progress' && (
                  <motion.div 
                    className="h-1 bg-blue-200 rounded-full mt-2 overflow-hidden"
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <div className="h-full bg-blue-600 rounded-full animate-pulse" />
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Processing...</span>
            <span className="font-semibold">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <motion.div
              className="h-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25"
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const LegalDesk = () => {
  const [chats, setChats] = useState([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState({ name: null, photo: "", id: null });
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [ingestionStatus, setIngestionStatus] = useState([]);

  useEffect(() => {
    fetchChats();
    fetchUserProfile();
  }, []);

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
    } catch (err) {
      console.error("Failed to fetch chats:", err);
    }
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
        { id: 2, text: "Parsing and segmenting legal clauses...", status: 'pending' },
        { id: 3, text: "Generating legal knowledge embeddings...", status: 'pending' },
        { id: 4, text: "Encrypting with AES-256 security...", status: 'pending' },
        { id: 5, text: "Indexing for rapid legal search...", status: 'pending' },
  { id: 6, text: "Finalizing your Legal Desk...", status: 'pending' }
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

      await Promise.all([ingestPromise, updateProgress()]);
      
      setIngestionStatus(prev => prev.map(step => ({ ...step, status: 'completed' })));
      await new Promise(resolve => setTimeout(resolve, 500));

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
  if (window.confirm("Are you sure you want to delete this Legal Desk? This action cannot be undone.")) {
      try {
        await api.delete(`/api/delete/${id}`);
        setChats(chats.filter((chat) => chat._id !== id));
      } catch (err) {
  alert("Failed to delete Legal Desk. Please try again.");
      }
    }
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

  const filteredAndSortedChats = [...chats]
    .filter((chat) => chat.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === "name") return a.title?.localeCompare(b.title);
      return 0;
    });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 font-sans">
      <ModernBackground />

      <AnimatePresence>
        {isLoading && <IngestionLoader steps={ingestionStatus} />}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header Section */}
        
        {/* Controls Section */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex flex-col lg:flex-row gap-6 items-center justify-between p-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-blue-100">
            <div className="flex-1 w-full lg:max-w-md">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-blue-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search legal desks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="pl-3 pr-1 py-3  rounded-xl border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name">Alphabetical</option>
              </select>

              <Button
                variant="primary"
                onClick={() => setAdding(true)}
                className="px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Legal Desk
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats Overview */}
        

        {/* Main Grid */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {/* Create New Card */}
          <motion.div
            onClick={() => setAdding(true)}
            className="group cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 border-2 border-dashed border-blue-300 rounded-3xl p-8 h-full flex flex-col items-center justify-center text-center transition-all duration-300 group-hover:border-blue-400 group-hover:from-blue-100 group-hover:to-indigo-200 min-h-[320px]">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Create New Legal Desk</h3>
              <p className="text-gray-600 leading-relaxed">
                Start a new Legal Desk with secure document upload and AI-powered analysis
              </p>
            </div>
          </motion.div>

          {/* Legal Desk Cards */}
          {filteredAndSortedChats.map((chat, index) => (
            <motion.div
              key={chat._id}
              className="group"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              layout
            >
              <div className="bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 overflow-hidden h-full flex flex-col">
                {/* Card Header */}
                <div className="p-6 pb-4 flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-xs font-semibold text-emerald-600">SECURE</span>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 leading-tight">
                    {chat.title}
                  </h3>

                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-600">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {new Date(chat.createdAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {new Date(chat.createdAt).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="p-6 pt-4 border-t border-gray-100 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="primary"
                      onClick={() => navigate(`/legal-desk/${chat._id}`)}
                      className="flex-1 mr-3 py-3 rounded-xl font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all"
                    >
                      Open Legal Desk
                    </Button>
                    
                    <motion.button
                      onClick={() => handleDelete(chat._id)}
                      className="p-3 text-gray-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition-all duration-200"
                      title="Delete Legal Desk"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Empty State */}
        {filteredAndSortedChats.length === 0 && chats.length === 0 && (
          <motion.div 
            className="text-center py-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="w-32 h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">No Legal Desks Yet</h3>
            <p className="text-gray-600 max-w-md mx-auto mb-8">
              Create your first Legal Desk to start securely managing and analyzing your legal documents with AI-powered insights.
            </p>
            <Button
              variant="primary"
              onClick={() => setAdding(true)}
              className="px-8 py-4 rounded-xl text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all"
            >
              Create Your First Legal Desk
            </Button>
          </motion.div>
        )}
      </div>

  {/* Create Legal Desk Modal */}
      <AnimatePresence>
        {adding && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-lg"
              onClick={() => {
                setAdding(false);
                setFile(null);
                setTitle("");
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            <motion.div
              className={`relative bg-white rounded-3xl shadow-2xl ${file ? 'max-w-lg' : 'max-w-2xl'}   w-full mx-auto border border-blue-100`}
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            >
              {/* Modal Header */}
              <div className={`p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-3xl`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-1">Create New Legal Desk</h2>
                    <p className="text-gray-600">Securely upload and analyze your legal documents</p>
                  </div>
                  <button
                    onClick={() => {
                      setAdding(false);
                      setFile(null);
                      setTitle("");
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-2xl hover:bg-white transition-all duration-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className={`${file ? 'p-2' : 'p-4'} `}>
                <div className="space-y-6">
                  {/* Title Input */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      Legal Desk Title *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., 'NDA Review - Project Alpha'"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-4 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>

                  {/* File Upload Area */}
                  <div>
                    <label className="block text-sm font-semibold  text-gray-900 mb-3">
                      Legal Document *
                    </label>
                    <motion.div
                      className={`border-3 border-dashed rounded-2xl ${file ? 'p-2' : 'p-4'} text-center cursor-pointer transition-all bg-gradient-to-br from-gray-50 to-blue-50/30 ${file ? '' : 'group'}`}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onClick={() => document.getElementById("file-upload").click()}
                      whileHover={file ? {} : { scale: 1.02 }}
                      whileTap={file ? {} : { scale: 0.98 }}
                      style={{ borderColor: file ? '#10B981' : '#E5E7EB' }}
                    >
                      <motion.div
                        animate={file ? { y: 0 } : { y: [0, -8, 0] }}
                        transition={file ? { duration: 0 } : { repeat: Infinity, duration: 3, ease: "easeInOut" }}
                      >
                        <svg className={`${file ? 'w-6 h-6 mb-2' : 'w-16 h-16 mb-4'} mx-auto text-blue-500 ${file ? '' : 'group-hover:text-blue-600'} transition-colors`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </motion.div>
                      <p className={`${file ? 'text-sm' : 'text-2xl'} font-semibold text-gray-900 ${file ? 'mb-1' : 'mb-2'}`}>
                        {file ? "Document Ready" : "Upload Legal Document"}
                      </p>
                      <p className={`${file ? 'text-xs' : 'text-gray-600'} ${file ? 'mb-0' : 'mb-2'}`}>
                        {file ? "Ready to upload securely" : "Drag & drop or click to browse files"}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        Maximum file size: 100MB • Supported: PDF, DOCX, TXT, Images
                      </p>
                      <input
                        id="file-upload"
                        type="file"
                        className="hidden"
                        onChange={(e) => setFile(e.target.files[0])}
                      />
                    </motion.div>
                  </div>

                  {/* File Preview */}
                  {file && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="p-2 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-emerald-500 rounded-md flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-semibold text-gray-900 text-xs truncate">{file.name}</p>
                          <p className="text-[11px] text-gray-600">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-500 text-white text-[11px] font-semibold rounded-md">
                        SECURE
                      </span>
                    </motion.div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 justify-end mt-3 pt-6 border-t border-gray-100">
                  <Button
                    variant="secondary"
                    onClick={() => { setAdding(false); setFile(null); setTitle(""); }}
                    className="px-8 py-4 rounded-xl font-semibold border border-gray-300 hover:border-gray-400 transition-all"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleAddlegaldesk}
                    className="px-8 py-4 rounded-xl font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!title.trim() || !file || uploading}
                  >
                    {uploading ? (
                      <div className="flex items-center space-x-2">
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Securing Document...</span>
                      </div>
                    ) : (
                      "Create Secure Legal Desk"
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LegalDesk;