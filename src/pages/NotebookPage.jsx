import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from 'react-markdown';
import api from "../Axios/axios";
import papi from "../Axios/paxios";
import useNotebookStore from "../context/NotebookStore";
import { sanitizeTextInput, checkRateLimit } from "../utils/inputSecurity";
import Timeline from "../components/Timeline";
import MermaidMindMap from "../components/MermaidMindMap";
import PredictiveDisplay from '../components/PredictiveDisplay';
import FAQDisplay from '../components/FAQDisplay';
import CaseLawDisplay from '../components/CaseLawDisplay';
import Button from '../components/ui/Button';
import { FaComments, FaFileAlt, FaQuestionCircle, FaHistory, FaMagic, FaArrowLeft, FaPaperPlane, FaMicrophone, FaPlay, FaPause, FaGavel, FaChevronLeft, FaTimes } from 'react-icons/fa';

import renderBold from "../utils/renderBold";
import { useToast } from "../components/ToastProvider";

// Removed: const synthesis = window.speechSynthesis; (using API-based TTS instead)

const DarkBackground = () => (
  <div className="absolute inset-0 -z-10 bg-[var(--panel)]">
    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-[rgba(2,6,23,0.02)] to-transparent" />
    <div
      className="absolute inset-0 opacity-[0.08]"
      style={{
        backgroundImage:
          "linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    />
  </div>
);

const TypingIndicator = () => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 8 }}
    className="flex justify-start"
    aria-live="polite"
  >
    <div className="max-w-[85%] px-4 py-3 rounded-2xl shadow-sm bg-[var(--card-bg)] text-[var(--text)] border border-[var(--border)]">
      <div className="flex items-center gap-3">
        <div className="flex items-end gap-1">
          <motion.span className="w-2 h-2 rounded-full bg-[var(--palette-3)]" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }} />
          <motion.span className="w-2 h-2 rounded-full bg-[var(--palette-3)]" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.9, delay: 0.15, repeat: Infinity, ease: 'easeInOut' }} />
          <motion.span className="w-2 h-2 rounded-full bg-[var(--palette-3)]" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.9, delay: 0.3, repeat: Infinity, ease: 'easeInOut' }} />
        </div>
        <div className="text-sm text-gray-400">Thinking...</div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="h-2 bg-[rgba(255,255,255,0.06)] rounded w-3/4 animate-pulse" />
        <div className="h-2 bg-[rgba(255,255,255,0.04)] rounded w-1/2 animate-pulse" />
      </div>
    </div>
  </motion.div>
);

const FeatureLoader = ({ feature }) => {
  const labelMap = {
    summary: 'Document Summary',
    questions: 'Suggested Questions',
    timeline: 'Timeline',
    predictive: 'Predictive Output',
    'case-law': 'Suggest Case Law',
  };
  const label = labelMap[feature] || 'Results';

  const descriptionMap = {
    summary: 'A concise, structured summary of the document: key facts, issues, judgment and insights.',
    questions: 'Suggested, high-quality questions you can ask the document or the assistant to explore key points and follow-ups.',
    timeline: 'An extracted chronology of events, dates and important excerpts from the document.',
    predictive: 'Predictions and likely outcomes based on the document context and similar precedents.',
    'case-law': 'Relevant case law, citations and short summaries that relate to this document.',
  };
  const description = descriptionMap[feature];

  return (
    <div className="h-full w-full flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex items-center justify-center">
          <motion.div
            className="absolute w-48 h-32 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(0,70,255,0.14), rgba(3,14,85,0.08))',
              filter: 'blur(18px)'
            }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />

          <div className="relative z-10 flex items-center gap-2">
            {[0,1,2].map((i) => (
              <motion.div
                key={i}
                className="w-28 h-20 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-lg flex items-center justify-center text-xs text-[var(--muted)]"
                initial={{ y: 8, rotate: i === 1 ? -4 : 4, opacity: 0.95 }}
                animate={{ y: [0, -8, 0], rotate: i === 1 ? [-4, 0, -4] : [4, 0, 4] }}
                transition={{ duration: 1.6 + i * 0.18, repeat: Infinity, ease: 'easeInOut', delay: i * 0.06 }}
              >
                <div className="px-2 text-center">
                  <div className="font-medium text-[var(--text)]">{label}</div>
                  <div className="text-[10px] text-[var(--muted)] mt-1">Preparing…</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {description && (
          <div className="mt-2 flex items-center justify-center">
            <div className="max-w-xs text-center text-xs text-[var(--muted)] px-2">{description}</div>
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          <div className="text-xs text-gray-400 font-semibold">Generating {label}…</div>
          <div className="w-40 h-1.5 rounded-full bg-[rgba(0,70,255,0.12)] overflow-hidden">
            <motion.div className="h-full bg-[var(--palette-3)]" initial={{ width: '12%' }} animate={{ width: ['12%','68%','34%','100%'] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

const SummaryLoader = () => <FeatureLoader feature="summary" />;
const QuestionsLoader = () => <FeatureLoader feature="questions" />;
const TimelineLoader = () => <FeatureLoader feature="timeline" />;
const PredictiveLoader = () => <FeatureLoader feature="predictive" />;
const CaseLawLoader = () => <FeatureLoader feature="case-law" />;

const NotebookPage = (props) => {
  const params = useParams();
  const { id: propId, inline } = props;
  const id = propId || params.id;
  const navigate = useNavigate();

  const [activeFeature, setActiveFeature] = useState('chat');
  const [notebook, setNotebook] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingFeature, setLoadingFeature] = useState(false);
  const [featureLoadKey, setFeatureLoadKey] = useState(0);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [followUpQuestions, setFollowUpQuestions] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const chatEndRef = useRef(null);
  
  // Zustand store for caching feature responses
  const getCachedFeature = useNotebookStore((state) => state.getCachedFeature);
  const setCachedFeature = useNotebookStore((state) => state.setCachedFeature);
  const [featureData, setFeatureData] = useState({
    chat: { title: "Chat", icon: <FaComments />, content: null, tooltip: "Interactive Q&A with your legal document" },
    summary: { title: "Summary", icon: <FaFileAlt />, content: null, tooltip: "Comprehensive summary and key insights" },
    questions: { title: "Questions", icon: <FaQuestionCircle />, content: null, tooltip: "AI-generated questions to explore your document" },
    timeline: { title: "Timeline", icon: <FaHistory />, content: null, tooltip: "Chronological events and important dates" },
    predictive: { title: "Predictive", icon: <FaMagic />, content: null, tooltip: "Predicted outcomes based on document analysis" },
    'case-law': { title: "Case Law", icon: <FaGavel />, content: null, tooltip: "Relevant case law and legal precedents" },
  });
  const [predictiveLang] = useState('en');
  const [timelineView, setTimelineView] = useState('date'); // 'date', 'event', 'mindmap'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // mobile feature panel
  const currentRequestRef = useRef({}); // Track current request IDs to prevent race conditions

  const languages = [
    { label: 'English', code: 'en' },
    { label: 'Hindi', code: 'hi' },
    { label: 'Spanish', code: 'es' },
    { label: 'French', code: 'fr' },
    { label: 'Malayalam', code: 'ml' },
    { label: 'Tamil', code: 'ta' },
    { label: 'Marathi', code: 'mr' },
    { label: 'Gujarati', code: 'gu' },
  ];
  const [selectedLang, setSelectedLang] = useState('en');
  const toast = useToast();

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);

  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const audioInputRef = useRef(null);
  const streamRef = useRef(null);
  const audioBufferRef = useRef([]);

  // Mobile-specific scroll handling
  const scrollToBottom = () => {
    try {
      chatEndRef.current?.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    } catch (e) {}
  };

  // Enhanced mobile scroll effect
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, isAiThinking]);

  // Close mobile menu when feature changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activeFeature]);

  // Rest of your existing effects and functions remain the same...
  useEffect(() => {
    if (!id) return;
    const fetchNotebookAndMessages = async () => {
      try {
        const [notebookRes, messagesRes] = await Promise.all([
          api.get(`/api/getchat/${id}`),
          api.get(`/api/messages/${id}`),
        ]);
        setNotebook(notebookRes.data.chat);
        setMessages(messagesRes.data.messages);
      } catch (err) {
        // Error handling
      }
    };

    fetchNotebookAndMessages();
  }, [id]);

  useEffect(() => {
    const MIC_DENIED_KEY = 'app:mic-denied:v1';
    const requestMicrophonePermission = async () => {
      try {
        const denied = (() => { try { return !!localStorage.getItem(MIC_DENIED_KEY); } catch (e) { return false; } })();
        if (denied) return;
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        try {
          try { localStorage.setItem(MIC_DENIED_KEY, '1'); } catch (e) { }
          toast.error("Microphone access is required for voice features to work.");
        } catch (e) { alert("Microphone access is required for voice features to work."); }
      }
    };

    requestMicrophonePermission();
  }, [toast]);

  const currentAudioRef = useRef(null);

  // Helper function to strip markdown and get plain text for TTS
  const stripMarkdown = (text) => {
    if (!text) return '';
    return text
      .replace(/#{1,6}\s+/g, '') // Remove headers
      .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.+?)\*/g, '$1') // Remove italic
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links, keep text
      .replace(/`(.+?)`/g, '$1') // Remove inline code
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/^>\s+/gm, '') // Remove blockquotes
      .replace(/^[-*+]\s+/gm, '') // Remove list markers
      .replace(/^\d+\.\s+/gm, '') // Remove numbered list markers
      .trim();
  };

  const handleToggleSpeech = async (msg) => {
    // If already speaking this message, stop it
    if (isSpeaking && speakingMessageId === msg._id) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      }
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      return;
    }

    // Stop any currently playing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
    }

    try {
      setSpeakingMessageId(msg._id);
      setIsSpeaking(true);

      // Strip markdown for TTS
      const plainText = stripMarkdown(msg.content);

      // Call the TTS API
      const response = await papi.post('/api/speak', 
        { text: plainText, language: selectedLang.slice(0, 2) },
        { 
          responseType: 'blob',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (!response.data) throw new Error("TTS failed");

      // Create audio from blob
      const audioBlob = response.data;
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      currentAudioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        setSpeakingMessageId(null);
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        setSpeakingMessageId(null);
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
      };

      audio.play();

    } catch (error) {
      console.error("Error playing audio:", error);
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      try {
        toast.error("Failed to play audio. Please try again.");
      } catch (e) {
        console.error("Toast error:", e);
      }
    }
  };

  const renderMessageContent = (content) => {
    if (content === null || content === undefined) return null;
    if (typeof content !== 'string') return String(content);

    // Remove <answer> tags from content
    const cleanedContent = content.replace(/<\/?answer>/gi, '');

    return (
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ inline, children }) => 
            inline ? (
              <code className="px-1.5 py-0.5 bg-black/20 rounded text-sm font-mono">{children}</code>
            ) : (
              <code className="block p-2 bg-black/20 rounded text-sm font-mono my-2 overflow-x-auto">{children}</code>
            ),
          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="ml-2">{children}</li>,
          h1: ({ children }) => <h1 className="text-xl font-bold mb-2 mt-3">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-2">{children}</h3>,
          blockquote: ({ children }) => <blockquote className="border-l-4 border-white/30 pl-3 italic my-2">{children}</blockquote>,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline">{children}</a>,
        }}
      >
        {cleanedContent}
      </ReactMarkdown>
    );
  };

  // Voice recording functions (same as before)
  const encodeWAV = (samples, sampleRate) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (view, offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    const floatTo16BitPCM = (output, offset, input) => {
      for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }
    };

    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, "WAVE");
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, "data");
    view.setUint32(40, samples.length * 2, true);
    floatTo16BitPCM(view, 44, samples);

    return new Blob([view], { type: "audio/wav" });
  };

  const startVoiceRecording = async () => {
    const MIC_DENIED_KEY = 'app:mic-denied:v1';
    try {
      const denied = (() => { try { return !!localStorage.getItem(MIC_DENIED_KEY); } catch (e) { return false; } })();
      if (denied) {
        try { toast.error('Microphone access was previously denied. Enable it in your browser settings if you want voice features.'); } catch (e) { alert('Microphone access was previously denied. Enable it in your browser settings if you want voice features.'); }
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Your browser does not support voice recording.");
      }

      audioBufferRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const context = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = context;

      const source = context.createMediaStreamSource(stream);
      audioInputRef.current = source;

      const processor = context.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const bufferCopy = new Float32Array(inputData);
        audioBufferRef.current.push(bufferCopy);
      };

      source.connect(processor);
      processor.connect(context.destination);
      setIsRecording(true);
    } catch (err) {
      try {
        if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError' || /denied/i.test(String(err.message || '')))) {
          try { localStorage.setItem(MIC_DENIED_KEY, '1'); } catch (e) {}
        }
      } catch (e) {}
      try { toast.error(err.message || "Voice recording is not supported on this device."); } catch(e){ alert(err.message || "Voice recording is not supported on this device."); }
    }
  };

  const stopVoiceRecording = () => {
    if (!isRecording) return;
    setIsRecording(false);

    const sampleRate = audioContextRef.current?.sampleRate;
    audioInputRef.current?.disconnect();
    processorRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    audioContextRef.current?.close();

    if (audioBufferRef.current.length === 0) {
      try { toast.warn("No audio was recorded."); } catch(e){ alert("No audio was recorded."); }
      return;
    }

    const totalLength = audioBufferRef.current.reduce((acc, val) => acc + val.length, 0);
    const completeBuffer = new Float32Array(totalLength);
    let offset = 0;
    for (const buffer of audioBufferRef.current) {
      completeBuffer.set(buffer, offset);
      offset += buffer.length;
    }

    const audioBlob = encodeWAV(completeBuffer, sampleRate);
    sendAudioToApi(audioBlob);
  };

  const sendAudioToApi = async (audioBlob) => {
    if (!audioBlob || audioBlob.size <= 44) return;
    setIsProcessingAudio(true);
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.wav");
      const res = await papi.post("/api/ingest-audio", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const transcript = res.data.transcript;
      if (transcript && !transcript.startsWith("(speech error")) {
        setNewMessage(transcript.trim());
      } else {
        try { toast.error(`Transcription failed: ${transcript}`); } catch(e){ alert(`Transcription failed: ${transcript}`); }
      }
    } catch (err) {
      try { toast.error("Transcription failed. Please try again."); } catch(e){ alert("Transcription failed. Please try again."); }
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const fetchFeatureData = async (featureKey, langOverride, timelineViewOverride) => {
    if (!notebook) return;
    setFeatureLoadKey(k => k + 1);
    setLoadingFeature(true);

    try {
      const langToUse = featureKey === 'predictive' ? (langOverride || predictiveLang) : undefined;
      const currentTimelineView = timelineViewOverride || timelineView;
      let cacheKey = featureKey;
      if (featureKey === 'predictive') {
        cacheKey = `${featureKey}:${langToUse}`;
      } else if (featureKey === 'timeline') {
        cacheKey = `${featureKey}:${currentTimelineView}`;
      }
      
      // Generate unique request ID to prevent race conditions
      const requestId = Date.now() + Math.random();
      currentRequestRef.current[featureKey] = requestId;
      
      // Check Zustand cache first
      const cachedContent = getCachedFeature(id, cacheKey);
      if (cachedContent) {
        // Still check if this request is current before updating
        if (currentRequestRef.current[featureKey] === requestId) {
          setFeatureData((prev) => ({
            ...prev,
            [featureKey]: { ...prev[featureKey], content: cachedContent },
          }));
        }
        setLoadingFeature(false);
        return;
      }

      const payload = { user_id: notebook?.user, thread_id: id };
      let content;

      // ... (rest of your fetchFeatureData function remains exactly the same)
      if (featureKey === "summary") {
        // Call both APIs in parallel
        const [studyGuideRes, insightsRes] = await Promise.allSettled([
          papi.post(`/api/study-guide`, payload),
          papi.post(`/api/explain-clauses`, { ...payload, output_language: (langToUse || selectedLang || 'en').slice(0,2) })
        ]);
        
        const studyGuide = studyGuideRes.status === 'fulfilled' ? studyGuideRes.value.data.study_guide : null;
        const insightsData = insightsRes.status === 'fulfilled' ? insightsRes.value.data : null;
        
        // Merge insights explanations into studyGuide if available
        if (studyGuide && typeof studyGuide === 'object' && insightsData && Array.isArray(insightsData.explanations)) {
          studyGuide.explanations = insightsData.explanations;
        }

        if (!studyGuide) {
          content = <div className="text-sm text-gray-400">No study guide available.</div>;
        } else if (typeof studyGuide === 'object' && studyGuide.document_type) {
          // New structured format
          content = (
            <div className="study-guide space-y-6 p-4">
              {studyGuide.document_type && (
                <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                  {studyGuide.document_type}
                </span>
              )}
              
              <h1 className="text-2xl md:text-3xl font-bold text-[var(--palette-2)]">
                {studyGuide.title || notebook?.title || 'Study Guide'}
              </h1>
              
              {studyGuide.overview && (
                <p className="text-base text-gray-700 leading-relaxed">
                  {studyGuide.overview}
                </p>
              )}

              {Array.isArray(studyGuide.structured_data) && studyGuide.structured_data.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {studyGuide.structured_data.map((item, idx) => (
                    <div key={idx} className="card bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-4 hover:shadow-md transition-shadow">
                      <strong className="text-sm font-semibold text-[var(--palette-2)] block mb-2">
                        {item.label}
                      </strong>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {Array.isArray(studyGuide.critical_points) && studyGuide.critical_points.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-[var(--palette-2)] mb-3">
                    Key Highlights
                  </h3>
                  <ul className="space-y-2 ml-4 list-disc">
                    {studyGuide.critical_points.map((point, idx) => (
                      <li key={idx} className="text-sm text-gray-700 leading-relaxed">
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Legal Clauses Section */}
              {Array.isArray(studyGuide.explanations) && studyGuide.explanations.length > 0 && (
                <div className="mt-8 pt-6 border-t border-[var(--border)]">
                  <div className="mb-6">
                    <h2 className="text-xl md:text-2xl font-bold text-[var(--palette-2)] mb-2">Legal Clauses Explained</h2>
                    <p className="text-sm text-gray-600">Understanding key legal concepts and their implications</p>
                  </div>
                  <div className="space-y-4">
                    {studyGuide.explanations.map((item, idx) => (
                      <div key={idx} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-4 md:p-5 hover:shadow-lg transition-all duration-200">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--palette-1)] text-white flex items-center justify-center font-semibold text-sm">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base md:text-lg font-semibold text-[var(--palette-2)] mb-2 leading-tight">
                              {item.clause}
                            </h3>
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                              {item.explanation}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        } else if (typeof studyGuide === 'string') {
          const formattedContent = studyGuide.split("\n").map((line, index) => {
            if (line.startsWith("# ")) return <h1 key={index} className="text-xl md:text-2xl font-bold mt-4 md:mt-6" style={{ color: 'var(--palette-3)' }}>{line.substring(2)}</h1>;
            if (line.startsWith("##")) return <h2 key={index} className="text-base md:text-lg font-semibold text-[var(--palette-3)] mt-3 md:mt-4">{line.substring(3)}</h2>;
            if (line.startsWith("*")) return <li key={index} className="text-sm text-gray-800 ml-4 md:ml-6 list-disc">{renderBold(line.substring(2))}</li>;
            if (line.trim() === "---") return <hr key={index} className="my-3 md:my-4 border-gray-300" />;
            if (line.trim()) return <p key={index} className="text-sm text-gray-700 leading-relaxed">{renderBold(line)}</p>;
            return null;
          });
          content = <div className="space-y-2 p-2 md:p-0">{formattedContent}</div>;
        } else if (typeof studyGuide === 'object') {
          // Legacy format fallback
          const caseTitle = studyGuide.case_title || notebook?.title || 'Study Guide';
          const summaryObj = studyGuide.summary || {};
          const insights = studyGuide.insights || {};

          const renderArray = (arr) => Array.isArray(arr) ? arr.map((it, i) => <li key={i} className="ml-3 md:ml-4 list-disc text-sm">{it}</li>) : null;

          content = (
            <div className="space-y-4 text-sm text-gray-800 p-2 md:p-0">
              <h2 className="text-xl md:text-2xl font-bold" style={{ color: 'var(--palette-3)' }}>{caseTitle}</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                <section className="space-y-3">
                  <h3 className="text-base md:text-lg font-semibold">Summary</h3>
                  {summaryObj.facts && <div>
                    <h4 className="font-medium text-sm md:text-base">Facts</h4>
                    <p className="text-xs md:text-sm text-gray-700 whitespace-pre-wrap">{renderBold(summaryObj.facts)}</p>
                  </div>}

                  {summaryObj.issues && <div>
                    <h4 className="font-medium text-sm md:text-base">Issues</h4>
                    <p className="text-xs md:text-sm text-gray-700 whitespace-pre-wrap">{renderBold(summaryObj.issues)}</p>
                  </div>}

                  {summaryObj.arguments && <div>
                    <h4 className="font-medium text-sm md:text-base">Arguments</h4>
                    <div className="text-xs md:text-sm text-gray-700 whitespace-pre-wrap">{renderBold(summaryObj.arguments)}</div>
                  </div>}

                  {summaryObj.judgment && <div>
                    <h4 className="font-medium text-sm md:text-base">Judgment</h4>
                    <p className="text-xs md:text-sm text-gray-700">{renderBold(summaryObj.judgment)}</p>
                  </div>}
                </section>

                <aside className="space-y-3">
                  <h3 className="text-base md:text-lg font-semibold">Insights</h3>
                  {insights.verdict && <div>
                    <h4 className="font-medium text-sm md:text-base">Verdict</h4>
                    <p className="text-xs md:text-sm text-gray-700">{insights.verdict}</p>
                  </div>}

                  {Array.isArray(insights.key_laws) && insights.key_laws.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm md:text-base">Key Laws</h4>
                      <ul className="text-xs md:text-sm text-gray-700 ml-3 md:ml-4 list-disc">
                        {insights.key_laws.map((law, idx) => <li key={idx}>{law}</li>)}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(insights.key_precedents) && insights.key_precedents.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm md:text-base">Key Precedents</h4>
                      <ul className="text-xs md:text-sm text-gray-700 ml-3 md:ml-4 list-disc">{renderArray(insights.key_precedents)}</ul>
                    </div>
                  )}

                  {insights.legal_provisions_summary && (
                    <div>
                      <h4 className="font-medium text-sm md:text-base">Legal Provisions</h4>
                      <div className="text-xs md:text-sm text-gray-700 whitespace-pre-wrap">{insights.legal_provisions_summary}</div>
                    </div>
                  )}
                </aside>
              </div>
            </div>
          );
        }
      } else if (featureKey === "questions") {
        const res = await papi.post(`/api/faq`, { ...payload, num_questions: 5 });
        const faqMarkdown = res.data.faq_markdown;
        content = <FAQDisplay faq={faqMarkdown} />;
      } else if (featureKey === "timeline") {
        // Determine which API to call based on timelineView
        const currentView = timelineViewOverride || timelineView;
        let apiEndpoint = '/api/timeline';
        let apiPayload = { ...payload, max_snippets: 10 };
        
        if (currentView === 'event') {
          apiEndpoint = '/api/event-timeline';
        } else if (currentView === 'mindmap') {
          apiEndpoint = '/api/flowchart';
        }
        
        const res = await papi.post(apiEndpoint, apiPayload);
        
        if (currentView === 'mindmap') {
          // Handle mindmap/flowchart response
          const mindmapCode = res.data?.mindmap_code || res.data?.flowchart || res.data?.mindmap;
          
          if (mindmapCode && typeof mindmapCode === 'string') {
            content = (
              <div className="space-y-4 p-4">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-[var(--palette-2)] mb-2">Mind Map View</h3>
                  <p className="text-sm text-gray-600">Visual representation of document structure and key concepts</p>
                </div>
                <MermaidMindMap chartCode={mindmapCode} />
              </div>
            );
          } else if (res.data && typeof res.data === 'object') {
            // Fallback: try to extract mindmap_code from nested object
            const code = res.data.mindmap_code || JSON.stringify(res.data, null, 2);
            content = (
              <div className="space-y-4 p-4">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-[var(--palette-2)] mb-2">Mind Map View</h3>
                  <p className="text-sm text-gray-600">Visual representation of document structure and key concepts</p>
                </div>
                {typeof code === 'string' && code.includes('mindmap') ? (
                  <MermaidMindMap chartCode={code} />
                ) : (
                  <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-6">
                    <pre className="text-sm whitespace-pre-wrap font-mono text-gray-700">{code}</pre>
                  </div>
                )}
              </div>
            );
          } else {
            content = <div className="text-sm text-gray-400 italic">No mindmap data available.</div>;
          }
        } else {
          // Handle date-based and event-based timeline responses
          const timelineArray = res.data?.timeline || res.data?.events;
          const timelineMarkdown = res.data?.timeline_markdown || res.data?.markdown || "";
          
          if (Array.isArray(timelineArray) && timelineArray.length === 0 && res.data?.message) {
            content = <div className="text-sm text-gray-400 italic">{res.data.message}</div>;
          } else if (timelineMarkdown && timelineMarkdown.trim()) {
            content = <Timeline timelineMarkdown={timelineMarkdown} />;
          } else if (Array.isArray(timelineArray) && timelineArray.length > 0) {
            const md = ['Date | Event', '---|---', ...timelineArray.map(item => `${item.date || item.time || ''} | ${item.event || item.description || item.title || ''}`)].join('\n');
            content = <Timeline timelineMarkdown={md} />;
          } else {
            content = <div className="text-sm text-gray-400 italic">{res.data?.message || 'No timeline events found.'}</div>;
          }
        }
      } else if (featureKey === 'case-law') {
        try {
          const res = await papi.post(`/api/suggest-case-law`, { ...payload, output_language: (langToUse || predictiveLang).slice(0,2) });
          const suggestion = res.data;

          const normalizeCase = (it) => {
            if (!it) return null;
            if (typeof it === 'string') {
              return { summary: it };
            }
            if (typeof it === 'object') {
              return {
                case_name: it.case_name || it.title || it.name || it.headline || null,
                citation: it.citation || it.cite || it.ref || null,
                summary: it.summary || it.snippet || it.excerpt || it.description || it.content || null,
                score: it.score || it.relevance || it.rank || null,
                link: it.link || it.url || it.href || it.reference || null,
                raw: it,
              };
            }
            return { summary: String(it) };
          };

          let casesData = [];
          let parsed = suggestion;
          if (typeof suggestion === 'string') {
            try {
              parsed = JSON.parse(suggestion);
            } catch (e) {}
          }

          if (Array.isArray(parsed)) {
            casesData = parsed.map(normalizeCase).filter(Boolean);
          } else if (parsed && typeof parsed === 'object') {
            const arr = parsed.cases || parsed.results || parsed.items || parsed.matches || parsed.suggested_cases || parsed.suggestedCases;
            if (Array.isArray(arr) && arr.length > 0) {
              casesData = arr.map(normalizeCase).filter(Boolean);
            } else {
              const entries = Object.entries(parsed).filter(([k, v]) => typeof v === 'object' || typeof v === 'string');
              if (entries.length > 0) {
                casesData = entries.map(([k, v]) => {
                  if (typeof v === 'string') return { case_name: k, summary: v };
                  return normalizeCase({ case_name: k, ...v });
                }).filter(Boolean);
              }
            }
          }

          if (casesData.length === 0 && typeof suggestion === 'string') {
            const cleaned = suggestion.split('\n').filter(l => l && !/success|status|error|message/i.test(l)).join('\n');
            const chunks = cleaned.split('\n\n').map(s => s.trim()).filter(Boolean);
            if (chunks.length > 1) {
              casesData = chunks.map((c) => ({ summary: c }));
            } else if (cleaned.trim()) {
              casesData = [{ summary: cleaned.trim() }];
            }
          }

          if (!casesData || casesData.length === 0) {
            content = <div className="text-sm text-gray-400">No relevant cases found.</div>;
          } else {
            content = <CaseLawDisplay cases={casesData} />;
          }
        } catch (err) {
          const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to fetch case law suggestions';
          content = <div className="text-sm text-red-400">{errorMsg}</div>;
        }
      } else if (featureKey === "predictive") {
        try {
          const res = await papi.post(`/api/predictive-output`, { ...payload, output_language: (langToUse || predictiveLang).slice(0,2) });
          const pred = res.data.prediction;
          content = <PredictiveDisplay prediction={pred} />;
        } catch (err) {
          const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to fetch predictive output';
          content = <div className="text-sm text-red-400">{errorMsg}</div>;
        }
      } else if (featureKey === "insights") {
        try {
          const res = await papi.post(`/api/explain-clauses`, { ...payload, output_language: (langToUse || selectedLang || 'en').slice(0,2) });
          const data = res.data;
          
          // Handle the new format with explanations array
          if (data && Array.isArray(data.explanations)) {
            content = (
              <div className="space-y-4 p-2 md:p-4">
                <div className="mb-6">
                  <h2 className="text-xl md:text-2xl font-bold text-[var(--palette-2)] mb-2">Legal Clauses Explained</h2>
                  <p className="text-sm text-gray-600">Understanding key legal concepts and their implications</p>
                </div>
                {data.explanations.map((item, idx) => (
                  <div key={idx} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-4 md:p-5 hover:shadow-lg transition-all duration-200">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--palette-1)] text-white flex items-center justify-center font-semibold text-sm">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base md:text-lg font-semibold text-[var(--palette-2)] mb-2 leading-tight">
                          {item.clause}
                        </h3>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {item.explanation}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          } else {
            // Fallback for other formats
            const insights = data.insights || data.clauses || data;
            
            if (!insights) {
              content = <div className="text-sm text-gray-400">No insights available.</div>;
            } else if (typeof insights === 'string') {
              const formattedContent = insights.split("\n").map((line, index) => {
                if (line.startsWith("# ")) return <h1 key={index} className="text-xl md:text-2xl font-bold mt-4 md:mt-6 text-[var(--palette-3)]">{line.substring(2)}</h1>;
                if (line.startsWith("##")) return <h2 key={index} className="text-base md:text-lg font-semibold text-[var(--palette-3)] mt-3 md:mt-4">{line.substring(3)}</h2>;
                if (line.startsWith("###")) return <h3 key={index} className="text-sm md:text-base font-semibold text-[var(--palette-2)] mt-2 md:mt-3">{line.substring(4)}</h3>;
                if (line.startsWith("*")) return <li key={index} className="text-sm text-gray-800 ml-4 md:ml-6 list-disc">{renderBold(line.substring(2))}</li>;
                if (line.trim() === "---") return <hr key={index} className="my-3 md:my-4 border-gray-300" />;
                if (line.trim()) return <p key={index} className="text-sm text-gray-700 leading-relaxed">{renderBold(line)}</p>;
                return null;
              });
              content = <div className="space-y-2 p-2 md:p-4">{formattedContent}</div>;
            } else if (Array.isArray(insights)) {
              content = (
                <div className="space-y-4 p-2 md:p-4">
                  {insights.map((clause, idx) => (
                    <div key={idx} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-4 hover:shadow-md transition-shadow">
                      {clause.title && <h3 className="text-base md:text-lg font-semibold text-[var(--palette-2)] mb-2">{clause.title}</h3>}
                      {clause.clause && <p className="text-sm text-gray-600 mb-2 italic">{clause.clause}</p>}
                      {clause.explanation && <p className="text-sm text-gray-700 whitespace-pre-wrap">{clause.explanation}</p>}
                      {clause.content && <p className="text-sm text-gray-700 whitespace-pre-wrap">{clause.content}</p>}
                    </div>
                  ))}
                </div>
              );
            } else if (typeof insights === 'object') {
              content = (
                <div className="space-y-4 p-2 md:p-4">
                  {Object.entries(insights).map(([key, value], idx) => (
                    <div key={idx} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-4 hover:shadow-md transition-shadow">
                      <h3 className="text-base md:text-lg font-semibold text-[var(--palette-2)] mb-2">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</p>
                    </div>
                  ))}
                </div>
              );
            }
          }
        } catch (err) {
          const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to fetch insights';
          content = <div className="text-sm text-red-400">{errorMsg}</div>;
        }
      }

      // Always cache the response (even if user switched features)
      setCachedFeature(id, cacheKey, content);
      
      // Only update UI if this request is still the current one (prevent race conditions)
      if (currentRequestRef.current[featureKey] === requestId) {
        setFeatureData((prev) => ({ ...prev, [featureKey]: { ...prev[featureKey], content } }));
      }
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to load feature';
      try {
        toast.error(errorMsg);
      } catch (e) {
        console.error('Feature fetch error:', errorMsg);
      }
    } finally {
      setLoadingFeature(false);
    }
  };

  const handleFeatureClick = (featureKey) => {
    if (activeFeature === featureKey) {
      setActiveFeature(null);
      return;
    }

    if (featureKey === 'chat') {
      setActiveFeature('chat');
      return;
    }

    setActiveFeature(featureKey);
    fetchFeatureData(featureKey);
  };

  const handleSendMessage = async (e, question = null) => {
    e?.preventDefault();
    const rawMessage = question || newMessage.trim();
    if (!rawMessage || isAiThinking) return;

    // Sanitize message input to prevent XSS
    const messageToSend = sanitizeTextInput(rawMessage);
    if (!messageToSend) {
      try {
        toast.error("Invalid message content. Please use only valid characters.");
      } catch (err) {
        console.error('Invalid message');
      }
      return;
    }

    // Rate limiting (max 10 messages per minute)
    const rateCheck = checkRateLimit(`notebook_chat_${id}`, 10, 60000);
    if (!rateCheck.allowed) {
      try {
        toast.error(`Too many messages. Please wait before sending again.`);
      } catch (err) {
        console.error('Rate limit exceeded');
      }
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const userMessage = { _id: tempId, role: 'user', content: messageToSend, _temp: true };
    
    // Build conversation history for API (convert messages to history format)
    // Only include previous messages, not the current one (query already contains current message)
    const conversationHistory = messages.map(msg => ({
      role: msg.role === 'response' ? 'assistant' : msg.role,
      content: msg.content
    }));
    
    setMessages((prev) => [...prev, userMessage]);
    setNewMessage("");
    setFollowUpQuestions([]);
    setIsAiThinking(true);
    
    setTimeout(scrollToBottom, 100);

    try {
      const saveUserPromise = api.post('/api/messages', { chatId: id, content: messageToSend, role: 'user' });
      const askPromise = papi.post('/api/ask', { 
        user_id: notebook.user, 
        thread_id: id, 
        query: messageToSend, 
        history: conversationHistory, // Pass full conversation history (previous messages only)
        top_k: 4, 
        output_language: (selectedLang || 'en').slice(0,2) 
      });
      const [saveRes, askRes] = await Promise.allSettled([saveUserPromise, askPromise]);

      if (saveRes.status === 'fulfilled' && saveRes.value?.data?.message) {
        const savedUserMsg = saveRes.value.data.message;
        setMessages((prev) => prev.map((m) => (m._id === tempId ? savedUserMsg : m)));
        setTimeout(scrollToBottom, 100);
      }

      if (askRes.status !== 'fulfilled') {
        throw new Error('Ask API failed');
      }
      const res2 = askRes.value;
      let apiAnswer = res2.data?.answer;
      let aiContent = "";
      let followups = [];

      if (apiAnswer == null) {
        throw new Error("API returned empty answer");
      }

      if (typeof apiAnswer === "string") {
        const trimmed = apiAnswer.replace(/^```json\n?/, "").replace(/```$/, "");
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed?.response) {
            const apiResponse = parsed.response;
            aiContent = apiResponse["PLAIN ANSWER"] || apiResponse.answer || JSON.stringify(apiResponse);
            followups = apiResponse.followupquestion || [];
          } else if (parsed?.answer) {
            aiContent = parsed.answer;
          } else {
            aiContent = trimmed;
          }
        } catch (parseError) {
          aiContent = trimmed;
        }
      } else if (typeof apiAnswer === "object") {
        if (apiAnswer?.response) {
          const apiResponse = apiAnswer.response;
          aiContent = apiResponse["PLAIN ANSWER"] || apiResponse.answer || JSON.stringify(apiResponse);
          followups = apiResponse.followupquestion || [];
        } else if (apiAnswer?.answer) {
          aiContent = apiAnswer.answer;
        } else {
          aiContent = JSON.stringify(apiAnswer);
        }
      } else {
        aiContent = String(apiAnswer);
      }

      const res3 = await api.post('/api/messages', { chatId: id, content: aiContent, role: 'response' });
      setMessages((prev) => [...prev, res3.data.message]);
      setTimeout(scrollToBottom, 100);
      setFollowUpQuestions(followups || []);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Sorry, I encountered an error. Please try again.';
      const errorMessage = {
        _id: `error-${Date.now()}`,
        role: 'response',
        content: errorMsg
      };
      setMessages(prev => [...prev, errorMessage]);
      try {
        toast.error(errorMsg);
      } catch (e) {
        console.error('Chat error:', errorMsg);
      }
    } finally {
      setIsAiThinking(false);
    }
  };

  if (!id) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center bg-[var(--bg)] text-red-600 p-4">
        No notebook selected.
      </div>
    );
  }

  if (!notebook) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center bg-[var(--bg)] text-[var(--muted)] p-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-4 border-t-4 border-[var(--border)] border-t-[var(--accent)] rounded-full"
        />
        <span className="ml-3 text-[var(--accent)] text-sm">Loading notebook...</span>
      </div>
    );
  }

  return (
    <div
      className={`relative flex font-sans overflow-hidden flex-1 bg-[var(--bg)] max-w-full ${inline ? "panel rounded-none" : "h-[100vh]"}`}
      style={inline ? { height: "70vh", minHeight: 400 } : {}}
    >
      <DarkBackground />

      {/* Mobile Feature Panel Overlay (right side now) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: 280 }}
              animate={{ x: 0 }}
              exit={{ x: 280 }}
              className="fixed right-0 top-0 h-full w-64 bg-[var(--panel)] border-l border-[var(--border)] z-50 lg:hidden shadow-xl"
            >
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--text)]">Features</h2>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-[var(--text)] hover:bg-[var(--border)] rounded-lg"
                >
                  <FaTimes className="text-lg" />
                </button>
              </div>
              <nav className="p-4 space-y-2">
                {Object.entries(featureData).map(([key, { icon, title, tooltip }]) => (
                  <button
                    key={key}
                    onClick={() => handleFeatureClick(key)}
                    title={tooltip}
                    className={`flex items-center gap-3 w-full text-left p-3 rounded-lg transition-all duration-200 ${
                      activeFeature === key 
                        ? 'bg-[var(--palette-1)] text-white shadow-sm' 
                        : 'text-[var(--text)] hover:bg-[var(--border)]'
                    }`}
                  >
                    <span className="text-lg">{icon}</span>
                    <span className="font-medium">{title}</span>
                  </button>
                ))}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area - Three-part flex layout */}
  <div className="relative z-10 flex-1 panel rounded-none bg-[var(--bg)] flex flex-col w-full h-full overflow-hidden">
        {/* Fixed Header - Always visible */}
        <header className="mt-10 md:mt-0 flex-none p-3 md:p-6 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg)] z-30">
          {/* Left cluster: Back */}
          <div className="flex items-center gap-2">
            {!inline && id && (
              <Button
                variant="secondary"
                onClick={() => navigate('/legal-desk')}
                aria-label="Back to Legal Desk"
                className="p-2 md:px-3 md:py-2"
              >
                <FaArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline ml-1 md:ml-2 text-sm">Back</span>
              </Button>
            )}
          </div>
          {/* Center title */}
          <div className="flex-1 px-2 md:px-4">
            <h1 className="text-sm md:text-base font-semibold text-[var(--text)] text-center truncate">
              {notebook?.title || 'Notebook'}
            </h1>
          </div>
          {/* Mobile feature panel toggle */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex lg:hidden items-center gap-1 pl-2 pr-3 py-2 text-[var(--text)] hover:bg-[var(--border)] rounded-lg flex-shrink-0"
            aria-label="Open features panel"
          >
            <FaChevronLeft className="text-lg" />
            <span className="text-xs font-medium">Features</span>
          </button>

          {/* Desktop: Horizontal feature navbar - single line */}
          <div className="hidden lg:flex flex-1">
            <nav className="flex items-center gap-1 xl:gap-2" role="tablist" aria-label="Notebook features">
              {Object.entries(featureData).map(([key, { icon, title, tooltip }]) => (
                <button
                  key={key}
                  onClick={() => handleFeatureClick(key)}
                  role="tab"
                  aria-selected={activeFeature === key}
                  tabIndex={0}
                  className={`flex items-center gap-1.5 whitespace-nowrap py-2 px-2 xl:px-3 text-sm font-medium transition-all duration-150 relative group ${
                    activeFeature === key ? 'border-b-2 font-semibold' : 'opacity-95 hover:opacity-100'
                  }`}
                  style={{
                    color: activeFeature === key ? 'var(--palette-1, #003bbf)' : '#71719F',
                    borderColor: activeFeature === key ? 'var(--palette-3-dark, #003bbf)' : undefined,
                  }}
                >
                  <span className="text-lg">{icon}</span>
                  <span>{title}</span>
                  {/* Tooltip below button */}
                  <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-normal w-48 text-center shadow-lg z-50 pointer-events-none">
                    {tooltip}
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1 border-4 border-transparent border-b-gray-900"></span>
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </header>

        {/* Scrollable Content Area - flex-1 min-h-0 overflow-y-auto */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 bg-[var(--palette-4)]">
          {activeFeature ? (
            activeFeature === 'chat' ? (
              <div className="space-y-3">

                  {messages.map((msg) => (
                    <motion.div 
                      key={msg._id} 
                      initial={{ opacity: 0, y: 8 }} 
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`relative max-w-[90%] md:max-w-[72%] px-4 py-3 shadow-sm transition-colors duration-150 ${
                          msg.role === 'user'
                            ? 'bg-[var(--palette-1)] text-white rounded-tl-2xl rounded-bl-2xl rounded-tr-none rounded-br-2xl hover:brightness-95'
                            : 'bg-[var(--card-bg)] text-[var(--text)] rounded-tr-2xl rounded-br-2xl rounded-tl-none rounded-bl-2xl border border-[var(--border)] hover:border-[var(--palette-3)]'
                        }`}
                        style={{
                          fontSize: '0.9rem',
                          lineHeight: '1.4',
                        }}
                      >
                        <div className="whitespace-pre-wrap break-words">
                          {renderMessageContent(msg.content)}
                        </div>
                        <div className="mt-2 flex items-center justify-end gap-1">
                          {msg.role !== 'user' && msg.content && (
                            <button 
                              onClick={() => handleToggleSpeech(msg)} 
                              aria-label={isSpeaking && speakingMessageId === msg._id ? 'Stop speech' : 'Play speech'} 
                              className="p-1 text-[var(--muted)] hover:text-[var(--text)] transition-colors bg-[var(--bg)] rounded-full border border-[var(--border)] hover:border-[var(--palette-3)] text-xs"
                            >
                              {isSpeaking && speakingMessageId === msg._id ? <FaPause /> : <FaPlay />}
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  <AnimatePresence>
                    {isAiThinking && <TypingIndicator key="typing" />}
                  </AnimatePresence>

                  {followUpQuestions.length > 0 && (  
                    <div className="mt-4 space-y-2">
                      <h3 className="text-gray-400 text-xs font-semibold">Follow-up Questions:</h3>
                      {followUpQuestions.map((question, index) => (
                        <motion.button 
                          key={index} 
                          whileHover={{ scale: 1.02 }} 
                          whileTap={{ scale: 0.98 }} 
                          onClick={(e) => handleSendMessage(e, question)} 
                          className="w-full text-left px-3 py-2 bg-[var(--palette-2)] text-white rounded-md shadow-sm hover:opacity-95 transition-all duration-200 text-sm"
                        >
                          {question}
                        </motion.button>
                      ))}
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>
            ) : (
              // Feature Content with Mobile Optimization
              <div className="h-full flex flex-col">
                {/* Timeline View Selector - Only show when timeline is active */}
                {activeFeature === 'timeline' && (
                  <div className="flex-none mb-4 flex items-center gap-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-2">
                    <span className="text-sm font-medium text-[var(--text)] mr-2">View:</span>
                    <button
                      onClick={() => {
                        if (timelineView !== 'date') {
                          setTimelineView('date');
                          // Pass view directly to fetchFeatureData to avoid async state issues
                          fetchFeatureData('timeline', undefined, 'date');
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        timelineView === 'date'
                          ? 'bg-[var(--palette-1)] text-white shadow-sm'
                          : 'bg-[var(--bg)] text-[var(--text)] hover:bg-[var(--border)]'
                      }`}
                    >
                      Date-Based
                    </button>
                    <button
                      onClick={() => {
                        if (timelineView !== 'event') {
                          setTimelineView('event');
                          // Pass view directly to fetchFeatureData to avoid async state issues
                          fetchFeatureData('timeline', undefined, 'event');
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        timelineView === 'event'
                          ? 'bg-[var(--palette-1)] text-white shadow-sm'
                          : 'bg-[var(--bg)] text-[var(--text)] hover:bg-[var(--border)]'
                      }`}
                    >
                      Event-Based
                    </button>
                    <button
                      onClick={() => {
                        if (timelineView !== 'mindmap') {
                          setTimelineView('mindmap');
                          // Pass view directly to fetchFeatureData to avoid async state issues
                          fetchFeatureData('timeline', undefined, 'mindmap');
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        timelineView === 'mindmap'
                          ? 'bg-[var(--palette-1)] text-white shadow-sm'
                          : 'bg-[var(--bg)] text-[var(--text)] hover:bg-[var(--border)]'
                      }`}
                    >
                      Mind Map
                    </button>
                  </div>
                )}

                <AnimatePresence mode="wait">
                  {loadingFeature ? (
                    <motion.div 
                      key={`feature-loader-${activeFeature}-${featureLoadKey}`} 
                      initial={{ opacity: 0, y: 8 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      exit={{ opacity: 0, y: 8 }} 
                      className="w-full h-full"
                    >
                      {activeFeature === 'summary' && <SummaryLoader />}
                      {activeFeature === 'questions' && <QuestionsLoader />}
                      {activeFeature === 'timeline' && <TimelineLoader />}
                      {activeFeature === 'predictive' && <PredictiveLoader />}
                      {activeFeature === 'case-law' && <CaseLawLoader />}
                      {['summary','questions','timeline','predictive','case-law'].indexOf(activeFeature) === -1 && <FeatureLoader feature={activeFeature} />}
                    </motion.div>
                  ) : (
                    <motion.div 
                      key={`feature-content-${activeFeature}-${featureLoadKey}`} 
                      initial={{ opacity: 0, y: 12 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      exit={{ opacity: 0, y: 8 }} 
                      className={`space-y-4 text-sm text-gray-300 overflow-y-auto flex-1 min-h-0 p-2 md:p-0 ${
                        activeFeature === 'timeline' && timelineView === 'mindmap' ? 'overflow-x-hidden' : ''
                      }`}
                    >
                      {featureData[activeFeature]?.content}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          ) : (
            // Empty State
            <div className="text-center text-gray-400 mt-8 md:mt-16 p-4">
              <h3 className="text-base md:text-lg font-semibold">Select a feature to view output</h3>
              <p className="text-xs md:text-sm mt-2 max-w-md mx-auto">
                Choose a feature from the menu to display results here (chat, summary, timeline, etc.).
              </p>
            </div>
          )}
        </div>

        {/* Fixed Input Bar - Only shown for chat feature */}
        {activeFeature === 'chat' && (
          <div className="flex-none border-t border-[var(--border)] bg-[var(--bg)] px-2 py-3 md:px-3 md:py-4 backdrop-blur-sm">
            <form onSubmit={handleSendMessage} className="flex items-end gap-2 w-full">
              {/* Voice Button */}
              <motion.button 
                type="button" 
                onClick={isRecording ? stopVoiceRecording : startVoiceRecording} 
                disabled={isProcessingAudio}
                className={`flex-shrink-0 p-2 md:p-2 rounded-md ${
                  isRecording 
                    ? 'bg-red-500 text-white' 
                    : isProcessingAudio 
                      ? 'bg-gray-400 text-white' 
                      : 'bg-[var(--panel)] text-[var(--text)] border border-[var(--border)]'
                }`}
                whileTap={{ scale: 0.95 }}
              >
                {isProcessingAudio ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isRecording ? (
                  <div className="w-4 h-4 bg-white rounded-sm" />
                ) : (
                  <FaMicrophone className="text-sm" />
                )}
              </motion.button>

              {/* Message Input */}
              <input 
                type="text" 
                placeholder={isAiThinking ? 'Generating response...' : 'Ask anything...'} 
                value={newMessage} 
                onChange={(e) => {
                  // Don't trim during typing - allow spaces
                  const sanitized = sanitizeTextInput(e.target.value).replace(/^\s+/, ''); // Only remove leading spaces
                  setNewMessage(sanitized);
                }} 
                disabled={isAiThinking}
                maxLength={500}
                className="min-w-0 flex-1 px-3 py-2 md:px-4 md:py-2 border rounded-md bg-[var(--panel)] text-[var(--text)] placeholder-[var(--muted)] text-sm"
                style={{ borderColor: 'var(--palette-3)' }}
              />

              {/* Language Selector - Compact on mobile */}
              <select 
                aria-label="Select language" 
                value={selectedLang} 
                onChange={(e) => setSelectedLang(e.target.value)}
                className="flex-shrink-0 px-2 py-2 rounded-md bg-[var(--panel)] text-[var(--text)] border border-[var(--border)] text-xs w-20 md:w-24"
              >
                {languages.map((lng) => (
                  <option key={lng.code} value={lng.code}>
                    {lng.label}
                  </option>
                ))}
              </select>

              {/* Send Button */}
              <motion.button 
                type="submit" 
                disabled={isAiThinking}
                className="flex-shrink-0 px-3 py-2 md:px-4 md:py-2 rounded-md bg-[var(--palette-1)] text-white hover:brightness-95 disabled:opacity-50 text-sm"
                whileTap={{ scale: 0.95 }}
              >
                <FaPaperPlane className="inline-block mr-1" />
                <span className="hidden xs:inline">Send</span>
              </motion.button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotebookPage;