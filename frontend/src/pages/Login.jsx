import { motion } from "framer-motion";

const backendUrl = process.env.REACT_APP_BACKEND_URL;

const Login = () => {
  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen bg-black overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-cyan-900 via-blue-900 to-gray-900 animate-pulse-slow" />
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.1) 2px, transparent 2px), radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* Particle Animation */}
      <div className="absolute inset-0 -z-10">
        {[...Array(50)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-cyan-500 opacity-70"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, Math.random() * 20 - 10, 0],
              x: [0, Math.random() * 20 - 10, 0],
              opacity: [0.7, 0.9, 0.7],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center"
      >
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-100">
          <span className="text-gray-100">Legal Sah</span>
          <span className="bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
            AI
          </span>
        </h1>
        <p className="mt-4 text-lg text-gray-400 max-w-xl mx-auto">
          Your AI-powered legal assistant, making legal aid accessible and life easier for everyone.
        </p>
      </motion.div>

      {/* Animated Call-to-Action */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="mt-8"
      >
        <a
          href={`${backendUrl}/auth/google`}
          className="relative inline-flex items-center justify-center px-6 py-3 text-lg font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full shadow-lg hover:opacity-90 transition-all duration-300"
        >
          <motion.span
            className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 opacity-50 blur-lg"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="relative z-10">Continue with Google</span>
        </a>
      </motion.div>

      {/* Features Section */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5 }}
        className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto px-4"
      >
        <div className="flex flex-col items-center text-center">
          <div className="text-4xl text-cyan-400">📄</div>
          <h3 className="mt-4 text-xl font-semibold text-gray-100">Document Analysis</h3>
          <p className="mt-2 text-gray-400">
            Upload legal documents and get instant AI-powered summaries and insights.
          </p>
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="text-4xl text-cyan-400">🤔</div>
          <h3 className="mt-4 text-xl font-semibold text-gray-100">Suggested Questions</h3>
          <p className="mt-2 text-gray-400">
            Get tailored questions to help you understand legal documents better.
          </p>
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="text-4xl text-cyan-400">⏳</div>
          <h3 className="mt-4 text-xl font-semibold text-gray-100">Timeline Assistance</h3>
          <p className="mt-2 text-gray-400">
            Visualize legal timelines and deadlines with ease.
          </p>
        </div>
      </motion.div>

      {/* Footer */}
      <footer className="absolute bottom-4 text-center text-gray-500 text-sm">
        © {new Date().getFullYear()} Legal SahAI. All rights reserved.
      </footer>
    </main>
  );
};

export default Login;