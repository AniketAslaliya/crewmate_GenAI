import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../Axios/axios";

const DarkBackground = () => (
  <div className="absolute inset-0 -z-10 bg-gray-900" style={{
    backgroundImage: `radial-gradient(at 0% 0%, rgba(203,213,225,0.05) 0, transparent 50%),
                      radial-gradient(at 100% 100%, rgba(59,130,246,0.05) 0, transparent 50%)`,
  }}>
    <div className="absolute inset-0 -z-10" style={{
      backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'6\' height=\'6\' viewBox=\'0 0 6 6\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.05\' fill-rule=\'evenodd\'%3E%3Cpath d=\'M5 0h1L0 6V5zm1 5v1H5z\'/%3E%3C/g%3E%3C/svg%3E")',
    }}></div>
  </div>
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

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    } catch (err) {
      console.error(err);
    }
  };

  if (!notebook) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-gray-400 font-sans">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-4 border-t-4 border-gray-700 border-t-gray-400 rounded-full"
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
        <div className="p-6 bg-gray-800 border border-gray-700 rounded-2xl shadow-lg transition-transform duration-300 transform hover:scale-[1.01]">
          <p className="text-gray-300 text-sm leading-relaxed font-light">
            An intelligent summary of the document, highlighting key findings, core concepts, and central arguments. This concise overview is designed to give you a quick and comprehensive understanding of the material.
          </p>
        </div>
      ),
    },
    topics: {
      title: "Key Topics",
      icon: "💡",
      content: (
        <div className="flex flex-col gap-3">
          {["Ethical AI", "Algorithmic Bias", "Data Privacy", "Model Transparency", "Digital Accountability"].map((topic, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-4 bg-gray-800 border border-gray-700 rounded-xl text-gray-300 shadow-md flex items-center gap-2 font-medium transition-transform duration-300 hover:scale-[1.02] cursor-pointer"
            >
              <span className="text-lg">#</span> {topic}
            </motion.div>
          ))}
        </div>
      ),
    },
    questions: {
      title: "Suggested Questions",
      icon: "🤔",
      content: (
        <div className="flex flex-col gap-3">
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
              className="p-4 bg-gray-800 border border-gray-700 rounded-xl text-gray-300 shadow-md cursor-pointer transition-transform duration-300 hover:scale-[1.02]"
            >
              <p className="text-xs italic font-light">{q}</p>
            </motion.div>
          ))}
        </div>
      ),
    },
    citations: {
      title: "Citations",
      icon: "📚",
      content: (
        <div className="flex flex-col gap-3">
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
              className="p-4 bg-gray-800 border border-gray-700 rounded-xl text-gray-300 shadow-md flex items-center gap-2 transition-transform duration-300 hover:scale-[1.02] cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 2a1 1 0 011-1h1.414A1 1 0 019 6.414L11.414 9A1 1 0 0112 9.586V13a1 1 0 01-1 1H7a1 1 0 01-1-1V6z" clipRule="evenodd" />
              </svg>
              <span className="font-medium text-sm">{c}</span>
            </motion.div>
          ))}
        </div>
      ),
    },
  };

  return (
    <div className="relative flex h-screen text-gray-100 font-sans overflow-hidden p-4">
      <DarkBackground />

      {/* Left Panel */}
      <motion.div
        className="relative z-10 w-80 bg-gray-900/70 backdrop-blur-lg shadow-2xl p-8 flex flex-col gap-8 border-r border-gray-700 rounded-3xl"
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-4xl font-extrabold tracking-tight">
          <span className="text-gray-100">Legal Sah</span>
          <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">AI</span>
        </h1>
        <p className="mt-1 text-sm text-gray-400 tracking-wide">Your AI-powered legal assistant</p>

        <div className="flex flex-col gap-4">
          {Object.keys(featureData).map((key) => (
            <motion.div
              key={key}
              whileHover={{ scale: 1.02, boxShadow: "0 8px 30px rgba(0, 0, 0, 0.3)" }}
              whileTap={{ scale: 0.98 }}
              className={`relative cursor-pointer p-5 rounded-xl transition-all duration-300 ${
                activeFeature === key ? "bg-gray-800 shadow-xl border border-gray-700" : "bg-gray-900/50 text-gray-400 hover:bg-gray-900/60"
              }`}
              onClick={() => setActiveFeature(key)}
            >
              <h3 className="flex items-center gap-3 font-bold text-lg">
                {featureData[key].icon} {featureData[key].title}
              </h3>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Middle Panel: Chat */}
      <div className="relative z-10 flex-1 flex flex-col bg-gray-900/50 backdrop-blur-sm border-l border-gray-700 border-r">
        <header className="bg-gray-900/70 backdrop-blur-lg p-6 border-b border-gray-700 flex items-center justify-between shadow-lg">
          <h2 className="text-3xl font-extralight text-gray-100 tracking-wide">{notebook.title}</h2>
        </header>

        <div className="flex-1 p-8 overflow-y-auto space-y-4 custom-scrollbar">
          {messages.map((msg, index) => (
            <motion.div
              key={msg._id}
              ref={index === messages.length - 1 ? scrollRef : null}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-md px-6 py-4 rounded-2xl shadow-md transition-all duration-300 ${
                msg.role === "user"
                  ? "bg-gray-700 text-white rounded-br-lg"
                  : "bg-gray-800 text-gray-100 rounded-bl-lg border border-gray-700"
              }`}>
                <p className="font-light text-sm">{msg.content}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <form onSubmit={handleSendMessage} className="p-6 bg-gray-900/80 backdrop-blur-lg border-t border-gray-700 flex items-center space-x-4 shadow-top">
          <input
            type="text"
            placeholder="Ask anything or add a note..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 px-5 py-3 bg-gray-800 border border-gray-700 rounded-full text-gray-100 placeholder-gray-400 focus:ring-1 focus:ring-blue-500 outline-none transition-all duration-300 font-light text-sm"
          />
          <motion.button
            type="submit"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors duration-300 shadow-md text-sm"
          >
            Send
          </motion.button>
        </form>
      </div>

      {/* Right Panel: Feature Content */}
      <motion.div
        className="relative z-10 w-96 bg-gray-900/70 backdrop-blur-lg shadow-2xl p-10 flex flex-col gap-10 border-l border-gray-700"
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-3xl font-bold text-gray-100 tracking-wide">{featureData[activeFeature].title}</h2>
        <motion.div key={activeFeature} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col gap-4">
          {featureData[activeFeature].content}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default NotebookPage;
