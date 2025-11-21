import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../context/AuthContext';

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeFeature, setActiveFeature] = useState(0);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Redirect to home if user is already logged in
    if (user) {
      navigate('/home');
    }
  }, [user, navigate]);

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setActiveFeature(prev => (prev + 1) % 6);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
      title: 'Legal Desks',
      description: 'Create dedicated workspaces for each case. Upload documents, ask questions, and get AI-powered insights directly from your case files.',
      details: ['Multi-document support', 'Context-aware AI analysis', 'RAG-based retrieval', 'Secure document storage'],
      color: 'from-slate-600 to-slate-800',
      bgGradient: 'from-slate-50 to-gray-50',
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
      color: 'from-blue-600 to-blue-800',
      bgGradient: 'from-blue-50 to-sky-50',
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
      color: 'from-emerald-600 to-teal-700',
      bgGradient: 'from-emerald-50 to-teal-50',
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
      color: 'from-amber-600 to-orange-700',
      bgGradient: 'from-amber-50 to-orange-50',
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
      color: 'from-violet-600 to-purple-700',
      bgGradient: 'from-violet-50 to-purple-50',
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
      color: 'from-cyan-600 to-blue-700',
      bgGradient: 'from-cyan-50 to-blue-50',
      demo: 'Fill forms, ask questions, and get responses in your preferred language with full voice support'
    }
  ];

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
        transition={{ duration: 0.6 }}
        className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm"
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <motion.div
              className="flex items-center gap-3"
              whileHover={{ scale: 1.05 }}
            >
              <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">L</span>
              </div>
              <span className="text-2xl font-bold text-slate-800">
                Legal SahAI
              </span>
            </motion.div>
            <div className="flex items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/login')}
                className="px-6 py-2.5 text-gray-700 font-medium hover:text-blue-600 transition-colors"
              >
                Sign In
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.5)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/login')}
                className="px-6 py-2.5 bg-slate-800 text-white rounded-xl font-semibold shadow-lg hover:bg-slate-900 transition-colors"
              >
                Get Started Free
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
                onClick={() => navigate('/login')}
                className="px-10 py-4 bg-slate-800 text-white rounded-2xl text-lg font-bold shadow-2xl hover:bg-slate-900 transition-all"
              >
                Start Using Free →
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

      {/* Interactive Features Showcase */}
      <section id="features" className="py-20 px-6 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto">
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

          {/* Feature Cards with Hover Effects */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ 
                  duration: 0.9, 
                  delay: index * 0.2,
                  ease: [0.16, 1, 0.3, 1]
                }}
                whileHover={{ 
                  y: -12, 
                  scale: 1.03,
                  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
                }}
                onHoverStart={() => setHoveredCard(index)}
                onHoverEnd={() => setHoveredCard(null)}
                className={`relative p-8 rounded-3xl bg-gradient-to-br ${feature.bgGradient} border-2 border-transparent hover:border-white shadow-xl hover:shadow-2xl transition-all duration-700 overflow-hidden group cursor-pointer`}
                onClick={() => setActiveFeature(index)}
              >
                {/* Animated background gradient on hover */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: hoveredCard === index ? 0.1 : 0 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className={`absolute inset-0 bg-gradient-to-br ${feature.color}`}
                />
                
                <div className="relative z-10">
                  <motion.div
                    animate={hoveredCard === index ? { 
                      scale: [1, 1.15, 1],
                      rotate: [0, 8, 0]
                    } : {}}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className={`w-16 h-16 mb-6 text-slate-700 bg-white rounded-xl p-3 shadow-lg`}
                  >
                    {feature.icon}
                  </motion.div>
                  
                  <motion.h3 
                    className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors duration-500"
                    animate={hoveredCard === index ? { x: [0, 8, 0] } : {}}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {feature.title}
                  </motion.h3>
                  
                  <p className="text-gray-700 mb-6 leading-relaxed">
                    {feature.description}
                  </p>
                  
                  <div className="space-y-2 mb-6">
                    {feature.details.map((detail, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ 
                          delay: idx * 0.15,
                          duration: 0.7,
                          ease: [0.16, 1, 0.3, 1]
                        }}
                        className="flex items-center gap-2 text-sm text-gray-600"
                      >
                        <motion.div 
                          className={`w-2 h-2 rounded-full bg-gradient-to-r ${feature.color}`}
                          animate={hoveredCard === index ? { scale: [1, 1.5, 1] } : {}}
                          transition={{ 
                            duration: 0.7,
                            delay: idx * 0.08,
                            ease: [0.16, 1, 0.3, 1]
                          }}
                        />
                        {detail}
                      </motion.div>
                    ))}
                  </div>

                  {/* Demo text on hover */}
                  <AnimatePresence>
                    {hoveredCard === index && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-sm text-gray-600 bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-gray-200"
                      >
                        <span className="font-semibold text-blue-600">Try it: </span>
                        {feature.demo}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Feature Showcase Carousel */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-6xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200"
          >
            <div className="grid md:grid-cols-2">
              {/* Feature Preview */}
              <div className={`p-12 bg-gradient-to-br ${features[activeFeature].bgGradient} flex flex-col justify-center`}>
                <motion.div
                  key={activeFeature}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-24 h-24 mb-6 text-slate-700 bg-white rounded-2xl p-5 shadow-xl"
                >
                  {features[activeFeature].icon}
                </motion.div>
                <h3 className="text-3xl font-bold text-gray-900 mb-4">
                  {features[activeFeature].title}
                </h3>
                <p className="text-lg text-gray-700 leading-relaxed">
                  {features[activeFeature].demo}
                </p>
              </div>

              {/* Feature Selector */}
              <div className="p-8 bg-gray-50">
                <h4 className="text-xl font-bold text-gray-900 mb-6">Select Feature to Preview</h4>
                <div className="space-y-3">
                  {features.map((feature, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ x: 5 }}
                      onClick={() => setActiveFeature(idx)}
                      className={`w-full text-left p-4 rounded-xl transition-all ${
                        activeFeature === idx
                          ? `bg-slate-800 text-white shadow-lg`
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 ${activeFeature === idx ? 'text-white' : 'text-slate-700'}`}>
                          {feature.icon}
                        </div>
                        <span className="font-semibold">{feature.title}</span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
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

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-8">
            {[
              { name: 'Aniket Aslaliya', role: 'Full Stack Developer', gradient: 'from-blue-500 to-cyan-500', initials: 'AA' },
              { name: 'Daksh Patel', role: 'AI/ML Engineer', gradient: 'from-purple-500 to-pink-500', initials: 'DP' },
              { name: 'Pranav Khunt', role: 'Backend Developer', gradient: 'from-emerald-500 to-teal-500', initials: 'PK' },
              { name: 'Jeet Manseta', role: 'Frontend Developer', gradient: 'from-orange-500 to-red-500', initials: 'JM' },
              { name: 'Manav Jobanputra', role: 'DevOps Engineer', gradient: 'from-violet-500 to-purple-500', initials: 'MJ' }
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
                    y: -20,
                    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
                  }}
                  className="relative"
                >
                  <div className="relative p-8 bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-700 overflow-hidden border border-gray-100 hover:border-gray-200">
                    {/* Gradient background - always visible but subtle */}
                    <motion.div
                      initial={{ opacity: 0.05 }}
                      whileHover={{ opacity: 0.12 }}
                      transition={{ duration: 0.6 }}
                      className={`absolute inset-0 bg-gradient-to-br ${member.gradient}`}
                    />
                    
                    {/* Animated glow effect on hover */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileHover={{ opacity: 0.3, scale: 1.2 }}
                      transition={{ duration: 0.8 }}
                      className={`absolute inset-0 bg-gradient-to-br ${member.gradient} blur-2xl`}
                    />
                    
                    <div className="relative z-10 text-center">
                      {/* Avatar with enhanced design */}
                      <motion.div
                        whileHover={{ 
                          scale: 1.15, 
                          rotate: 8,
                          transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
                        }}
                        className="relative mx-auto mb-6"
                      >
                        <div className={`w-28 h-28 mx-auto bg-gradient-to-br ${member.gradient} rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-xl relative overflow-hidden`}>
                          {/* Shimmer effect */}
                          <motion.div
                            animate={{ 
                              x: ['-100%', '100%'],
                            }}
                            transition={{ 
                              duration: 2,
                              repeat: Infinity,
                              repeatDelay: 3,
                              ease: "easeInOut"
                            }}
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                          />
                          <span className="relative z-10">{member.initials}</span>
                        </div>
                      </motion.div>
                      
                      <motion.h3 
                        className="text-xl font-bold text-gray-900 mb-2"
                        whileHover={{ scale: 1.05 }}
                        transition={{ duration: 0.3 }}
                      >
                        {member.name}
                      </motion.h3>
                      
                     
                      
                      {/* Social Links with enhanced styling */}
                      <div className="flex justify-center gap-3">
                        <motion.a
                          whileHover={{ scale: 1.25, y: -4 }}
                          whileTap={{ scale: 0.95 }}
                          transition={{ duration: 0.3 }}
                          href="#"
                          className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all duration-300 shadow-sm hover:shadow-md"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                          </svg>
                        </motion.a>
                        <motion.a
                          whileHover={{ scale: 1.25, y: -4 }}
                          whileTap={{ scale: 0.95 }}
                          transition={{ duration: 0.3 }}
                          href="#"
                          className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-900 hover:text-white transition-all duration-300 shadow-sm hover:shadow-md"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
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
                <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">L</span>
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
          <div className="pt-8 border-t border-gray-800 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} Legal SahAI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
