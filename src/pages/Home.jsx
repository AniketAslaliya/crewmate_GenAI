import React, { useEffect, useState } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import api from "../Axios/axios";
import papi from "../Axios/paxios";
// A modern background component with a gradient and subtle noise texture
const ModernBackground = () => (
  <div className="absolute inset-0 -z-10 bg-gray-900" style={{
    backgroundImage: `radial-gradient(at 0% 0%, rgba(203,213,225,0.1) 0, transparent 50%),
                      radial-gradient(at 100% 100%, rgba(59,130,246,0.1) 0, transparent 50%)`,
  }}>
    <div className="absolute inset-0 -z-10" style={{
      backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'6\' height=\'6\' viewBox=\'0 0 6 6\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.1\' fill-rule=\'evenodd\'%3E%3Cpath d=\'M5 0h1L0 6V5zm1 5v1H5z\'/%3E%3C/g%3E%3C/svg%3E")',
    }}></div>
  </div>
);

const Home = () => {
  const [chats, setChats] = useState([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
    const [Loading,setLoading]=useState(false);
  const [userProfile, setUserProfile] = useState({ name: null, photo: "", id: null });
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState("newest");

  useEffect(() => {
    fetchChats();
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const res = await api.get("/auth/me");
      console.log("User Profile Response:", res.data);
      if (res.data && res.data.user) {
        setUserProfile({
          id: res.data.user.id,
          name: res.data.user.name,
          photo: res.data.user.picture || "https://i.pravatar.cc/150?u=a042581f4e29026704d",
        });
        
      }
      
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
      setUserProfile({ name: "Guest User", photo: "https://i.pravatar.cc/150?u=a042581f4e29026704d" });
    }
  };

  const fetchChats = async () => {
    try {
      const res = await api.get("/api/getallchats");
      setChats(res.data.chats || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpen = (id) => {
    navigate(`/legaldesk/${id}`);
  };

  const handleAddlegaldesk = async () => {
    if (!file) {
      alert("Please select a file before creating a legaldesk.");
      return;
    }

    if (!title.trim()) {
      alert("Please enter a title.");
      return;
    }

    setUploading(true);

    try {
      // First request: Create a legal desk
      const res1 = await api.post("/api/uploaddoc", {
        title,
      });

      if (res1.data && res1.data.chat) {
        setChats([...chats, res1.data.chat]);
        setTitle("");
        setFile(null);
        setAdding(false);

        const id = res1.data.chat._id;

       
       

        // Second request: Send file and additional data
        const formData = new FormData();
        console.log("User Profile in handleAddlegaldesk:", userProfile._id);
        console.log("thread_id:", id);
        console.log("title:", title);
        formData.append("user_id", userProfile.id || ""); // Add user_id
        formData.append("thread_id", id); // Use the created legal desk ID as thread_id
        formData.append("title", title); // Add title
        formData.append("file", file); // Add file
        setLoading(true);
        const res2 = await papi.post("/api/ingest", formData, {
          headers: {
            "Content-Type": "multipart/form-data", // Set content type for file upload
          },
        });

        if (res2.data && res2.data.success) {
          setLoading(false);
           // Navigate to the created legal desk
          navigate(`/legaldesk/${id}`);
        } else {
          alert("Failed to upload file. Try again.");
        }
      } else {
        alert("Failed to create legaldesk. Try again.");
      }
    } catch (err) {
      console.error(err);
      alert("Error creating legaldesk or uploading file. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/delete/${id}`);
      setChats(chats.filter((chat) => chat._id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDragOver = (e) => {
  e.preventDefault(); // Prevent default browser behavior
  e.stopPropagation(); // Stop event propagation
  console.log("Drag over event detected");
};

const handleDrop = (e) => {
  e.preventDefault(); // Prevent default browser behavior
  e.stopPropagation(); // Stop event propagation

  const files = Array.from(e.dataTransfer.files); // Get the dropped files
  if (files.length > 0) {
    console.log("Dropped file:", files[0]);
    setFile(files[0]); // Set the first file in the state
  }
};

  const filteredAndSortedChats = chats
    .filter((chat) => chat.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortOption === "oldest") {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      if (sortOption === "newest") {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      if (sortOption === "title-asc") {
        return a.title.localeCompare(b.title);
      }
      if (sortOption === "title-desc") {
        return b.title.localeCompare(a.title);
      }
      return 0;
    });

  const handleLogout = () => {
    console.log("User logged out.");
  };

  return (
    <div className="relative min-h-screen bg-gray-950 text-gray-100 p-6 font-sans">
      <ModernBackground />

      {/* Scanning Animation */}
      {Loading && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="relative w-64 h-64 bg-gray-800 rounded-lg overflow-hidden shadow-lg">
            {/* Scanning Bar */}
            <motion.div
              className="absolute inset-x-0 top-0 h-2 bg-blue-500"
              animate={{ y: [0, "100%"], opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            ></motion.div>

            {/* Document Placeholder */}
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="w-24 h-24 text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>

            {/* Scanning Text */}
            <p className="absolute bottom-4 w-full text-center text-gray-300 font-medium">
              Scanning document...
            </p>
          </div>
        </motion.div>
      )}

      {/* Header and Profile */}
      <motion.div
        className="flex flex-col md:flex-row md:items-center justify-between mb-8 p-4 bg-white/5 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-5xl font-extrabold mb-4 md:mb-0 bg-gradient-to-r from-blue-300 to-indigo-400 bg-clip-text text-transparent leading-tight">
          Legal Sah<span className="text-white">AI</span>
        </h1>
        <div className="flex items-center space-x-4">
          <div className="flex flex-col items-end">
            <span className="text-lg font-medium text-gray-300">{userProfile.name}</span>
            <motion.button
              onClick={handleLogout}
              className="text-xs text-red-400 hover:text-red-300 transition-colors duration-200 mt-1"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Logout
            </motion.button>
          </div>
          <img
            src={userProfile.photo}
            alt="Profile"
            className="w-14 h-14 rounded-full border-2 border-indigo-400"
          />
        </div>
      </motion.div>

      {/* Search and Sort Section */}
      <motion.div
        className="flex flex-col sm:flex-row justify-between items-center mb-8 p-4 bg-white/5 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <div className="relative w-full sm:w-1/2">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search Legal Desks..."
            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-white/20 bg-gray-800/50 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-2 w-full sm:w-auto mt-4 sm:mt-0">
          <label htmlFor="sort" className="text-sm text-gray-400">Sort by:</label>
          <select
            id="sort"
            className="w-full sm:w-auto px-4 py-3 border border-white/20 rounded-2xl bg-gray-800/50 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-4">
        <motion.div
          onClick={() => setAdding(true)}
          className="flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-3xl cursor-pointer hover:border-blue-400 bg-gray-800/30 hover:bg-gray-800/50 transition-all duration-300 p-8 group relative overflow-hidden"
          whileHover={{ scale: 1.03, rotate: 1 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-500/30 transition-colors duration-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 text-blue-300 group-hover:text-blue-200"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-200 mb-2">Create New Legal Desk</h3>
          <p className="text-gray-400 text-center text-sm">
            Organize your thoughts, research, and ideas in a new Legal Desk.
          </p>
          <div className="mt-6 px-4 py-2 bg-blue-500/30 text-blue-200 rounded-full text-sm font-medium group-hover:bg-blue-500/40 transition-colors">
            Get Started
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10"></div>
        </motion.div>

        <AnimatePresence>
          {filteredAndSortedChats.map((chat) => (
            <motion.div
              key={chat._id}
              className="relative group bg-gray-800/50 rounded-3xl overflow-hidden shadow-2xl hover:shadow-lg transition-all duration-300 border border-white/10"
              whileHover={{ y: -6, scale: 1.02 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="h-40 bg-gradient-to-r from-blue-600 to-indigo-700 flex items-center justify-center">
                <div className="text-white text-center p-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12 mx-auto mb-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <h2 className="font-bold text-lg truncate px-2">{chat.title}</h2>
                </div>
              </div>

              <div className="p-5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-medium text-gray-400 bg-gray-700/50 px-2 py-1 rounded-full">
                    {new Date(chat.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <motion.button
                    onClick={() => handleOpen(chat._id)}
                    className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center"
                    whileHover={{ x: 3 }}
                  >
                    Open
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 ml-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </motion.button>

                  <div className="flex space-x-2">
                    <motion.button
                      onClick={() => handleDelete(chat._id)}
                      className="p-2 text-gray-400 hover:text-red-400 rounded-full hover:bg-gray-700/50 transition-all"
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

              <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
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
              className="relative bg-gray-800 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-white/10"
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ type: "spring", stiffness: 120 }}
            >
              <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-100">Create New Legal Desk</h2>
                <button
                  onClick={() => {
                    setAdding(false);
                    setFile(null);
                    setTitle("");
                  }}
                  className="rounded-full p-2 text-gray-400 hover:bg-gray-700 transition"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Legal Desk Title</label>
                  <input
                    type="text"
                    placeholder="Enter Legal Desk title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="border border-gray-600 p-3 rounded-xl w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-700/50 text-gray-100"
                  />
                </div>

                <div
                  className="border-2 border-dashed border-gray-600 rounded-2xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-gray-700/50 transition-all"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById("file-upload").click()}
                >
                  <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-14 w-14 mx-auto text-blue-400"
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
                  <p className="mt-4 text-lg font-medium text-gray-200">Drag & drop or click to upload</p>
                  <p className="text-sm text-gray-400 mt-1">Supported: PDF, DOC, DOCX, TXT, Images</p>
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files[0])}
                  />
                </div>

                {file && (
                  <div className="mt-4 p-3 bg-green-500/20 rounded-lg border border-green-500 text-green-300">
                    <p className="font-medium">Selected: {file.name}</p>
                  </div>
                )}

                <div className="flex gap-3 justify-end mt-6">
                  <motion.button
                    onClick={() => {
                      setAdding(false);
                      setFile(null);
                      setTitle("");
                    }}
                    className="px-5 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 transition text-gray-300"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={handleAddlegaldesk}
                    disabled={!title.trim() || !file || uploading}
                    className="px-5 py-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-600 disabled:text-gray-400 transition flex items-center"
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
                        Creating...
                      </>
                    ) : (
                      "Create Legal Desk"
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Home;