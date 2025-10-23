import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../Axios/axios";
import papi from "../Axios/paxios";
import Timeline from "../components/Timeline"; // Import the Timeline component
import Button from '../components/ui/Button';


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
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 10 }}
    className="flex justify-start"
  >
  <div className="max-w-md px-6 py-4 rounded-2xl shadow-md bg-surface text-primary border" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
        <motion.span
          className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--palette-3)'}} 
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
      />
        <motion.span
          className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--palette-3)'}} 
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 0.8, delay: 0.2, repeat: Infinity, ease: "easeInOut" }}
      />
        <motion.span
          className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--palette-3)'}} 
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 0.8, delay: 0.4, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  </motion.div>
);

const NotebookPage = (props) => {
  // Accept id as a prop; (do not use useParams here to avoid undefined id when rendering inline)
  const { id, inline } = props;
  const navigate = useNavigate();

  const [activeFeature, setActiveFeature] = useState(null);
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
    summary: { title: "Document Summary", icon: "📄", content: null },
    questions: { title: "Suggested Questions", icon: "🤔", content: null },
    timeline: { title: "Timeline", icon: "⏳", content: null },
    predictive: { title: "Predictive Output", icon: "🔮", content: null },
  });
  // Predictive output language state (2-letter codes)
  const [predictiveLang] = useState('en');

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
    const requestMicrophonePermission = async () => {
      try {
        console.log("Requesting microphone permission...");
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("Microphone permission granted.");
      } catch (err) {
        console.error("Microphone permission denied:", err);
        alert("Microphone access is required for voice features to work.");
      }
    };

    requestMicrophonePermission();
  }, []);

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
    console.log("Starting voice recording...");
    try {
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
      alert(err.message || "Voice recording is not supported on this device.");
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
      alert("No audio was recorded.");
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
      const res = await papi.post("/api/transcribe-audio", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("API response:", res.data);
      const transcript = res.data.transcript;
      if (transcript && !transcript.startsWith("(speech error")) {
        console.log("Transcription successful:", transcript);
        setNewMessage(transcript.trim()); // <-- Paste transcript into input
      } else {
        console.error("Transcription failed on the backend:", transcript);
        alert(`Transcription failed: ${transcript}`);
      }
    } catch (err) {
      console.error("Transcription API call failed:", err);
      alert("Transcription failed. Please try again.");
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
        const formattedContent = studyGuide.split("\n").map((line, index) => {
          if (line.startsWith("# ")) return <h1 key={index} className="text-2xl font-bold mt-6" style={{ color: 'var(--palette-3)' }}>{line.substring(2)}</h1>;
          if (line.startsWith("##")) return <h2 key={index} className="text-lg font-semibold text-indigo-300 mt-4">{line.substring(3)}</h2>;
          if (line.startsWith("*")) return <li key={index} className="text-sm text-gray-300 ml-6 list-disc">{line.substring(2)}</li>;
          if (line.trim() === "---") return <hr key={index} className="my-4 border-gray-700" />;
          if (line.trim()) return <p key={index} className="text-sm text-gray-400 leading-relaxed">{line}</p>;
          return null;
        });
        content = <div className="space-y-2">{formattedContent}</div>;
      } else if (featureKey === "questions") {
        const res = await papi.post(`/api/faq`, { ...payload, num_questions: 5 }, { signal: controller.signal });
        const faqMarkdown = res.data.faq_markdown;
        const formattedFAQ = faqMarkdown.split("\n\n").map((block, index) => {
          if (!block.startsWith("### Q:")) return null;
          const [questionLine, answerLine] = block.split("\n");
          const question = questionLine.replace("### Q:", "").trim();
          const answer = answerLine.replace("A:", "").replace(/\(excerpt\)/g, "").trim();
          return (
            <motion.div
              key={index}
              whileHover={{ scale: 1.02 }}
              className="p-5 bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 rounded-xl shadow-lg mb-4 cursor-pointer"
              onClick={(e) => e.currentTarget.querySelector(".faq-answer")?.classList.toggle("hidden")}
            >
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--palette-3)' }}>Q: {question}</h3>
              <p className="faq-answer text-sm text-gray-400 mt-2 hidden">A: {answer}</p>
            </motion.div>
          );
        });
        content = <div className="space-y-4">{formattedFAQ}</div>;
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
      } else if (featureKey === "predictive") {
        // call predictive-output API
        try {
          const res = await papi.post(`/api/predictive-output`, { ...payload, output_language: (langToUse || predictiveLang).slice(0,2) }, { signal: controller.signal });
          const pred = res.data.prediction;
          const scenarios = pred?.scenarios || [];
          const disclaimer = pred?.disclaimer || '';

          content = (
            <div className="space-y-4">
              {scenarios.map((s, i) => (
                <div key={i} className="p-4 bg-surface border rounded-md" style={{ borderColor: 'var(--palette-3)' }}>
                  <h4 className="font-semibold" style={{ color: 'var(--palette-3)' }}>{`Scenario ${i+1}: ${s.outcome}`}</h4>
                  <p className="text-sm text-gray-300 mt-2 whitespace-pre-wrap">{s.reasoning}</p>
                </div>
              ))}
              {disclaimer && (
                <div className="mt-4 text-xs text-gray-500 italic">{disclaimer}</div>
              )}
            </div>
          );
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
      // abort any existing fetch
      try { featureAbortRef.current?.abort(); } catch (e) { }
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
      const payload = { user_id: notebook.user, thread_id: id, query: messageToSend, top_k: 4 };
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
      className={`relative flex font-sans overflow-visible flex-1 min-h-0 bg-[var(--bg)] ${inline ? "rounded-2xl shadow-2xl panel" : ""}`}
      style={inline ? { height: "70vh", minHeight: 400 } : {}}
    >
      

  <DarkBackground />

      {/* Left Panel */}
      <motion.div
        className="relative z-10 w-80 panel backdrop-blur-xl shadow-2xl p-8 flex flex-col gap-8 border rounded-3xl min-h-0 overflow-y-auto"
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        style={{ height: "100%" }}
      >
        {/* ...sidebar content... */}
        <h1 className="text-4xl font-extrabold tracking-tight">
          <span className="text-gray-100">Legal Sah</span>
          <span className="bg-clip-text text-transparent" style={{ background: 'linear-gradient(90deg, var(--palette-3), var(--palette-2))' }}>AI</span>
        </h1>
        <p className="mt-1 text-sm text-gray-400">Your AI-powered legal assistant</p>
        <div className="flex flex-col gap-4">
          {Object.entries(featureData).map(([key, { icon, title }]) => (
            <motion.div
              key={key}
              whileHover={{ scale: 1.05, boxShadow: "0 8px 24px rgba(69,104,130,0.12)" }}
              whileTap={{ scale: 0.97 }}
              className={`relative cursor-pointer p-5 rounded-xl transition-all duration-300 border ${
                activeFeature === key
                  ? "bg-gradient-to-r from-gray-800 to-gray-900"
                  : "bg-gray-900/40 border-gray-700"
              }`}
              onClick={() => handleFeatureClick(key)}
            >
              <h3 className="flex items-center gap-3 font-bold text-lg">{icon} {title}</h3>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Middle Panel */}
      <div className="relative z-10 flex-1 flex flex-col panel border-x rounded-3xl min-h-0"
        style={{ height: "100%" }}
      >
        <header className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!inline && id && (
              <Button variant="secondary" onClick={() => navigate('/home?feature=chatpdf')}>← Back</Button>
            )}
            <h2 className="text-2xl font-light theme-primary tracking-wide">{notebook.title}</h2>
          </div>
        </header>
  <div className="flex-1 p-8 overflow-y-auto space-y-4 custom-scrollbar pb-28 min-h-0">
          {messages.map((msg) => (
            <motion.div
              key={msg._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`relative max-w-md px-6 py-4 rounded-2xl shadow-md text-sm font-light transition-all duration-300 ${
                    msg.role === "user"
                      ? "bg-[var(--palette-3)] text-white"
                      : "bg-[var(--card-bg)] text-[var(--text)] border border-[var(--palette-3)]"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.role === "response" && msg.content && (
                  <button
                    onClick={() => handleToggleSpeech(msg)}
                    className="absolute bottom-2 right-2 p-1.5 rounded-full text-muted transition-colors" style={{ background: 'rgba(0,0,0,0.03)' }}
                    aria-label={isSpeaking && speakingMessageId === msg._id ? "Stop speech" : "Play speech"}
                  >
                    {isSpeaking && speakingMessageId === msg._id ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          ))}

          {/* **IMPROVEMENT 3: Render Typing Indicator** */}
          {isAiThinking && <TypingIndicator />}

          {followUpQuestions.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-gray-400 text-sm font-semibold">Follow-up Questions:</h3>
              {followUpQuestions.map((question, index) => (
                <motion.button
                  key={index}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => handleSendMessage(e, question)}
                      className="w-full text-left px-4 py-2 btn-gradient text-white rounded-lg shadow-md hover:opacity-90 transition-all duration-300"
                >
                  {question}
                </motion.button>
              ))}
            </div>
          )}
          <div ref={chatEndRef} /> {/* Invisible element to scroll to */}
        </div>

  <form onSubmit={handleSendMessage} className="p-6 border-t panel-border flex items-center space-x-4 bg-[var(--panel)] sticky bottom-0 z-40 min-h-[64px] sticky-input" style={{ borderColor: 'var(--palette-3)' }}>
          <motion.button
            type="button"
            onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
            disabled={isProcessingAudio} // Disable button only while processing audio
            className={`px-6 py-3 rounded-full ${
              isRecording
                ? "bg-red-500"
                : isProcessingAudio
                ? "bg-gray-400 cursor-not-allowed"
                  : "btn-gradient"
            } text-white font-semibold hover:opacity-90 transition-all duration-300 shadow-md`}
          >
            {isProcessingAudio ? (
              <svg
                className="animate-spin h-5 w-5 text-white mx-auto"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                ></path>
              </svg>
            ) : isRecording ? (
              "Stop"
            ) : (
              "Voice"
            )}
          </motion.button>
          <input
            type="text"
            placeholder={isAiThinking ? "Generating response..." : "Ask anything or add a note..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={isAiThinking} // Disable input while AI is thinking
            className="flex-1 px-5 py-3 bg-[var(--panel)] border rounded-full text-[var(--text)] placeholder-[var(--muted)] outline-none transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderColor: 'var(--palette-3)' }}
          />
          <motion.button
            type="submit"
            whileHover={{ scale: isAiThinking ? 1 : 1.05 }}
            whileTap={{ scale: isAiThinking ? 1 : 0.95 }}
            disabled={isAiThinking} // Disable button while AI is thinking
            className="px-6 py-3 rounded-full btn-gradient text-white font-semibold hover:opacity-90 transition-all duration-300 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </motion.button>
        </form>
      </div>

      {/* Right Panel */}
      <AnimatePresence>
        {activeFeature && (
          <motion.div
            className="relative z-10 w-96 bg-gray-100/80 backdrop-blur-xl shadow-2xl flex flex-col border border-gray-800 rounded-3xl pb-28"
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            transition={{ duration: 0.6 }}
            style={{ height: "100%" }}
          >
            <div className="p-6 border-b  border-gray-800 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold" style={{ color: 'var(--palette-3)' }}>{featureData[activeFeature]?.title || featureData[activeFeature].title}</h2>
                {activeFeature === "questions" && <p className="text-sm text-gray-500 italic">Click to reveal answers</p>}
              </div>
              
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              {loadingFeature ? (
                <div className="flex items-center justify-center h-full">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-10 h-10 border-4 border-t-4 border-gray-700 rounded-full"
                    style={{ borderTopColor: 'var(--palette-3)' }}
                  />
                </div>
              ) : (
                <motion.div
                  key={activeFeature}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-4 text-sm text-gray-300"
                >
                  {featureData[activeFeature].content}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotebookPage;