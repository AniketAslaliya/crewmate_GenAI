import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../Axios/axios";

// A component for the sophisticated, light background with subtle lines
const LightBackground = () => (
  <div className="absolute inset-0 z-0 bg-neutral-50" style={{
    backgroundImage: `linear-gradient(45deg, #f5f5f5 25%, transparent 25%),
                     linear-gradient(-45deg, #f5f5f5 25%, transparent 25%),
                     linear-gradient(45deg, transparent 75%, #f5f5f5 75%),
                     linear-gradient(-45deg, transparent 75%, #f5f5f5 75%)`,
    backgroundSize: '20px 20px',
    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
    opacity: 0.5
  }}></div>
);

const NotebookPage = () => {
  const { id } = useParams();
  const [activeFeature, setActiveFeature] = useState("summary");
  const [notebook, setNotebook] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef();

  useEffect(() => {
    const fetchNotebook = async () => {
      try {
        const res = await api.get(`/api/getchat/${id}`);
        setNotebook(res.data.chat);
      } catch (err) {
        console.error(err);
      }
    };

    const fetchMessages = async () => {
      try {
        const res = await api.get(`/api/messages/${id}`);
        setMessages(res.data.messages);
      } catch (err) {
        console.error(err);
      }
    };

    fetchNotebook();
    fetchMessages();
  }, [id]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      const res = await api.post("/api/messages", {
        chatId: id,
        content: newMessage,
        role: "user",
      });
      setMessages([...messages, res.data.message]);
      setNewMessage("");
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      console.error(err);
    }
  };

  if (!notebook) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center bg-neutral-100 text-neutral-500 font-sans">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-4 border-t-4 border-neutral-300 border-t-neutral-500 rounded-full"
        />
        <span className="ml-4">Loading notebook...</span>
      </div>
    );
  }

  const featureData = {
    summary: {
      title: "Document Summary",
      icon: "📄",
      content: (
  <div className="p-8 bg-card border rounded-3xl shadow-lg transition-transform duration-300 transform hover:scale-[1.01]" style={{ borderColor: 'var(--palette-3)' }}>
          <p className="text-neutral-600 text-base leading-relaxed font-light">
            An intelligent summary of the document, highlighting key findings, core concepts, and central arguments. This concise overview is designed to give you a quick and comprehensive understanding of the material.
          </p>
        </div>
      ),
    },
    topics: {
      title: "Key Topics",
      icon: "💡",
      content: (
        <div className="flex flex-col gap-4">
          {["Ethical AI", "Algorithmic Bias", "Data Privacy", "Model Transparency", "Digital Accountability"].map((topic, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-5 bg-surface border rounded-2xl text-primary shadow-md flex items-center gap-3 font-medium transition-transform duration-300 hover:scale-[1.02] cursor-pointer" style={{ borderColor: 'var(--palette-3)' }}
            >
              <span className="text-xl">#</span> {topic}
            </motion.div>
          ))}
        </div>
      ),
    },
    questions: {
      title: "Suggested Questions",
      icon: "🤔",
      content: (
        <div className="flex flex-col gap-4">
          {[
            "What are the primary ethical concerns arising from this document?",
            "How can algorithmic bias be systematically reduced in practice?",
            "What frameworks are suggested to support accountability in AI development?",
            "Could the principles discussed be applied to a different industry?",
          ].map((q, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-5 bg-white border border-neutral-200 rounded-2xl text-neutral-700 shadow-md cursor-pointer transition-transform duration-300 hover:scale-[1.02]"
            >
              <p className="text-sm italic font-light">{q}</p>
            </motion.div>
          ))}
        </div>
      ),
    },
    citations: {
      title: "Citations",
      icon: "📚",
      content: (
        <div className="flex flex-col gap-4">
          {[
            "Research Paper on AI Ethics.pdf",
            "Official Guidelines.docx",
            "Whitepaper on Trustworthy AI.pdf"
          ].map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-5 bg-white border border-neutral-200 rounded-2xl text-neutral-700 shadow-md flex items-center gap-3 transition-transform duration-300 hover:scale-[1.02] cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-neutral-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 2a1 1 0 011-1h1.414A1 1 0 019 6.414L11.414 9A1 1 0 0112 9.586V13a1 1 0 01-1 1H7a1 1 0 01-1-1V6z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{c}</span>
            </motion.div>
          ))}
        </div>
      ),
    },
  };

  return (
    <div className="relative flex flex-1 min-h-0 font-sans overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <LightBackground />

      {/* Left Panel: Features */}
      <motion.div
        className="relative z-10 w-96 panel backdrop-blur-lg shadow-2xl p-10 flex flex-col gap-10 border-r"
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-4xl font-extrabold text-neutral-900 tracking-wide">Notebook Hub</h2>
        <div className="flex flex-col gap-6">
          {Object.keys(featureData).map((key) => (
            <motion.div
              key={key}
              whileHover={{ scale: 1.02, boxShadow: "0 8px 30px rgba(0, 0, 0, 0.08)" }}
              whileTap={{ scale: 0.98 }}
              className={`relative cursor-pointer p-6 rounded-2xl transition-all duration-300 ${
                activeFeature === key ? "bg-white shadow-xl border border-neutral-200" : "bg-neutral-100/50 text-neutral-600 hover:bg-neutral-100"
              }`}
              onClick={() => setActiveFeature(key)}
            >
              <h3 className="flex items-center gap-4 font-bold text-xl">
                {featureData[key].icon} {featureData[key].title}
              </h3>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Middle Panel: Chat */}
      <div className="relative z-10 flex-1 flex flex-col panel">
        <header className="panel p-8 border-b flex items-center justify-between">
          <h2 className="text-4xl font-extralight text-neutral-900 tracking-wide">
            {notebook.title}
          </h2>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </motion.button>
        </header>

        {/* Chat Messages */}
  <div className="flex-1 p-10 overflow-y-auto space-y-6 custom-scrollbar">
          {messages.map((msg, index) => (
            <motion.div
              key={msg._id}
              ref={index === messages.length - 1 ? scrollRef : null}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xl px-7 py-5 rounded-3xl shadow-lg transition-all duration-300 ${
                  msg.role === "user"
                    ? "bg-neutral-700 text-white rounded-br-lg"
                    : "bg-white text-neutral-800 rounded-bl-lg border border-neutral-200"
                }`}
              >
                <p className="font-light">{msg.content}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Input Box */}
  <form onSubmit={handleSendMessage} className="p-8 panel border-t flex items-center space-x-5">
          <input
            type="text"
            placeholder="Ask anything or add a note..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 px-6 py-4 bg-[var(--panel)] border border-[var(--border)] rounded-full text-[var(--text)] placeholder-[var(--muted)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition-all duration-300 font-light"
          />
          <motion.button
            type="submit"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-8 py-4 rounded-full bg-[var(--text)] text-[var(--panel)] font-semibold hover:opacity-90 transition-colors duration-300 shadow-md"
          >
            Send
          </motion.button>
        </form>
      </div>

      {/* Right Panel: Feature Content */}
      <motion.div
        className="relative z-10 w-96 bg-white/70 backdrop-blur-lg shadow-2xl p-10 flex flex-col gap-10 border-l border-neutral-200"
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-3xl font-bold text-neutral-900 tracking-wide">
          {featureData[activeFeature].title}
        </h2>

        <motion.div
          key={activeFeature}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-4"
        >
          {featureData[activeFeature].content}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default NotebookPage;