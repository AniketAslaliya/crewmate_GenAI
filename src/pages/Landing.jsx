import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../context/AuthContext';
import api from '../Axios/axios';

const Landing = () => {
  const navigate = useNavigate();
  const { user, setToken } = useAuthStore();
  const [guestLoading, setGuestLoading] = useState(false);

  const handleGuestStart = async () => {
    try {
      setGuestLoading(true);
      const res = await api.post('/auth/guest-login');
      const token = res.data?.token;
      if (token) {
        // Persist token in auth store which will fetch user
        setToken(token);
        // Navigate to home after short delay to ensure user fetch starts
        navigate('/home');
      } else {
        console.error('No token received from guest-login');
      }
    } catch (err) {
      console.error('Guest login failed', err);
    } finally {
      setGuestLoading(false);
    }
  };
  const [activeFeature, setActiveFeature] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const featuresSectionRef = useRef(null);

  // Define features array before useEffect that uses it
  const features = [
    {
      icon: (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 20
        ">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
      title: 'Legal Desks',
      description: 'Create dedicated workspaces for each case. Upload documents, ask questions, and get AI-powered insights directly from your case files.',
      details: ['Multi-document support', 'Context-aware AI analysis', 'RAG-based retrieval', 'Secure document storage'],
      color: 'from-sky-400 to-blue-500',
      bgGradient: 'from-sky-50 to-blue-50',
      demo: 'Upload contracts, agreements, or case files and ask questions like "What are the payment terms?" or "Summarize this contract"'
    },
    {
      icon: (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      title: 'Smart Form AutoFill',
      description: 'AI detects form fields in PDFs and images, suggests values, and fills them automatically with voice or text input support.',
      details: ['OCR field detection', 'Voice-to-text input', 'Multi-language support', 'AcroForm compatibility'],
      color: 'from-sky-400 to-blue-500',
      bgGradient: 'from-sky-50 to-blue-50',
      demo: 'Upload any legal form PDF and watch AI identify all fields. Fill them using voice commands in 10+ Indian languages!'
    },
    {
      icon: (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      title: 'Quick Legal Guide',
      description: 'Get instant answers to legal questions with AI-powered chat. Ask about divorce, arrests, wills, child custody, and more.',
      details: ['24/7 AI assistance', 'Follow-up questions', 'Persistent conversations', 'Multi-language responses'],
      color: 'from-sky-400 to-blue-500',
      bgGradient: 'from-sky-50 to-blue-50',
      demo: 'Ask questions like "How do I file for divorce?" or "What are my rights if wrongfully terminated?" and get instant guidance'
    },
    {
      icon: (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      title: 'Find & Connect with Lawyers',
      description: 'Search verified lawyers by specialty, location, experience, and rating. Connect instantly via secure chat.',
      details: ['Advanced filtering', 'Verified profiles', 'Real-time chat', 'Consultation requests'],
      color: 'from-sky-400 to-blue-500',
      bgGradient: 'from-sky-50 to-blue-50',
      demo: 'Filter by specialization, location, fees, languages, and court experience. Send consultation requests and chat directly'
    },
    {
      icon: (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      title: 'Admin Verification System',
      description: 'Lawyers undergo rigorous verification by admins. Only verified professionals can accept clients.',
      details: ['Document verification', 'Profile review', 'Status tracking', 'Quality assurance'],
      color: 'from-sky-400 to-blue-500',
      bgGradient: 'from-sky-50 to-blue-50',
      demo: 'Lawyers submit credentials, admins review and approve. Ensures you only connect with legitimate professionals'
    },
    {
      icon: (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
      ),
      title: 'Multi-Language Voice Support',
      description: 'Speak in Hindi, Gujarati, Marathi, Tamil, Telugu, Bengali, Kannada, Malayalam, Punjabi, or English.',
      details: ['10+ Indian languages', 'Text-to-speech', 'Voice-to-text', 'Real-time translation'],
      color: 'from-sky-400 to-blue-500',
      bgGradient: 'from-sky-50 to-blue-50',
      demo: 'Fill forms, ask questions, and get responses in your preferred language with full voice support'
    }
  ];

  useEffect(() => {
    // Redirect to home if user is already logged in
    if (user) {
      navigate('/home');
    }
  }, [user, navigate]);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Auto-rotating circular carousel for features
  useEffect(() => {
    const numFeatures = features.length;
    const rotationInterval = 3000; // 3 seconds per feature (faster)
    
    const intervalId = setInterval(() => {
      setActiveFeature(prev => {
        const next = (prev + 1) % numFeatures;
        return next;
      });
    }, rotationInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [features.length]);

  const stats = [
    { 
      value: '10+', 
      label: 'Languages Supported', 
      icon: (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    { 
      value: '24/7', 
      label: 'AI Assistance', 
      icon: (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      )
    },
    { 
      value: '100%', 
      label: 'Verified Lawyers', 
      icon: (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    { 
      value: 'Free', 
      label: 'Document Analysis', 
      icon: (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    }
  ];

  const useCases = [
    {
      title: 'For Individuals',
      icon: (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      points: [
        'Get quick legal guidance on common issues',
        'Fill government forms with AI assistance',
        'Upload and analyze contracts before signing',
        'Find and consult with specialized lawyers',
        'Store and organize all legal documents'
      ]
    },
    {
      title: 'For Lawyers',
      icon: (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
        </svg>
      ),
      points: [
        'Build your verified professional profile',
        'Connect with potential clients instantly',
        'Manage client communications in one place',
        'Use AI to analyze case documents quickly',
        'Track consultation requests and appointments'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50" />
        <motion.div
          className="absolute top-20 left-10 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            x: [0, -50, 0],
            y: [0, -30, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Header */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-2xl border-b border-gray-100/80 shadow-sm"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <motion.div
              className="flex items-center gap-3 cursor-pointer group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <div className="relative">
                <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110 p-1">
                  <img
                    src="/logo.png"
                    alt="Legal SahAI"
                    className="w-full h-full object-contain rounded"
                  />
                </div>
                <motion.div
                  className="absolute inset-0 bg-slate-600 rounded-xl opacity-0 group-hover:opacity-20 blur-xl"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xl md:text-2xl font-bold bg-gradient-to-r from-slate-800 via-blue-800 to-indigo-800 bg-clip-text text-transparent leading-tight">
                  Legal SahAI
                </span>
                <span className="text-[10px] md:text-xs font-medium text-gray-500 -mt-0.5">
                  AI-Powered Legal Platform
                </span>
              </div>
            </motion.div>
            <div className="flex items-center gap-3 md:gap-4">
              <motion.button
                whileHover={{ scale: 1.05, y: -1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/login')}
                className="px-5 md:px-6 py-2 md:py-2.5 text-gray-700 font-semibold hover:text-blue-600 transition-all duration-300 text-sm md:text-base relative group"
              >
                <span className="relative z-10">Sign In</span>
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300" />
              </motion.button>
              <motion.button
                whileHover={{ 
                  scale: 1.05, 
                  y: -2,
                  boxShadow: "0 20px 40px -10px rgba(30, 64, 175, 0.4)" 
                }}
                whileTap={{ scale: 0.95 }}
                onClick={handleGuestStart}
                className="px-5 md:px-7 py-2.5 md:py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 text-sm md:text-base relative overflow-hidden group"
                aria-label="Get started as guest"
                disabled={guestLoading}
              >
                <span className="relative z-10 flex items-center gap-2">
                  {guestLoading ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      Get Started Free
                      <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </span>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 30 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-5xl mx-auto"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="inline-flex items-center gap-2 mb-6 px-6 py-2 bg-slate-100 text-slate-700 rounded-full text-sm font-semibold border border-slate-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Powered by Advanced AI & RAG Technology
            </motion.div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              Your Complete
              <span className="block mt-2 text-primary">
                Legal AI Platform
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
              Upload documents, fill forms with voice, connect with verified lawyers, and get instant AI-powered legal guidance — all in one intelligent platform
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 20px 40px -10px rgba(30, 41, 59, 0.5)" }}
                whileTap={{ scale: 0.95 }}
                onClick={handleGuestStart}
                className="px-10 py-4 bg-slate-800 text-white rounded-2xl text-lg font-bold shadow-2xl hover:bg-slate-900 transition-all"
                disabled={guestLoading}
              >
                {guestLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                    Starting...
                  </span>
                ) : (
                  'Start Using Free →'
                )}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-10 py-4 bg-white text-gray-800 rounded-2xl text-lg font-bold shadow-xl border-2 border-gray-200 hover:border-slate-400 transition-all"
                onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
              >
                Explore Features
              </motion.button>
            </div>

            {/* Stats Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
            >
              {stats.map((stat, idx) => (
                <motion.div
                  key={idx}
                  whileHover={{ y: -5, scale: 1.05 }}
                  className="p-6 bg-white rounded-2xl shadow-lg border border-gray-100"
                >
                  <div className="w-12 h-12 text-slate-700 mb-3 mx-auto">{stat.icon}</div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Interactive Features Showcase - Full Screen Carousel */}
      <section id="features" ref={featuresSectionRef} className="relative w-full min-h-screen bg-gradient-to-b from-gray-50 to-white py-20 mb-5">
        <div className="container mx-auto px-6">
          {/* Section Title */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-semibold text-primary mb-4">
              Powerful Features Built for You
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Everything you need to handle legal matters — from document analysis to lawyer consultations
            </p>
          </motion.div>

          {/* Full Screen Carousel Container */}
          <div className="relative w-full h-[600px] md:h-[700px] overflow-hidden">
            <div className="relative w-full h-full flex items-center justify-center [perspective:2000px]">
              {features.map((feature, index) => {
                // Calculate position relative to active feature
                let offset = index - activeFeature;
                if (offset > features.length / 2) offset -= features.length;
                if (offset < -features.length / 2) offset += features.length;
                
                // Only show 3 cards: previous (-1), current (0), next (+1)
                if (Math.abs(offset) > 1) return null;
                
                const isActive = offset === 0;
                const isLeft = offset === -1;
                
                // Calculate positions and styles
                const xPosition = offset * 450; // Horizontal spacing
                const scale = 1; // Consistent size for all cards
                const opacity = isActive ? 1 : 0.3; // Side cards fade out
                const zIndex = isActive ? 20 : isLeft ? 10 : 10;
                const rotateY = isActive ? 0 : offset * 20; // Tilt side cards slightly
                const rotateZ = isActive ? 0 : offset * 2; // Slight vertical tilt for side cards
                
                return (
                  <motion.div
                    key={index}
                    initial={false}
                    animate={{
                      x: xPosition,
                      scale: scale,
                      opacity: opacity,
                      rotateY: rotateY,
                      rotateZ: rotateZ,
                      z: isActive ? 0 : -150, // Depth for 3D effect
                    }}
                    transition={{
                      duration: 1,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    style={{
                      transformStyle: 'preserve-3d',
                      position: 'absolute',
                      width: '90%',
                      maxWidth: '800px',
                      height: '90%',
                      zIndex: zIndex,
                    }}
                    className="rounded-3xl p-8 md:p-10 text-white bg-gradient-to-br from-sky-400 via-blue-500 to-blue-600 shadow-2xl cursor-pointer"
                    onClick={() => setActiveFeature(index)}
                  >
                    <div className="flex flex-col items-start justify-center h-full">
                      <div className="w-18 h-18 md:w-20 md:h-20 mb-5 text-white bg-white/20 backdrop-blur-sm rounded-xl p-4 shadow-xl">
                        {feature.icon}
                      </div>
                      <h3 className="text-2xl md:text-3xl font-bold mb-4">
                        {feature.title}
                      </h3>
                      <p className="text-base md:text-lg text-white/90 leading-relaxed mb-5">
                        {feature.description}
                      </p>
                      <div className="space-y-2 mb-5">
                        {feature.details.map((detail, detailIdx) => (
                          <div key={detailIdx} className="flex items-center gap-2 text-sm md:text-base text-white/80">
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                            {detail}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 p-3 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                        <p className="text-xs md:text-sm text-white/90">
                          <span className="font-semibold">Try it: </span>
                          {feature.demo}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            
            {/* Navigation Dots */}
            <div className="absolute bottom-6 left-0 right-0 z-30 flex items-center justify-center gap-2 flex-wrap px-6  ">
              {features.map((feature, index) => (
                <motion.button
                  key={index}
                  onClick={() => setActiveFeature(index)}
                  whileHover={{ scale: 1.2, y: -2 }}
                  whileTap={{ scale: 0.9 }}
                  className={`relative w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    index === activeFeature 
                      ? 'bg-slate-800 w-8' 
                      : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label={`Go to ${feature.title}`}
                >
                  {index === activeFeature && (
                    <motion.div
                      layoutId="activeDot"
                      className="absolute inset-0 rounded-full bg-slate-800"
                      transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
                    />
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-20 px-6 bg-white">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-semibold text-primary mb-4">
              Built for Everyone
            </h2>
            <p className="text-xl text-gray-600">
              Whether you need legal help or provide it, we've got you covered
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {useCases.map((useCase, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: idx === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                whileHover={{ y: -10 }}
                className="p-10 bg-gradient-to-br from-gray-50 to-white rounded-3xl shadow-xl border-2 border-gray-100 hover:border-slate-300 transition-all"
              >
                <div className="w-16 h-16 text-slate-700 bg-white rounded-2xl p-3 shadow-lg mb-6">
                  {useCase.icon}
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-6">{useCase.title}</h3>
                <ul className="space-y-4">
                  {useCase.points.map((point, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-3 text-gray-700"
                    >
                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-lg">{point}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-50">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-semibold text-primary mb-4">
              Simple. Fast. Intelligent.
            </h2>
            <p className="text-xl text-gray-600">
              Get started in minutes — no complex setup required
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              { 
                step: '01', 
                title: 'Sign Up Free', 
                desc: 'Create your account in seconds. No credit card required.', 
                icon: (
                  <svg className="w-full h-full " fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                )
              },
              { 
                step: '02', 
                title: 'Choose Your Path', 
                desc: 'Upload documents, fill forms, ask questions, or find lawyers.', 
                icon: (
                  <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                )
              },
              { 
                step: '03', 
                title: 'Get AI-Powered Results', 
                desc: 'Receive instant insights, filled forms, or lawyer connections.', 
                icon: (
                  <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                )
              }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.2 }}
                whileHover={{ scale: 1.05, rotateY: 5 }}
                className="relative p-8 bg-white rounded-3xl shadow-xl border-2 border-transparent hover:border-blue-200 transition-all"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <div className="text-center relative z-10">
                  <motion.div
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 3, repeat: Infinity, delay: idx * 0.3 }}
                    className="w-20 h-20 mx-auto mb-6 bg-slate-800 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-2xl"
                  >
                    {item.step}
                  </motion.div>
                  <div className="w-16 h-16 mx-auto text-slate-700 mb-4">{item.icon}</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{item.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
                
                {/* Connecting line */}
                {idx < 2 && (
                  <div className="hidden md:block absolute top-1/2 right-[-35px] -z-1000 w-12 h-0.5 bg-slate-300" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section id="about" className="py-24 px-6 bg-gradient-to-b from-white via-gray-50 to-white relative overflow-hidden">
        {/* Decorative background text */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 text-[120px] md:text-[180px] font-semibold text-gray-100 opacity-20 select-none pointer-events-none whitespace-nowrap">
          Meet Our Team
        </div>
        
        <div className="container mx-auto max-w-7xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-20"
            style={{ transform: 'none' }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="inline-block mb-4 px-6 py-2 bg-blue-100 text-primary rounded-full text-sm font-semibold"
              style={{ transform: 'none' }}
            >
              Our Innovators
            </motion.div>
            <h2 className="text-5xl md:text-6xl font-semibold text-primary mb-6 leading-tight" style={{ transform: 'none' }}>
              Meet Our Team
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed" style={{ transform: 'none' }}>
              Five passionate innovators building the future of legal technology
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
            {/* First 3 cards */}
            {[
              { 
                name: 'Aniket Aslaliya', 
                role: 'Frontend Developer', 
                gradient: 'from-blue-500 to-cyan-500', 
                initials: 'AA',
                description: 'Creating intuitive and responsive user interfaces with modern web technologies.',
                bgColor: 'bg-blue-100'
              },
              { 
                name: 'Daksh Patel', 
                role: 'Frontend Developer', 
                gradient: 'from-purple-500 to-pink-500', 
                initials: 'DP',
                description: 'Building engaging user experiences and implementing cutting-edge frontend solutions.',
                bgColor: 'bg-purple-100'
              },
              { 
                name: 'Pranav Khunt', 
                role: 'AI/ML Engineer', 
                gradient: 'from-emerald-500 to-teal-500', 
                initials: 'PK',
                description: 'Crafting intelligent systems that understand and process legal documents.',
                bgColor: 'bg-emerald-100'
              }
            ].map((member, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 80, scale: 0.9 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ 
                  duration: 1, 
                  delay: idx * 0.12,
                  ease: [0.16, 1, 0.3, 1]
                }}
                className="relative group"
              >
                <motion.div 
                  whileHover={{ 
                    y: -12,
                    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
                  }}
                  className="relative"
                >
                  <div className="relative p-6 bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200">
                    <div className="relative z-10">
                      {/* Circular Profile Picture */}
                      <motion.div
                        whileHover={{ 
                          scale: 1.1,
                          transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
                        }}
                        className="relative mx-auto mb-4"
                      >
                        <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center text-gray-800 text-2xl font-bold shadow-lg relative overflow-hidden">
                          <span className="relative z-10">{member.initials}</span>
                        </div>
                      </motion.div>
                      
                      {/* Name with Checkmark */}
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <motion.h3 
                          className="text-lg font-bold text-gray-900"
                          whileHover={{ scale: 1.05 }}
                          transition={{ duration: 0.3 }}
                        >
                          {member.name}
                        </motion.h3>
                        {/* Green Checkmark */}
                        <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      
                      {/* Role/Title */}
                      <p className="text-sm text-gray-600 mb-4 text-center">
                        {member.role}
                      </p>
                      
                      {/* Description */}
                      <p className="text-sm text-gray-700 mb-6 text-center leading-relaxed min-h-[60px]">
                        {member.description}
                      </p>
                      
                      {/* Social Media Icons */}
                      <div className="flex justify-center gap-3 pt-4 border-t border-gray-100">
                        <motion.a
                          whileHover={{ scale: 1.2, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          href="#"
                          className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-pink-500 hover:text-white transition-all duration-300"
                          aria-label="Instagram"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                          </svg>
                        </motion.a>
                        <motion.a
                          whileHover={{ scale: 1.2, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          href="#"
                          className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all duration-300"
                          aria-label="Facebook"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                        </motion.a>
                        <motion.a
                          whileHover={{ scale: 1.2, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          href="#"
                          className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all duration-300"
                          aria-label="Pinterest"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0C5.373 0 0 5.372 0 12s5.373 12 12 12 12-5.372 12-12S18.627 0 12 0zm0 19c-.721 0-1.418-.109-2.073-.312.286-.465.713-1.227.876-1.878.067-.271.405-1.799.405-1.799.213.406.836.758 1.498.758 1.971 0 3.307-1.794 3.307-4.188 0-1.832-1.576-3.435-4.001-3.435-2.707 0-4.203 1.989-4.203 3.756 0 .712.273 1.343.717 1.584.08.037.091.052.053.096-.03.045-.098.152-.128.197-.04.062-.136.084-.313.05-1.163-.345-1.891-1.434-1.891-2.888 0-3.667 2.651-6.891 6.933-6.891 3.64 0 6.044 2.508 6.044 5.853 0 3.617-2.271 6.519-5.531 6.519-1.08 0-2.098-.562-2.445-1.263 0 0-.537 2.051-.666 2.551-.241.926-.895 2.085-1.333 2.797.999.307 2.053.472 3.155.472 6.627 0 12-5.372 12-12S18.627 0 12 0z"/>
                          </svg>
                        </motion.a>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ))}
            
            {/* Bottom row - Two centered cards */}
            <div className="lg:col-span-3 flex justify-center gap-6 lg:gap-8 mt-6 lg:mt-8 flex-wrap">
              {[
                { 
                  name: 'Jeet Manseta', 
                  role: 'AI/ML Engineer', 
                  gradient: 'from-orange-500 to-red-500', 
                  initials: 'JM',
                  description: 'Developing advanced AI models and machine learning algorithms for legal applications.',
                  bgColor: 'bg-orange-100'
                },
                { 
                  name: 'Manav Jobanputra', 
                  role: 'Backend Developer', 
                  gradient: 'from-violet-500 to-purple-500', 
                  initials: 'MJ',
                  description: 'Designing robust APIs and database architectures for legal workflows.',
                  bgColor: 'bg-violet-100'
                }
              ].map((member, idx) => (
                <motion.div
                  key={idx + 3}
                  initial={{ opacity: 0, y: 80, scale: 0.9 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, amount: 0.1 }}
                  transition={{ 
                    duration: 1, 
                    delay: (idx + 3) * 0.12,
                    ease: [0.16, 1, 0.3, 1]
                  }}
                  className="relative group w-full max-w-sm md:max-w-xs"
                >
                  <motion.div 
                    whileHover={{ 
                      y: -12,
                      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
                    }}
                    className="relative"
                  >
                    <div className="relative p-6 bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200">
                      <div className="relative z-10">
                        {/* Circular Profile Picture */}
                        <motion.div
                          whileHover={{ 
                            scale: 1.1,
                            transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
                          }}
                          className="relative mx-auto mb-4"
                        >
                          <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center text-gray-800 text-2xl font-bold shadow-lg relative overflow-hidden">
                            <span className="relative z-10">{member.initials}</span>
                          </div>
                        </motion.div>
                        
                        {/* Name with Checkmark */}
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <motion.h3 
                            className="text-lg font-bold text-gray-900"
                            whileHover={{ scale: 1.05 }}
                            transition={{ duration: 0.3 }}
                          >
                            {member.name}
                          </motion.h3>
                          {/* Green Checkmark */}
                          <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        
                        {/* Role/Title */}
                        <p className="text-sm text-gray-600 mb-4 text-center">
                          {member.role}
                        </p>
                        
                        {/* Description */}
                        <p className="text-sm text-gray-700 mb-6 text-center leading-relaxed min-h-[60px]">
                          {member.description}
                        </p>
                        
                        {/* Social Media Icons */}
                        <div className="flex justify-center gap-3 pt-4 border-t border-gray-100">
                          <motion.a
                            whileHover={{ scale: 1.2, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            href="#"
                            className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-pink-500 hover:text-white transition-all duration-300"
                            aria-label="Instagram"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                            </svg>
                          </motion.a>
                          <motion.a
                            whileHover={{ scale: 1.2, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            href="#"
                            className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all duration-300"
                            aria-label="Facebook"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                            </svg>
                          </motion.a>
                          <motion.a
                            whileHover={{ scale: 1.2, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            href="#"
                            className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all duration-300"
                            aria-label="Pinterest"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 0C5.373 0 0 5.372 0 12s5.373 12 12 12 12-5.372 12-12S18.627 0 12 0zm0 19c-.721 0-1.418-.109-2.073-.312.286-.465.713-1.227.876-1.878.067-.271.405-1.799.405-1.799.213.406.836.758 1.498.758 1.971 0 3.307-1.794 3.307-4.188 0-1.832-1.576-3.435-4.001-3.435-2.707 0-4.203 1.989-4.203 3.756 0 .712.273 1.343.717 1.584.08.037.091.052.053.096-.03.045-.098.152-.128.197-.04.062-.136.084-.313.05-1.163-.345-1.891-1.434-1.891-2.888 0-3.667 2.651-6.891 6.933-6.891 3.64 0 6.044 2.508 6.044 5.853 0 3.617-2.271 6.519-5.531 6.519-1.08 0-2.098-.562-2.445-1.263 0 0-.537 2.051-.666 2.551-.241.926-.895 2.085-1.333 2.797.999.307 2.053.472 3.155.472 6.627 0 12-5.372 12-12S18.627 0 12 0z"/>
                            </svg>
                          </motion.a>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact Us Section */}
      <section id="contact" className="py-20 px-6 bg-white">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="text-center"
          >
            <h2 className="text-4xl md:text-5xl font-semibold text-primary mb-6">
              Get in Touch
            </h2>
            <p className="text-xl text-gray-600 mb-12">
              Have questions? We'd love to hear from you.
            </p>
            
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="inline-flex items-center gap-4 px-10 py-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-3xl shadow-xl border-2 border-blue-100"
            >
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm text-gray-600 font-semibold mb-1">Email us at</p>
                <a 
                  href="mailto:legalsahai@gmail.com" 
                  className="text-2xl font-semibold text-primary hover:text-blue-700 transition-colors"
                >
                  legalsahai@gmail.com
                </a>
              </div>
            </motion.div>
            
            <p className="mt-8 text-gray-600">
              We typically respond within 24 hours
            </p>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-slate-900 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 opacity-10">
          <motion.div
            animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
            transition={{ duration: 20, repeat: Infinity }}
            className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"
          />
          <motion.div
            animate={{ scale: [1.2, 1, 1.2], rotate: [90, 0, 90] }}
            transition={{ duration: 25, repeat: Infinity }}
            className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"
          />
        </div>

        <div className="container mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Ready to Transform Your Legal Experience?
            </h2>
            <p className="text-xl md:text-2xl text-gray-300 mb-10 leading-relaxed">
              Join thousands of users who trust Legal SahAI for their legal needs. Start for free today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 20px 40px -10px rgba(255, 255, 255, 0.5)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/login')}
                className="px-12 py-5 bg-white text-slate-900 rounded-2xl text-xl font-bold shadow-2xl hover:shadow-white/50 transition-all"
              >
                Start Using Now — It's Free →
              </motion.button>
            </div>
            
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-gray-900 text-gray-300">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 p-1 flex items-center justify-center">
                    <img src="/logo.png" alt="Legal SahAI" className="w-full h-full object-contain rounded" />
                  </div>
                  <span className="text-xl font-bold text-white">Legal SahAI</span>
                </div>
              <p className="text-sm text-gray-400">
                Your complete AI-powered legal assistance platform
              </p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#about" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          
        </div>
      </footer>
    </div>
  );
};

export default Landing;