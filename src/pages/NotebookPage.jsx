import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../Axios/axios";
import papi from "../Axios/paxios";
import Timeline from "../components/Timeline"; // Import the Timeline component
import PredictiveDisplay from '../components/PredictiveDisplay';
import FAQDisplay from '../components/FAQDisplay';
import CaseLawDisplay from '../components/CaseLawDisplay';
import Button from '../components/ui/Button';
import { FaComments, FaFileAlt, FaQuestionCircle, FaHistory, FaMagic, FaArrowLeft, FaPaperPlane, FaMicrophone, FaPlay, FaPause, FaGavel } from 'react-icons/fa';

import renderBold from "../utils/renderBold";
import { useToast } from "../components/ToastProvider";
// Check for browser support for Web Speech API
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
// Reference to the browser's speech synthesis API
const synthesis = window.speechSynthesis;

console.log("SpeechRecognition support:", !!SpeechRecognition);
console.log("SpeechSynthesis support:", !!synthesis);

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
    <div className="max-w-md px-4 py-3 rounded-2xl shadow-sm bg-[var(--card-bg)] text-[var(--text)] border border-[var(--border)]">
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

// Creative centered loader for non-chat features
const FeatureLoader = ({ feature }) => {
  const labelMap = {
    summary: 'Document Summary',
    questions: 'Suggested Questions',
    timeline: 'Timeline',
    predictive: 'Predictive Output',
    'case-law': 'Suggest Case Law',
  };
  const label = labelMap[feature] || 'Results';

  // Short descriptions explaining what each feature provides while loading
  const descriptionMap = {
    summary: 'A concise, structured summary of the document: key facts, issues, judgment and insights.',
    questions: 'Suggested, high-quality questions you can ask the document or the assistant to explore key points and follow-ups.',
    timeline: 'An extracted chronology of events, dates and important excerpts from the document.',
    predictive: 'Predictions and likely outcomes based on the document context and similar precedents.',
    'case-law': 'Relevant case law, citations and short summaries that relate to this document.',
  };
  const description = descriptionMap[feature];

  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
          <div className="relative flex items-center justify-center">
          <motion.div
            className="absolute w-56 h-40 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(0,70,255,0.14), rgba(3,14,85,0.08))',
              filter: 'blur(18px)'
            }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />

          <div className="relative z-10 flex items-center gap-3">
            {[0,1,2].map((i) => (
              <motion.div
                key={i}
                className="w-36 h-24 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-lg flex items-center justify-center text-sm text-[var(--muted)]"
                initial={{ y: 8, rotate: i === 1 ? -4 : 4, opacity: 0.95 }}
                animate={{ y: [0, -8, 0], rotate: i === 1 ? [-4, 0, -4] : [4, 0, 4] }}
                transition={{ duration: 1.6 + i * 0.18, repeat: Infinity, ease: 'easeInOut', delay: i * 0.06 }}
              >
                <div className="px-3 text-center">
                  <div className="font-medium text-[var(--text)]">{label}</div>
                  <div className="text-xs text-[var(--muted)] mt-1">Preparing results…</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Description shown below animation, outside of animated cards */}
        {description && (
          <div className="mt-4 flex items-center justify-center">
            <div className="max-w-lg text-center text-sm text-[var(--muted)] px-3">{description}</div>
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          <div className="text-sm text-gray-400 font-semibold">Generating {label}…</div>
          <div className="w-56 h-2 rounded-full bg-[rgba(0,70,255,0.12)] overflow-hidden">
            <motion.div className="h-full bg-[var(--palette-3)]" initial={{ width: '12%' }} animate={{ width: ['12%','68%','34%','100%'] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

const NotebookPage = (props) => {
  // Accept id as a prop when rendered inline, otherwise read from route params.
  // This makes the component usable both as an inline panel (parent passes `id`) and
  // as a full page mounted by React Router at `/legal-desk/:id`.
  const params = useParams();
  const { id: propId, inline } = props;
  const id = propId || params.id;
  const navigate = useNavigate();

  // Default to chat feature for quicker access
  const [activeFeature, setActiveFeature] = useState('chat');
  const [notebook, setNotebook] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingFeature, setLoadingFeature] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [followUpQuestions, setFollowUpQuestions] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  // const [transcribedText, setTranscribedText] = useState("");
  // const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);
  // Abort controller for feature fetches to allow cancelling when user switches features
  const featureAbortRef = useRef(null);
  const [storedData, setStoredData] = useState({});
  const [featureData, setFeatureData] = useState({
    chat: { title: "Chat with PDF", icon: <FaComments />, content: null },
    summary: { title: "Document Summary", icon: <FaFileAlt />, content: null },
    questions: { title: "Suggested Questions", icon: <FaQuestionCircle />, content: null },
    timeline: { title: "Timeline", icon: <FaHistory />, content: null },
    predictive: { title: "Predictive Output", icon: <FaMagic />, content: null },
    'case-law': { title: "Suggest Case Law", icon: <FaGavel />, content: null },
  });
  // Predictive output language state (2-letter codes)
  const [predictiveLang] = useState('en');

  // Language selector for chat input: display full names but send two-letter codes
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
  // toast API
  const toast = useToast();
  // Selected language for outgoing messages (two-letter codes)

  // Short display title for the notebook (PDF name) was removed (unused) to satisfy lint rules

  // NEW: State for Text-to-Speech
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false); // Tracks if audio is being processed
  // voice support state is handled inline via feature detection where needed

  // --- Effects ---

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
        console.error("Failed to fetch initial data:", err);
      }
    };

    fetchNotebookAndMessages();
  }, [id]);

  // Request microphone permission when entering the notebook
  useEffect(() => {
    const MIC_DENIED_KEY = 'app:mic-denied:v1';
    const requestMicrophonePermission = async () => {
      try {
        const denied = (() => { try { return !!localStorage.getItem(MIC_DENIED_KEY); } catch (e) { return false; } })();
        if (denied) {
          console.log('Microphone previously denied; not requesting again.');
          return;
        }
        console.log("Requesting microphone permission...");
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("Microphone permission granted.");
      } catch (err) {
        console.error("Microphone permission denied:", err);
        try {
          // mark denial so we don't re-request
          try { localStorage.setItem(MIC_DENIED_KEY, '1'); } catch (e) { }
          toast.error("Microphone access is required for voice features to work.");
        } catch (e) { alert("Microphone access is required for voice features to work."); }
      }
    };

    requestMicrophonePermission();
  }, [toast]);

  // Effect for auto-scrolling to the bottom of the chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiThinking]);

  // NEW: Text-to-Speech Handler
  const handleToggleSpeech = (msg) => {
    if (isSpeaking && speakingMessageId === msg._id) {
      synthesis.cancel();
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    } else {
      if (synthesis.speaking) {
        synthesis.cancel();
      }
      const utterance = new SpeechSynthesisUtterance(msg.content);
      utterance.onend = () => {
        setIsSpeaking(false);
        setSpeakingMessageId(null);
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        setSpeakingMessageId(null);
        console.error("An error occurred during speech synthesis.");
      };
      setSpeakingMessageId(msg._id);
      setIsSpeaking(true);
      synthesis.speak(utterance);
    }
  };

  // Render message content with special handling for **bold** markers.
  // Any text wrapped in **like this** will be rendered as bold.
  const renderMessageContent = (content) => {
    if (content === null || content === undefined) return null;
    if (typeof content !== 'string') return String(content);

    // Split by occurrences of **...** (non-greedy)
    const parts = content.split(/(\*\*(?:[\s\S]*?)\*\*)/g);

    return parts.map((part, idx) => {
      const m = part.match(/^\*\*(?:\s*)([\s\S]*?)(?:\s*)\*\*$/);
      if (m) {
        return <strong key={idx} className="font-semibold">{m[1]}</strong>;
      }
      return <span key={idx}>{part}</span>;
    });
  };

  // --- Voice Input Functions (API-based) ---
  // const mediaRecorderRef = useRef(null);
  // const [audioChunks, setAudioChunks] = useState([]);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const audioInputRef = useRef(null);
  const streamRef = useRef(null);
  const audioBufferRef = useRef([]);

  // Helper function to encode raw audio data into a WAV file
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
    console.log("Starting voice recording...");
    try {
      const denied = (() => { try { return !!localStorage.getItem(MIC_DENIED_KEY); } catch (e) { return false; } })();
      if (denied) {
        console.log('Microphone previously denied; not requesting again.');
        try { toast.error('Microphone access was previously denied. Enable it in your browser settings if you want voice features.'); } catch (e) { alert('Microphone access was previously denied. Enable it in your browser settings if you want voice features.'); }
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Your browser does not support voice recording.");
      }

      audioBufferRef.current = []; // Clear previous recording
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("Microphone access granted.");
      streamRef.current = stream; // Save the stream to stop tracks later

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
      console.log("Voice recording started.");
    } catch (err) {
      console.error("Voice recording failed:", err);
      try {
        if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError' || /denied/i.test(String(err.message || '')))) {
          try { localStorage.setItem(MIC_DENIED_KEY, '1'); } catch (e) {}
        }
      } catch (e) {}
      try { toast.error(err.message || "Voice recording is not supported on this device."); } catch(e){ alert(err.message || "Voice recording is not supported on this device."); }
    }
  };

  const stopVoiceRecording = () => {
    console.log("Stopping voice recording...");
    if (!isRecording) {
      console.warn("Voice recording is not active.");
      return;
    }
    setIsRecording(false);

    const sampleRate = audioContextRef.current?.sampleRate;
    console.log("Sample rate:", sampleRate);

    // Disconnect nodes and stop microphone track
    audioInputRef.current?.disconnect();
    processorRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    audioContextRef.current?.close();

    if (audioBufferRef.current.length === 0) {
      console.warn("No audio was recorded.");
      try { toast.warn("No audio was recorded."); } catch(e){ alert("No audio was recorded."); }
      return;
    }

    const totalLength = audioBufferRef.current.reduce(
      (acc, val) => acc + val.length,
      0
    );
    const completeBuffer = new Float32Array(totalLength);
    let offset = 0;
    for (const buffer of audioBufferRef.current) {
      completeBuffer.set(buffer, offset);
      offset += buffer.length;
    }

    const audioBlob = encodeWAV(completeBuffer, sampleRate);
    console.log("Audio blob created:", audioBlob);
    sendAudioToApi(audioBlob);
  };

  const sendAudioToApi = async (audioBlob) => {
    console.log("Sending audio to API...");
    if (!audioBlob || audioBlob.size <= 44) {
      console.warn("Audio blob is empty or invalid.");
      return;
    }
    setIsProcessingAudio(true); // Start loader
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.wav");

      console.log("Sending FormData to API...");
      const res = await papi.post("/api/ingest-audio", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("API response:", res.data);
      const transcript = res.data.transcript;
        if (transcript && !transcript.startsWith("(speech error")) {
        console.log("Transcription successful:", transcript);
        setNewMessage(transcript.trim()); // <-- Paste transcript into input
      } else {
        console.error("Transcription failed on the backend:", transcript);
        try { toast.error(`Transcription failed: ${transcript}`); } catch(e){ alert(`Transcription failed: ${transcript}`); }
      }
    } catch (err) {
      console.error("Transcription API call failed:", err);
      try { toast.error("Transcription failed. Please try again."); } catch(e){ alert("Transcription failed. Please try again."); }
    } finally {
      setIsProcessingAudio(false); // Stop loader
    }
  };

  // --- Data Fetching Functions ---

  const fetchFeatureData = async (featureKey, langOverride) => {
    if (!notebook) return;
    setLoadingFeature(true);

    // Abort previous in-flight feature request (if any)
    try {
      if (featureAbortRef.current) {
        featureAbortRef.current.abort();
      }
    } catch (e) {
      // ignore
    }
    const controller = new AbortController();
    featureAbortRef.current = controller;

    try {
  // Determine language to use for predictive feature (override if provided)
  // Preference: langOverride -> globalLanguage (from header) -> local predictiveLang
  const langToUse = featureKey === 'predictive' ? (langOverride || predictiveLang) : undefined;
      const cacheKey = featureKey === 'predictive' ? `${featureKey}:${langToUse}` : featureKey;
      if (storedData[id]?.[cacheKey]) {
        setFeatureData((prev) => ({
          ...prev,
          [featureKey]: { ...prev[featureKey], content: storedData[id][cacheKey] },
        }));
        setLoadingFeature(false);
        return;
      }
      const payload = { user_id: notebook?.user, thread_id: id };
      let content;

      if (featureKey === "summary") {
        const res = await papi.post(`/api/study-guide`, payload, { signal: controller.signal });
        const studyGuide = res.data.study_guide;

        // If the API returned a string (markdown), keep the old behaviour.
        if (!studyGuide) {
          content = <div className="text-sm text-gray-400">No study guide available.</div>;
        } else if (typeof studyGuide === 'string') {
          const formattedContent = studyGuide.split("\n").map((line, index) => {
            if (line.startsWith("# ")) return <h1 key={index} className="text-2xl font-bold mt-6" style={{ color: 'var(--palette-3)' }}>{line.substring(2)}</h1>;
            if (line.startsWith("##")) return <h2 key={index} className="text-lg font-semibold text-[var(--palette-3)] mt-4">{line.substring(3)}</h2>;
            if (line.startsWith("*")) return <li key={index} className="text-sm text-gray-800 ml-6 list-disc">{renderBold(line.substring(2))}</li>;
            if (line.trim() === "---") return <hr key={index} className="my-4 border-gray-300" />;
            if (line.trim()) return <p key={index} className="text-sm text-gray-700 leading-relaxed">{renderBold(line)}</p>;
            return null;
          });
          content = <div className="space-y-2">{formattedContent}</div>;
        } else if (typeof studyGuide === 'object') {
          // Render a structured study_guide object with clear sections
          const caseTitle = studyGuide.case_title || notebook?.title || 'Study Guide';
          const summaryObj = studyGuide.summary || {};
          const insights = studyGuide.insights || {};

          const renderArray = (arr) => Array.isArray(arr) ? arr.map((it, i) => <li key={i} className="ml-4 list-disc">{it}</li>) : null;

          content = (
            <div className="space-y-4 text-sm text-gray-800">
              <h2 className="text-2xl font-bold" style={{ color: 'var(--palette-3)' }}>{caseTitle}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section className="space-y-3">
                  <h3 className="text-lg font-semibold">Summary</h3>
                  {summaryObj.facts && <div>
                    <h4 className="font-medium">Facts</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{renderBold(summaryObj.facts)}</p>
                  </div>}

                  {summaryObj.issues && <div>
                    <h4 className="font-medium">Issues</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{renderBold(summaryObj.issues)}</p>
                  </div>}

                  {summaryObj.arguments && <div>
                    <h4 className="font-medium">Arguments</h4>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">{renderBold(summaryObj.arguments)}</div>
                  </div>}

                  {summaryObj.judgment && <div>
                    <h4 className="font-medium">Judgment</h4>
                    <p className="text-sm text-gray-700">{renderBold(summaryObj.judgment)}</p>
                  </div>}
                </section>

                <aside className="space-y-3">
                  <h3 className="text-lg font-semibold">Insights</h3>
                  {insights.verdict && <div>
                    <h4 className="font-medium">Verdict</h4>
                    <p className="text-sm text-gray-700">{insights.verdict}</p>
                  </div>}

                  {Array.isArray(insights.key_laws) && insights.key_laws.length > 0 && (
                    <div>
                      <h4 className="font-medium">Key Laws</h4>
                      <ul className="text-sm text-gray-700 ml-4 list-disc">
                        {insights.key_laws.map((law, idx) => <li key={idx}>{law}</li>)}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(insights.key_precedents) && insights.key_precedents.length > 0 && (
                    <div>
                      <h4 className="font-medium">Key Precedents</h4>
                      <ul className="text-sm text-gray-700 ml-4 list-disc">{renderArray(insights.key_precedents)}</ul>
                    </div>
                  )}

                  {insights.legal_provisions_summary && (
                    <div>
                      <h4 className="font-medium">Legal Provisions</h4>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">{insights.legal_provisions_summary}</div>
                    </div>
                  )}
                </aside>
              </div>
            </div>
          );
        }
      } else if (featureKey === "questions") {
        const res = await papi.post(`/api/faq`, { ...payload, num_questions: 5 }, { signal: controller.signal });
        const faqMarkdown = res.data.faq_markdown;
        // Use FAQDisplay component for consistent rendering
        content = <FAQDisplay faq={faqMarkdown} />;
      } else if (featureKey === "timeline") {
        const res = await papi.post(`/api/timeline`, { ...payload, max_snippets: 10 }, { signal: controller.signal });
        // Some backend variants return { success: true, timeline: [], message: '...' }
        // If timeline array is empty but a message is provided, show that message instead of an empty timeline.
        const timelineArray = res.data?.timeline;
        const timelineMarkdown = res.data?.timeline_markdown || "";
        if (Array.isArray(timelineArray) && timelineArray.length === 0 && res.data?.message) {
          content = <div className="text-sm text-gray-400 italic">{res.data.message}</div>;
        } else if (timelineMarkdown && timelineMarkdown.trim()) {
          content = <Timeline timelineMarkdown={timelineMarkdown} />;
        } else if (Array.isArray(timelineArray) && timelineArray.length > 0) {
          // Convert simple array to a markdown table expected by Timeline component
          const md = ['Date | Event', '---|---', ...timelineArray.map(item => `${item.date || ''} | ${item.event || item.description || ''}`)].join('\n');
          content = <Timeline timelineMarkdown={md} />;
        } else {
          // Fallback: show message if present, otherwise a friendly empty state
          content = <div className="text-sm text-gray-400 italic">{res.data?.message || 'No timeline events found.'}</div>;
        }
      } else if (featureKey === 'case-law') {
        // call suggest-case-law API via papi and render structured case cards
        try {
          const res = await papi.post(`/api/suggest-case-law`, { ...payload, output_language: (langToUse || predictiveLang).slice(0,2) }, { signal: controller.signal });
          const suggestion = res.data;

          // Helper to normalize a potential case-like object
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

          // If API returned JSON-like string, try parse it
          let parsed = suggestion;
          if (typeof suggestion === 'string') {
            try {
              parsed = JSON.parse(suggestion);
            } catch (e) {
              // leave parsed as original string
            }
          }

          if (Array.isArray(parsed)) {
            casesData = parsed.map(normalizeCase).filter(Boolean);
          } else if (parsed && typeof parsed === 'object') {
            // Common keys: cases, results, items, matches
            const arr = parsed.cases || parsed.results || parsed.items || parsed.matches || parsed.suggested_cases || parsed.suggestedCases;
            if (Array.isArray(arr) && arr.length > 0) {
              casesData = arr.map(normalizeCase).filter(Boolean);
            } else {
              // If object has top-level entries that look like cases, map them
              const entries = Object.entries(parsed).filter(([k, v]) => typeof v === 'object' || typeof v === 'string');
              if (entries.length > 0) {
                casesData = entries.map(([k, v]) => {
                  if (typeof v === 'string') return { case_name: k, summary: v };
                  return normalizeCase({ case_name: k, ...v });
                }).filter(Boolean);
              }
            }
          }

          // If we still have nothing, and suggestion was a string, try split heuristics
          if (casesData.length === 0 && typeof suggestion === 'string') {
            // remove common noise lines
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
          if (err.name === 'CanceledError' || err.name === 'AbortError') {
            console.log('Feature fetch aborted:', featureKey);
            setLoadingFeature(false);
            return;
          }
          console.error('Suggest case law API failed', err);
          content = <div className="text-sm text-red-400">Failed to fetch case law suggestions.</div>;
        }
      } else if (featureKey === "predictive") {
        // call predictive-output API
        try {
          const res = await papi.post(`/api/predictive-output`, { ...payload, output_language: (langToUse || predictiveLang).slice(0,2) }, { signal: controller.signal });
          const pred = res.data.prediction;
          // Delegate rendering to PredictiveDisplay for consistent, user-friendly fields
          content = <PredictiveDisplay prediction={pred} />;
        } catch (err) {
          if (err.name === 'CanceledError' || err.name === 'AbortError') {
            // request was aborted; bail silently
            console.log('Feature fetch aborted:', featureKey);
            setLoadingFeature(false);
            return;
          }
          console.error('Predictive API failed', err);
          content = <div className="text-sm text-red-400">Failed to fetch predictive output.</div>;
        }
      }

  setStoredData((prev) => ({ ...prev, [id]: { ...prev[id], [cacheKey]: content } }));
  setFeatureData((prev) => ({ ...prev, [featureKey]: { ...prev[featureKey], content } }));
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') {
        console.log('Feature fetch aborted:', featureKey);
        return;
      }
      console.error(err);
    } finally {
      // clear controller if it hasn't been replaced
      if (featureAbortRef.current === controller) featureAbortRef.current = null;
      setLoadingFeature(false);
    }
  };

  // --- Event Handlers ---

  const handleFeatureClick = (featureKey) => {
    // if same feature clicked, toggle off
    if (activeFeature === featureKey) {
      setActiveFeature(null);
      try { featureAbortRef.current?.abort(); } catch (e) { }
      return;
    }

    // Chat is a live feature that doesn't require a fetch; render it directly
    if (featureKey === 'chat') {
      setActiveFeature('chat');
      return;
    }

    setActiveFeature(featureKey);
    fetchFeatureData(featureKey);
  };

  const handleSendMessage = async (e, question = null) => {
    e?.preventDefault();
    const messageToSend = question || newMessage.trim();
    if (!messageToSend || isAiThinking) return;

    // **IMPROVEMENT 1: Optimistic UI Update**
    // The user's message is added to the state immediately.
    const userMessage = {
      _id: `optimistic-${Date.now()}`,
      role: "user",
      content: messageToSend,
    };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setNewMessage("");
    setFollowUpQuestions([]);
    setIsAiThinking(true); // **IMPROVEMENT 2: Set loading state**

    try {
      // Run user message saving in the background
      api.post("/api/messages", { chatId: id, content: messageToSend, role: "user" });

      // Call the ask API
  const payload = { user_id: notebook.user, thread_id: id, query: messageToSend, top_k: 4, output_language: (selectedLang || 'en').slice(0,2) };
  const res2 = await papi.post("/api/ask", payload);

      // Parse response (be tolerant: API may return a plain string or JSON)
      let apiAnswer = res2.data?.answer;
      let aiContent = "";
      let followups = [];

      if (apiAnswer == null) {
        throw new Error("API returned empty answer");
      }

      if (typeof apiAnswer === "string") {
        // strip fenced codeblocks if present
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
            // Fallback: use the original trimmed string
            aiContent = trimmed;
          }
        } catch (parseError) {
          // Not JSON — treat as plain text answer
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

      // Save the AI's response and get the final message object
      const res3 = await api.post("/api/messages", { chatId: id, content: aiContent, role: "response" });

      // Add the final AI message from the server to the chat
      setMessages((prev) => [...prev, res3.data.message]);
      setFollowUpQuestions(followups || []);
    } catch (err) {
      console.error("Error sending message:", err);
      // Add a user-friendly error message to the chat
      const errorMessage = {
        _id: `error-${Date.now()}`,
        role: 'response',
        content: 'Sorry, I encountered an error. Please try again.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsAiThinking(false); // **IMPROVEMENT 2: Unset loading state**
    }
  };

  // --- Render Logic ---


  if (!id) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center bg-[var(--bg)] text-red-600">
        No notebook selected.
      </div>
    );
  }

  if (!notebook) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center bg-[var(--bg)] text-[var(--muted)]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-4 border-t-4 border-[var(--border)] border-t-[var(--accent)] rounded-full"
        />
        <span className="ml-4 text-[var(--accent)]">Loading notebook...</span>
      </div>
    );
  }

  return (
    <div
      className={`relative flex font-sans overflow-visible flex-1 min-h-0 bg-[var(--bg)] ${inline ? "panel rounded-none" : ""}`}
      style={inline ? { height: "70vh", minHeight: 400 } : {}}
    >
      

  <DarkBackground />

      {/* Feature navbar has been moved into the main output header to make the output workspace primary */}

      {/* Output Workspace (right side) */}
  <div className="relative z-10 flex-1 panel rounded-none min-h-0 bg-[var(--bg)] border-l flex flex-col" style={{ height: "100%" }}>
        <header className="p-4 md:p-6 border-b flex items-center justify-between gap-3 flex-shrink-0">
          {/* Left: Back button (separated) */}
          <div className="flex items-center min-w-[120px]">
            {!inline && id && (
              <Button variant="secondary" onClick={() => navigate('/legal-desk')} aria-label="Back to Legal Desk">
                <FaArrowLeft className="inline-block w-4 mr-2" />
                {/* <span className="hidden sm:inline">Back</span> */}
              </Button>
            )}
          </div>

          {/* Center: Notebook title - prominent heading */}
          

          {/* Right: Horizontal feature navbar inside header */}
          <nav className="flex items-center gap-2 overflow-auto" role="tablist" aria-label="Notebook features">
            {Object.entries(featureData).map(([key, { icon, title }]) => (
              <button
                key={key}
                onClick={() => handleFeatureClick(key)}
                role="tab"
                aria-selected={activeFeature === key}
                tabIndex={0}
                className={`flex items-center gap-2 whitespace-nowrap py-2 px-3 text-sm font-medium transition-all duration-150 ${
                  activeFeature === key ? 'border-b-2 font-semibold' : 'opacity-95 hover:opacity-100'
                }`}
                style={{
                  color: activeFeature === key ? 'var(--palette-1, #003bbf)' : '#71719F',
                  borderColor: activeFeature === key ? 'var(--palette-3-dark, #003bbf)' : undefined,
                }}
              >
                <span className="text-lg">{icon}</span>
                <span className="hidden md:inline">{title}</span>
              </button>
            ))}
          </nav>
        </header>

  <div className="flex-1 p-3 custom-scrollbar flex flex-col min-h-[80vh] max-h-[80vh]">
          {activeFeature ? (
            activeFeature === 'chat' ? (
              // Render chat UI in the output workspace with fixed input at bottom
              <div className="flex flex-col flex-1 overflow-y-scroll scrollbar-hide ">
                {/* Scrollable chat messages area */}
                <div className="flex-1  space-y-4 pb-4 custom-scrollbar m-3 ">
                  {messages.map((msg) => (
                    <motion.div key={msg._id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`relative max-w-[72%] px-5 py-3 shadow-sm transition-colors duration-150 ${
                          msg.role === 'user'
                            ? 'bg-[var(--palette-1)] text-white rounded-tl-2xl rounded-bl-2xl rounded-tr-none rounded-br-2xl hover:brightness-95'
                            : 'bg-[var(--card-bg)] text-[var(--text)] rounded-tr-2xl rounded-br-2xl rounded-tl-none rounded-bl-2xl border border-[var(--border)] hover:border-[var(--palette-3)]'
                        }`}
                        style={{
                          // Slightly larger, more readable text
                          fontSize: '0.95rem',
                          lineHeight: '1.45',
                        }}
                      >
                        <div className="whitespace-pre-wrap">{renderMessageContent(msg.content)}</div>
                        <div className="mt-3 flex items-center justify-end gap-2 text-[11px] opacity-80">
                          {/* status / play control (timestamp removed) */}
                          {msg.role !== 'user' && msg.content && (
                                <button onClick={() => handleToggleSpeech(msg)} aria-label={isSpeaking && speakingMessageId === msg._id ? 'Stop speech' : 'Play speech'} className="p-1.5 text-[var(--muted)] hover:text-[var(--text)] transition-colors bg-[var(--bg)] rounded-full border border-[var(--border)] hover:border-[var(--palette-3)] pl-2">
                              {isSpeaking && speakingMessageId === msg._id ? <FaPause /> : <FaPlay />}
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {isAiThinking && <TypingIndicator />}

                  {followUpQuestions.length > 0 && (  
                    <div className="mt-4 space-y-2">
                      <h3 className="text-gray-400 text-sm font-semibold">Follow-up Questions:</h3>
                      {followUpQuestions.map((question, index) => (
                        <motion.button key={index} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={(e) => handleSendMessage(e, question)} className="w-full text-left px-4 py-2 bg-[var(--palette-2)] text-white rounded-md shadow-sm hover:opacity-95 transition-all duration-200">{question}</motion.button>
                      ))}
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* Fixed input area at bottom */}
                <div className="flex-shrink-0 pt-4 mt-4 border-t border-[var(--border)] bg-[var(--bg)] sticky bottom-0">
                  <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                    <motion.button type="button" onClick={isRecording ? stopVoiceRecording : startVoiceRecording} disabled={isProcessingAudio} className={`px-4 py-2 rounded-md ${isRecording ? 'bg-red-500 text-white' : isProcessingAudio ? 'bg-gray-400 text-white' : 'bg-[var(--panel)] text-[var(--text)] border border-[var(--border)]'} `}>
                      {isProcessingAudio ? '...' : isRecording ? 'Stop' : (<><FaMicrophone className="inline-block mr-2" />Voice</>) }
                    </motion.button>
                    <input type="text" placeholder={isAiThinking ? 'Generating response...' : 'Ask anything or add a note...'} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} disabled={isAiThinking} className="flex-1 px-4 py-2 border rounded-md bg-[var(--panel)] text-[var(--text)] placeholder-[var(--muted)]" style={{ borderColor: 'var(--palette-3)' }} />
                    <select aria-label="Select language" value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)} className="ml-2 px-3 py-2 rounded-md bg-[var(--panel)] text-[var(--text)] border border-[var(--border)] text-sm">
                      {languages.map((lng) => (
                        <option key={lng.code} value={lng.code}>{lng.label}</option>
                      ))}
                    </select>
                    <motion.button type="submit" className="ml-2 px-4 py-2 rounded-md bg-[var(--palette-1)] text-white hover:brightness-95"><FaPaperPlane className="inline-block mr-2" />Send</motion.button>
                  </form>
                </div>
              </div>
            ) : (
              // Render regular feature output
              loadingFeature ? (
                <FeatureLoader feature={activeFeature} />
              ) : (
                <motion.div key={activeFeature} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 text-sm text-gray-300">
                  {featureData[activeFeature]?.content}
                </motion.div>
              )
            )
          ) : (
            <div className="text-center text-gray-400 mt-16">
              <h3 className="text-lg font-semibold">Select a feature to view output</h3>
              <p className="text-sm mt-2">Choose a feature from the left to display results here (chat, summary, timeline, etc.).</p>
            </div>
          )}
        </div>
      </div>

      
    </div>
  );
};

export default NotebookPage;