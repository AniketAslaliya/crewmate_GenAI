import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../Axios/axios";
import papi from "../Axios/paxios";

// --- UI Components ---

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

// New component for the AI "typing" animation
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

// --- Main Notebook Page Component ---

const NotebookPage = () => {
  const { id } = useParams();
  const [activeFeature, setActiveFeature] = useState(null);
  const [notebook, setNotebook] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingFeature, setLoadingFeature] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false); // New state for AI loading
  const [storedData, setStoredData] = useState({});
  const [featureData, setFeatureData] = useState({
    summary: { title: "Document Summary", icon: "📄", content: null },
    questions: { title: "Suggested Questions", icon: "🤔", content: null },
    timeline: { title: "Timeline", icon: "⏳", content: null },
  });
  const [followUpQuestions, setFollowUpQuestions] = useState([]);

  const chatEndRef = useRef(null); // Ref for auto-scrolling

  // --- Effects ---

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

  // Effect for auto-scrolling to the bottom of the chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiThinking]);

  // --- Data Fetching Functions ---

  const fetchFeatureData = async (featureKey) => {
    if (!notebook) return;
    setLoadingFeature(true);

    try {
      if (storedData[id]?.[featureKey]) {
        setFeatureData((prev) => ({
          ...prev,
          [featureKey]: { ...prev[featureKey], content: storedData[id][featureKey] },
        }));
        setLoadingFeature(false);
        return;
      }

      const payload = { user_id: notebook?.user, thread_id: id };
      let content;

      if (featureKey === "summary") {
        const res = await papi.post(`/api/study-guide`, payload);
        const studyGuide = res.data.study_guide;
        const formattedContent = studyGuide.split("\n").map((line, index) => {
          if (line.startsWith("# ")) return <h1 key={index} className="text-2xl font-bold text-cyan-400 mt-6">{line.substring(2)}</h1>;
          if (line.startsWith("##")) return <h2 key={index} className="text-lg font-semibold text-indigo-300 mt-4">{line.substring(3)}</h2>;
          if (line.startsWith("*")) return <li key={index} className="text-sm text-gray-300 ml-6 list-disc">{line.substring(2)}</li>;
          if (line.trim() === "---") return <hr key={index} className="my-4 border-gray-700" />;
          if (line.trim()) return <p key={index} className="text-sm text-gray-400 leading-relaxed">{line}</p>;
          return null;
        });
        content = <div className="space-y-2">{formattedContent}</div>;
      } else if (featureKey === "questions") {
        const res = await papi.post(`/api/faq`, { ...payload, num_questions: 5 });
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
              <h3 className="text-lg font-bold text-cyan-300 mb-2">Q: {question}</h3>
              <p className="faq-answer text-sm text-gray-400 mt-2 hidden">A: {answer}</p>
            </motion.div>
          );
        });
        content = <div className="space-y-4">{formattedFAQ}</div>;
      } else if (featureKey === "timeline") {
        const res = await papi.post(`/api/timeline`, { ...payload, max_snippets: 10 });
        content = res.data.timeline_markdown || "No timeline available";
      }

      setStoredData((prev) => ({ ...prev, [id]: { ...prev[id], [featureKey]: content } }));
      setFeatureData((prev) => ({ ...prev, [featureKey]: { ...prev[featureKey], content } }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFeature(false);
    }
  };

  // --- Event Handlers ---

  const handleFeatureClick = (featureKey) => {
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

      // Parse response
      let apiAnswer = res2.data.answer;
      if (typeof apiAnswer === "string") {
        apiAnswer = apiAnswer.replace(/^```json\n?/, "").replace(/```$/, "");
        try {
          apiAnswer = JSON.parse(apiAnswer);
        } catch (parseError) {
          throw new Error("API answer is not valid JSON.");
        }
      }

      if (!apiAnswer?.response) throw new Error("API response is missing the 'response' field.");
      
      const apiResponse = apiAnswer.response;
      const aiContent = apiResponse["PLAIN ANSWER"];

      // Save the AI's response and get the final message object
      const res3 = await api.post("/api/messages", { chatId: id, content: aiContent, role: "response" });

      // Add the final AI message from the server to the chat
      setMessages((prev) => [...prev, res3.data.message]);
      setFollowUpQuestions(apiResponse.followupquestion || []);
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

  if (!notebook) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-gray-400">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-4 border-t-4 border-gray-800 border-t-cyan-400 rounded-full"
        />
        <span className="ml-4 text-cyan-300">Loading notebook...</span>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen text-gray-100 font-sans overflow-hidden p-4">
      <DarkBackground />

      {/* Left Panel */}
      <motion.div
        className="relative z-10 w-80 bg-gray-900/70 backdrop-blur-xl shadow-2xl p-8 flex flex-col gap-8 border border-gray-800 rounded-3xl"
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-4xl font-extrabold tracking-tight">
          <span className="text-gray-100">Legal Sah</span>
          <span className="bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">AI</span>
        </h1>
        <p className="mt-1 text-sm text-gray-400">Your AI-powered legal assistant</p>
        <div className="flex flex-col gap-4">
          {Object.entries(featureData).map(([key, { icon, title }]) => (
            <motion.div
              key={key}
              whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(56,189,248,0.3)" }}
              whileTap={{ scale: 0.97 }}
              className={`relative cursor-pointer p-5 rounded-xl transition-all duration-300 border ${
                activeFeature === key
                  ? "bg-gradient-to-r from-gray-800 to-gray-900 border-cyan-500"
                  : "bg-gray-900/40 border-gray-700 hover:border-cyan-400"
              }`}
              onClick={() => handleFeatureClick(key)}
            >
              <h3 className="flex items-center gap-3 font-bold text-lg">{icon} {title}</h3>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Middle Panel */}
      <div className="relative z-10 flex-1 flex flex-col bg-gray-900/50 backdrop-blur-md border-x border-gray-800 rounded-3xl">
        <header className="p-6 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-2xl font-light text-cyan-300 tracking-wide">{notebook.title}</h2>
        </header>

        <div className="flex-1 p-8 overflow-y-auto space-y-4 custom-scrollbar">
          {messages.map((msg) => (
            <motion.div
              key={msg._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-md px-6 py-4 rounded-2xl shadow-md text-sm font-light transition-all duration-300 ${
                  msg.role === "user"
                    ? "bg-gradient-to-r from-cyan-600 to-blue-700 text-white"
                    : "bg-gray-800/70 text-gray-200 border border-gray-700"
                }`}
              >
                {msg.content}
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
                  className="w-full text-left px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg shadow-md hover:opacity-90 transition-all duration-300"
                >
                  {question}
                </motion.button>
              ))}
            </div>
          )}
          <div ref={chatEndRef} /> {/* Invisible element to scroll to */}
        </div>

        <form onSubmit={handleSendMessage} className="p-6 border-t border-gray-800 flex items-center space-x-4">
          <input
            type="text"
            placeholder={isAiThinking ? "Generating response..." : "Ask anything or add a note..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={isAiThinking} // **IMPROVEMENT 2: Disable input**
            className="flex-1 px-5 py-3 bg-gray-800/70 border border-gray-700 rounded-full text-gray-200 placeholder-gray-500 focus:ring-1 focus:ring-cyan-400 outline-none transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <motion.button
            type="submit"
            whileHover={{ scale: isAiThinking ? 1 : 1.05 }}
            whileTap={{ scale: isAiThinking ? 1 : 0.95 }}
            disabled={isAiThinking} // **IMPROVEMENT 2: Disable button**
            className="px-6 py-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:opacity-90 transition-all duration-300 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </motion.button>
        </form>
      </div>

      {/* Right Panel */}
      <AnimatePresence>
        {activeFeature && (
          <motion.div
            className="relative z-10 w-96 bg-gray-900/80 backdrop-blur-xl shadow-2xl flex flex-col border border-gray-800 rounded-3xl"
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="p-6 border-b border-gray-800">
              <h2 className="text-xl font-semibold text-cyan-300">{featureData[activeFeature].title}</h2>
              {activeFeature === "questions" && <p className="text-sm text-gray-500 italic">Click to reveal answers</p>}
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              {loadingFeature ? (
                <div className="flex items-center justify-center h-full">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-10 h-10 border-4 border-t-4 border-gray-700 border-t-cyan-400 rounded-full"
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