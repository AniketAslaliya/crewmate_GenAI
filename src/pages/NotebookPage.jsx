import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../Axios/axios";
import papi from "../Axios/paxios";

const DarkBackground = () => (
  <div className="absolute inset-0 -z-10 bg-black">
    <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900 animate-pulse-slow" />
    <div
      className="absolute inset-0 opacity-[0.07]"
      style={{
        backgroundImage:
          "linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)",
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
    <div className="max-w-md px-6 py-4 rounded-2xl shadow-md bg-gray-800/70 text-gray-200 border border-gray-700 flex items-center space-x-2">
      <motion.span
        className="w-2 h-2 bg-cyan-400 rounded-full"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        className="w-2 h-2 bg-cyan-400 rounded-full"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 0.8, delay: 0.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        className="w-2 h-2 bg-cyan-400 rounded-full"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 0.8, delay: 0.4, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  </motion.div>
);

const NotebookPage = () => {
  const { id } = useParams();
  const [notebook, setNotebook] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [followUpQuestions, setFollowUpQuestions] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const chatEndRef = useRef(null);

  // audio refs
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const audioInputRef = useRef(null);
  const streamRef = useRef(null);
  const audioBufferRef = useRef([]);

  useEffect(() => {
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiThinking]);

  // wav encoder
  const encodeWAV = (samples, sampleRate) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
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

    writeString(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, samples.length * 2, true);
    floatTo16BitPCM(view, 44, samples);

    return new Blob([view], { type: "audio/wav" });
  };

  const startVoiceRecording = async () => {
    try {
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
        audioBufferRef.current.push(new Float32Array(inputData));
      };

      source.connect(processor);
      processor.connect(context.destination);
      setIsRecording(true);
    } catch (err) {
      alert("Microphone access failed.");
    }
  };

  const stopVoiceRecording = async () => {
    setIsRecording(false);

    audioInputRef.current?.disconnect();
    processorRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close();

    if (!audioBufferRef.current.length) return;

    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    const totalLength = audioBufferRef.current.reduce((a, b) => a + b.length, 0);
    const completeBuffer = new Float32Array(totalLength);
    let offset = 0;
    for (const b of audioBufferRef.current) {
      completeBuffer.set(b, offset);
      offset += b.length;
    }

    const audioBlob = encodeWAV(completeBuffer, sampleRate);
    await sendAudioToApi(audioBlob);
  };

  const sendAudioToApi = async (audioBlob) => {
    if (!audioBlob) return;
    setIsProcessingAudio(true);
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "voice.wav");
      const res = await papi.post("/api/transcribe-audio", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const transcript = res.data.transcript;
      if (transcript) {
        handleSendMessage(null, transcript.trim());
      }
    } catch (err) {
      alert("Transcription failed.");
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const handleSendMessage = async (e, question = null) => {
    e?.preventDefault();
    const messageToSend = question || newMessage.trim();
    if (!messageToSend || isAiThinking) return;

    const userMessage = {
      _id: `optimistic-${Date.now()}`,
      role: "user",
      content: messageToSend,
    };
    setMessages((prev) => [...prev, userMessage]);
    setNewMessage("");
    setFollowUpQuestions([]);
    setIsAiThinking(true);

    try {
      api.post("/api/messages", { chatId: id, content: messageToSend, role: "user" });
      const payload = { user_id: notebook.user, thread_id: id, query: messageToSend, top_k: 4 };
      const res2 = await papi.post("/api/ask", payload);
      let apiAnswer = res2.data.answer;
      if (typeof apiAnswer === "string") {
        apiAnswer = JSON.parse(apiAnswer.replace(/^```json\n?/, "").replace(/```$/, ""));
      }
      const aiContent = apiAnswer.response["PLAIN ANSWER"];
      const res3 = await api.post("/api/messages", { chatId: id, content: aiContent, role: "response" });
      setMessages((prev) => [...prev, res3.data.message]);
      setFollowUpQuestions(apiAnswer.response.followupquestion || []);
    } catch (err) {
      setMessages((prev) => [...prev, { _id: `err-${Date.now()}`, role: "response", content: "Error. Try again." }]);
    } finally {
      setIsAiThinking(false);
    }
  };

  if (!notebook) {
    return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>;
  }

  return (
    <div className="relative flex h-screen text-gray-100 font-sans overflow-hidden p-4">
      <DarkBackground />
      <div className="flex-1 flex flex-col bg-gray-900/50 rounded-3xl border border-gray-800">
        <header className="p-6 border-b border-gray-800">
          <h2 className="text-2xl text-cyan-300">{notebook.title}</h2>
        </header>

        <div className="flex-1 p-8 overflow-y-auto space-y-4">
          {messages.map((msg) => (
            <div key={msg._id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-md px-6 py-4 rounded-2xl ${msg.role === "user" ? "bg-cyan-600 text-white" : "bg-gray-800 text-gray-200"}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isAiThinking && <TypingIndicator />}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="p-6 border-t border-gray-800 flex items-center space-x-4">
          <motion.button
            type="button"
            onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
            disabled={isProcessingAudio}
            className={`px-6 py-3 rounded-full text-white font-semibold shadow-md ${
              isRecording ? "bg-red-500" : isProcessingAudio ? "bg-gray-500" : "bg-cyan-600"
            }`}
          >
            {isProcessingAudio ? "Processing..." : isRecording ? "Stop" : "Voice"}
          </motion.button>
          <input
            type="text"
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={isAiThinking}
            className="flex-1 px-5 py-3 bg-gray-800 border border-gray-700 rounded-full text-gray-200"
          />
          <motion.button type="submit" disabled={isAiThinking} className="px-6 py-3 rounded-full bg-blue-600 text-white shadow-md">
            Send
          </motion.button>
        </form>
      </div>
    </div>
  );
};

export default NotebookPage;
