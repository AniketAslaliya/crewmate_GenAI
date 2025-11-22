import React, { useEffect, useState, useCallback } from "react";
import useAuthStore from '../context/AuthContext';
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import api from "../Axios/axios";
import papi from "../Axios/paxios";
import RiskViewer from '../components/RiskViewer';
import Button from '../components/ui/Button';
import { useToast } from '../components/ToastProvider';
import { useGuestAccess } from '../hooks/useGuestAccess';
import GuestAccessModal from '../components/GuestAccessModal';
import { sanitizeTextInput, validateFile, checkRateLimit } from '../utils/inputSecurity';
// Removed problematic pdfjs-dist/web/pdf_viewer.css import; using canvas-based PDF rendering as in forms
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
        className="bg-white rounded-2xl shadow-lg p-4 w-full max-w-lg mx-4 border border-blue-100"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.04, type: "spring", stiffness: 160 }}
      >
        <div className="text-center mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-md">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Securing Your Legal Desk</h2>
          <p className="text-sm text-gray-600">Your documents are being encrypted with security protocols</p>
        </div>

        <div className="space-y-3 mb-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center space-x-3 p-3 rounded-xl bg-gray-50/60 border border-gray-100">
              <StatusIcon status={step.status} />
              <div className="flex-1">
                <div className={`text-sm font-medium ${step.status === 'in-progress' ? 'text-blue-600' : step.status === 'completed' ? 'text-gray-900' : 'text-gray-500'}`}>
                  {step.text}
                </div>
                {step.status === 'in-progress' && (
                  <div className="h-1 bg-blue-200 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full animate-pulse" style={{ width: '100%' }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Processing...</span>
            <span className="font-semibold">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
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
  // Remove local userProfile state, use zustand
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [ingestionStatus, setIngestionStatus] = useState([]);
  const toast = useToast();
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ show: false, deskId: null, deskTitle: '' });
  const [riskModal, setRiskModal] = useState({ open: false, chat: null });
  // Supported output languages for AI features (matches upload UI)
  const languages = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'hi', label: 'हिन्दी', short: 'HI' },
    { code: 'gu', label: 'ગુજરાતી', short: 'GU' },
    { code: 'mr', label: 'मराठी', short: 'MR' },
    { code: 'ta', label: 'தமிழ்', short: 'TA' },
    { code: 'te', label: 'తెలుగు', short: 'TE' },
    { code: 'bn', label: 'বাংলা', short: 'BN' },
    { code: 'kn', label: 'ಕನ್ನಡ', short: 'KN' },
    { code: 'ml', label: 'മലയാളം', short: 'ML' },
    { code: 'pa', label: 'ਪੰਜਾਬੀ', short: 'PA' },
  ];
  const [selectedOutputLang, setSelectedOutputLang] = useState('en');
  // UI: maximum characters to show for short summary in card views
  const SUMMARY_DISPLAY_MAX_CHARS = 200;
  const formatSummaryForDisplay = (s) => {
    if (!s) return 'No summary available.';
    if (s.length > SUMMARY_DISPLAY_MAX_CHARS) return s.slice(0, SUMMARY_DISPLAY_MAX_CHARS).trimEnd() + '…';
    return s;
  };
  
  // Guest access control
  const { isGuest, showGuestModal, blockedFeature, checkGuestAccess, closeGuestModal } = useGuestAccess();
  // Per-chat loading states for buttons
  const [loadingOpenIds, setLoadingOpenIds] = useState([]); // ids for "Open Legal Desk"
  const [loadingRiskIds, setLoadingRiskIds] = useState([]); // ids for "View Risk"

  const setOpenLoading = (id, loading) => {
    setLoadingOpenIds(prev => {
      if (loading) return Array.from(new Set([...prev, id]));
      return prev.filter(x => x !== id);
    });
  };

  const setRiskLoading = (id, loading) => {
    setLoadingRiskIds(prev => {
      if (loading) return Array.from(new Set([...prev, id]));
      return prev.filter(x => x !== id);
    });
  };


  const fetchChats = useCallback(async () => {
    try {
      const res = await api.get("/api/getallchats");
      setChats(res.data.chats || []);
    } catch (err) {
      console.error("Failed to fetch chats:", err);
      const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to fetch chats';
      toast.error(errorMsg);
    }
  }, [toast]);

  // Get user from zustand
  const user = useAuthStore(state => state.user);
  useEffect(() => {
    // Don't fetch past chats for guests
    if (!isGuest) {
      fetchChats();
    }
    // No need to fetch user profile here, zustand handles it
  }, [isGuest, fetchChats]);

  const handleAddlegaldesk = async () => {
    // Check guest access - block if access denied
    if (!checkGuestAccess('Legal Desk Creation')) {
      return;
    }
    
    // Rate limiting check (max 5 uploads per minute)
    const rateCheck = checkRateLimit('legal_desk_upload', 5, 60000);
    if (!rateCheck.allowed) {
      toast.error(`Too many upload attempts. Please wait before trying again.`);
      return;
    }
    
    if (!file || !title.trim()) {
      toast.error("Please provide both a title and a file.");
      return;
    }

    // Sanitize title input
    const sanitizedTitle = sanitizeTextInput(title.trim());
    if (!sanitizedTitle) {
      toast.error("Invalid title. Please use only valid characters.");
      return;
    }

    // Re-validate file before upload
    const validation = validateFileWithSecurity(file);
    if (!validation.isValid) {
      return;
    }

    setUploading(true);

    try {
      // 1. Create legal desk entry
      // Persist chat and upload file to our backend (stores to GCS)
      const createForm = new FormData();
      createForm.append('title', sanitizedTitle);
      createForm.append('file', file);
      // Persist preferred AI output language with the upload
      createForm.append('output_language', selectedOutputLang);
      const res1 = await api.post("/api/uploaddoc", createForm, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (!res1.data?.chat) throw new Error("Failed to create legal desk entry.");

      const newChat = res1.data.chat;
      // show a temporary preview while backend signs URL
      setChats(prev => [{ ...newChat, summary: 'Generating summary...', previewUrl: file ? URL.createObjectURL(file) : undefined }, ...prev]);
      setAdding(false);
      setIsLoading(true);

      const steps = [
        { id: 1, text: "Uploading secure document...", status: 'pending' },
        { id: 2, text: "Parsing and segmenting legal clauses...", status: 'pending' },
        { id: 3, text: "Generating legal knowledge embeddings...", status: 'pending' },
        { id: 4, text: "Encrypting with security...", status: 'pending' },
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

      // 2. Ingest document (must succeed before next steps)
      const formData = new FormData();
      formData.append("user_id", user?._id || "");
      formData.append("thread_id", newChat._id);
      formData.append("title", sanitizedTitle);
      formData.append("file", file);
      // Inform ingestion service of the desired output language
      formData.append('output_language', selectedOutputLang);

      // Start risk upload in parallel to ingestion. We do not depend on its result
      // for the summary flow, but we will update the UI once it completes.
      // Start external ingestion + risk calls via papi (external service)
      let riskPromise = null;
      try {
        const riskForm = new FormData();
        riskForm.append('user_id', user?._id || '');
        riskForm.append('thread_id', newChat._id);
        riskForm.append('file', file);
        riskForm.append('output_language', selectedOutputLang);
        // Call external risk endpoint via papi
        riskPromise = papi.post('/api/upload-risk-doc', riskForm, { headers: { 'Content-Type': 'multipart/form-data' } });
      } catch (e) {
        console.warn('Failed to start risk upload', e);
      }

      await Promise.all([
        papi.post("/api/ingest", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        }),
        updateProgress()
      ]);

      // 3. After ingest, call summary only
      let summaryText = '';
      const SUMMARY_UNREADABLE_FALLBACK = "The provided document excerpts are encrypted and unreadable. Therefore, I cannot summarize their core content or describe what the document is or does.";
      try {
        const summaryRes = await papi.post(
          '/api/short-summary',
          {
            user_id: user?._id || '',
            thread_id: newChat._id,
            output_language: selectedOutputLang
          }
        );
        summaryText = summaryRes.data?.summary || '';
      } catch (e) {
        summaryText = '';
      }

      // If summary is empty or not useful, replace with user-requested fallback sentence
      if (!summaryText || !summaryText.trim()) {
        summaryText = SUMMARY_UNREADABLE_FALLBACK;
      }

      // Save summary to desk (chat) in DB (persist fallback as well so UI shows consistent message)
      try {
        await api.patch(`/api/chats/${newChat._id}/summary`, { summary: summaryText });
        // Also persist the chosen output language on the chat record if backend supports it
        try {
          await api.patch(`/api/chats/${newChat._id}`, { output_language: selectedOutputLang });
        } catch (e) {
          // ignore - optional backend support
        }
      } catch (e) {
        // Optionally handle error
      }

      setIngestionStatus(prev => prev.map(step => ({ ...step, status: 'completed' })));
      await new Promise(resolve => setTimeout(resolve, 500));

      // Handle summary response in UI
      setChats(prev => prev.map(desk =>
        desk._id === newChat._id ? { ...desk, summary: summaryText, output_language: selectedOutputLang } : desk
      ));
      // Optionally: handle/display risk analysis result here if needed
      // Wait for risk result if it was started and update UI with returned JSON
      if (riskPromise) {
        try {
          const riskRes = await riskPromise;
          const riskJson = riskRes.data;
          // persist risk JSON into our backend so it remains available
          try {
            await api.post(`/api/chats/${newChat._id}/risk`, { result: riskJson });
          } catch (e) {
            console.warn('Failed to persist risk to backend', e);
          }
          // update UI with risk result
          setChats(prev => prev.map(desk => desk._id === newChat._id ? ({ ...desk, riskAnalyses: [ ...(desk.riskAnalyses || []), { createdAt: new Date().toISOString(), result: riskJson } ] }) : desk));
        } catch (e) {
          console.warn('Risk upload failed', e);
        }
      }

      // Use backend proxy download endpoint (same-origin) to avoid CORS issues with signed URLs
      // This endpoint will stream the file through our backend: /api/chats/:id/download?proxy=1
      setChats(prev => prev.map(desk => desk._id === newChat._id ? ({ ...desk, previewUrl: `/api/chats/${newChat._id}/download?proxy=1` }) : desk));

    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Error creating legal desk. Please try again.';
      toast.error(errorMsg);
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
      setDeleteConfirmModal({ show: false, deskId: null, deskTitle: '' });
      toast.success('Legal Desk deleted successfully');
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to delete Legal Desk. Please try again.';
      toast.error(errorMsg);
    }
  };

  // Open Risk viewer: fetch file via our backend (with auth) as arraybuffer and pass Blob to RiskViewer
  const handleOpenRisk = async (chat) => {
    if (!checkGuestAccess('Legal Desk Access')) return;
    setRiskLoading(chat._id, true);
    try {
      // Try to fetch proxied file from backend using axios client (sends auth headers/cookies)
      const resp = await api.get(`/api/chats/${chat._id}/download?proxy=1`, { responseType: 'arraybuffer' });
      const blob = new Blob([resp.data], { type: chat.fileMimeType || 'application/pdf' });
      setRiskModal({ open: true, chat: { ...chat, fileBlob: blob } });
    } catch (err) {
      console.error('Failed to fetch preview via proxy, falling back to previewUrl', err);
      toast.error('Failed to load document preview. Trying fallback.');
      setRiskModal({ open: true, chat });
    } finally {
      setRiskLoading(chat._id, false);
    }
  };

  const openDeleteConfirmation = (chat) => {
    setDeleteConfirmModal({ show: true, deskId: chat._id, deskTitle: chat.title });
  };

  // Comprehensive file validation with security checks
  const validateFileWithSecurity = (file) => {
    const validation = validateFile(file, {
      maxSizeMB: 100,
      allowedExtensions: ['pdf', 'docx', 'doc', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'bmp'],
      allowedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/bmp'
      ]
    });

    // Extra: block files with multiple extensions if any are not allowed
    const fileName = file.name || '';
    const extParts = fileName.toLowerCase().split('.').slice(1);
    const allowedExtensions = ['pdf', 'docx', 'doc', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'bmp'];
    if (extParts.length > 1) {
      for (const ext of extParts) {
        if (!allowedExtensions.includes(ext)) {
          toast.error(`File extension .${ext} is not allowed`);
          return { isValid: false };
        }
      }
    }

    if (!validation.isValid) {
      validation.errors.forEach(error => toast.error(error));
      return { isValid: false };
    }

    return { isValid: true, sanitizedFileName: validation.sanitizedFileName };
  };

  // Extract clean filename handling double extensions like .txt.pdf
  const extractCleanFileName = (fileName) => {
    // Remove all extensions (handles double extensions like .txt.pdf)
    let cleanName = fileName;
    const parts = fileName.split('.');
    
    // If there are multiple parts, keep only the base name
    if (parts.length > 1) {
      // Check if second-to-last part might be an extension (like .txt in .txt.pdf)
      const secondExt = parts[parts.length - 2]?.toLowerCase();
      const commonExts = ['txt', 'pdf', 'doc', 'docx'];
      
      if (parts.length > 2 && commonExts.includes(secondExt)) {
        // Double extension detected, remove both
        cleanName = parts.slice(0, -2).join('.');
      } else {
        // Single extension, remove it
        cleanName = parts.slice(0, -1).join('.');
      }
    }
    
    // Truncate to 20 characters with ellipsis
    if (cleanName.length > 20) {
      cleanName = cleanName.substring(0, 20) + '...';
    }
    
    return cleanName || fileName;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const selectedFile = files[0];
      
      // Comprehensive security validation
      const validation = validateFileWithSecurity(selectedFile);
      if (!validation.isValid) {
        return;
      }
      
      setFile(selectedFile);
      // Auto-capture file name without extension (15-20 chars) with sanitization
      if (!title.trim()) {
        const fileName = extractCleanFileName(validation.sanitizedFileName || selectedFile.name);
        const sanitizedFileName = sanitizeTextInput(fileName);
        setTitle(sanitizedFileName);
      }
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Comprehensive security validation
      const validation = validateFileWithSecurity(selectedFile);
      if (!validation.isValid) {
        e.target.value = ''; // Reset input
        return;
      }
      
      setFile(selectedFile);
      // Auto-capture file name without extension (15-20 chars) with sanitization
      if (!title.trim()) {
        const fileName = extractCleanFileName(validation.sanitizedFileName || selectedFile.name);
        const sanitizedFileName = sanitizeTextInput(fileName);
        setTitle(sanitizedFileName);
      }
    }
  };

  // Sanitize search query to prevent XSS
  const sanitizedSearchQuery = sanitizeTextInput(searchQuery);
  
  const filteredAndSortedChats = [...chats]
    .filter((chat) => chat.title?.toLowerCase().includes(sanitizedSearchQuery.toLowerCase()))
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
        

        {/* No Legal Desks Message - Above Content */}
        {filteredAndSortedChats.length === 0 && chats.length === 0 && (
          <motion.div 
            className="text-center py-12 mb-8 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-blue-100"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">No Legal Desks Available</h3>
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

        {/* Main Grid - Only show if there are desks */}
        {(filteredAndSortedChats.length > 0 || chats.length > 0) && (
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
                    <motion.button
                        onClick={() => openDeleteConfirmation(chat)}
                        className="p-3 text-red-500 hover:text-red-600 rounded-xl hover:bg-red-50 transition-all duration-200 border border-red-100 hover:border-red-200 focus:outline-none focus:ring-2 focus:ring-red-200"
                        title="Delete Legal Desk"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path  strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </motion.button>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 leading-tight" title={chat.title}>
                    {chat.title && chat.title.length > 15 ? `${chat.title.substring(0, 15)}...` : chat.title}
                  </h3>

                  {/* Show summary if available, else fallback */}
                  <div className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 min-h-[48px] mt-2" title={chat.summary || ''}>
                    {formatSummaryForDisplay(chat.summary)}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="p-6 pt-4 border-t border-gray-100 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="primary"
                      onClick={() => {
                        if (!checkGuestAccess('Legal Desk Access')) return;
                        setOpenLoading(chat._id, true);
                        try {
                          navigate(`/legal-desk/${chat._id}`);
                        } finally {
                          // Clear the loading state shortly after navigate in case component doesn't unmount immediately
                          setTimeout(() => setOpenLoading(chat._id, false), 600);
                        }
                      }}
                      disabled={loadingOpenIds.includes(chat._id)}
                      aria-label="Open Legal Desk"
                      title="Open Legal Desk"
                      className={`flex-1 mr-3 inline-flex items-center justify-center gap-3 py-3 rounded-xl font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 ${loadingOpenIds.includes(chat._id) ? 'bg-gray-300 text-gray-700 cursor-wait' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'}`}
                    >
                      {loadingOpenIds.includes(chat._id) ? (
                        <div className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                          </svg>
                          <span>Opening...</span>
                        </div>
                      ) : (
                        <>
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-4" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 4h6v6" />
                          </svg>
                          <span className="text-white">Open</span>
                        </>
                      )}
                    </Button>
                    
                    <div className="flex items-center gap-2">
                      {((chat.riskAnalyses && chat.riskAnalyses.length > 0) || chat.previewUrl) && (
                        <button
                          onClick={() => handleOpenRisk(chat)}
                          disabled={loadingRiskIds.includes(chat._id)}
                          aria-label="View Risk Analysis"
                          title="View Risk Analysis"
                          className={`inline-flex items-center gap-2 px-4 py-3 text-sm rounded-xl font-semibold mr-0 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300 ${loadingRiskIds.includes(chat._id) ? 'bg-red-200 text-red-800 cursor-wait' : 'bg-white text-red-700 border border-red-100 hover:bg-red-50'}`}
                        >
                          {loadingRiskIds.includes(chat._id) ? (
                            <div className="flex items-center gap-2">
                              <svg className="animate-spin h-4 w-4 text-red-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                              </svg>
                              <span>Loading...</span>
                            </div>
                          ) : (
                            <>
                              
                              <span className="text-sm font-semibold">View Risk</span>
                            </>
                          )}
                        </button>
                      )}

                      
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
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
                      onChange={(e) => {
                        const sanitized = sanitizeTextInput(e.target.value);
                        setTitle(sanitized);
                      }}
                      maxLength={100}
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
                        accept=".pdf,.docx,.doc,.txt,.jpg,.jpeg,.png,.gif,.bmp,image/*"
                        className="hidden"
                        onChange={handleFileSelect}
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
                {/* Output language selector for AI features */}
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">AI Output Language</label>
                  <select
                    value={selectedOutputLang}
                    onChange={(e) => setSelectedOutputLang(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  >
                    {languages.map(lang => (
                      <option key={lang.code} value={lang.code}>{lang.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-2">Select preferred language for AI-generated summaries and analyses.</p>
                </div>
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
      
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmModal.show && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setDeleteConfirmModal({ show: false, deskId: null, deskTitle: '' })}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            <motion.div
              className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-auto border border-red-100"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Legal Desk?</h3>
                    <p className="text-gray-600 text-sm">
                      Are you sure you want to delete <span className="font-semibold text-gray-900">"{deleteConfirmModal.deskTitle}"</span>? This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 bg-red-50/30">
                <div className="flex items-start gap-3 text-sm text-gray-700">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="leading-relaxed">
                    All associated documents, chat history, and analysis will be permanently deleted.
                  </p>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
                <Button
                  variant="secondary"
                  onClick={() => setDeleteConfirmModal({ show: false, deskId: null, deskTitle: '' })}
                  className="px-6 py-2.5 rounded-lg font-medium border border-gray-300 hover:border-gray-400 transition-all"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleDelete(deleteConfirmModal.deskId)}
                  className="px-6 py-2.5 rounded-lg font-medium bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl transition-all border-2 border-red-600 focus:outline-none focus:ring-4 focus:ring-red-200"
                >
                  Delete Legal Desk
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guest Access Modal */}
      {/* Risk Viewer Modal */}
      {riskModal.open && (
        <RiskViewer
          fileUrl={riskModal.chat?.previewUrl}
          fileBlob={riskModal.chat?.fileBlob || null}
          riskData={(riskModal.chat && riskModal.chat.riskAnalyses && riskModal.chat.riskAnalyses.length) ? riskModal.chat.riskAnalyses[riskModal.chat.riskAnalyses.length - 1].result : (riskModal.chat && riskModal.chat.riskAnalyses) || null}
          onClose={() => setRiskModal({ open: false, chat: null })}
        />
      )}

      <GuestAccessModal
        isOpen={showGuestModal}
        onClose={closeGuestModal}
        featureName={blockedFeature}
      />
    </div>
  );
};

export default LegalDesk;