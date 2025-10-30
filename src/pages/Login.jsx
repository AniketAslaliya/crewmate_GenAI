import { motion, AnimatePresence } from "framer-motion";
import { useState } from 'react';
import api from '../Axios/axios';
import useAuthStore from '../context/AuthContext';

const backendUrl = process.env.REACT_APP_BACKEND_URL;

const Login = () => {
  const setToken = useAuthStore(s => s.setToken);
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState(null);
  const [signupStep, setSignupStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const submit = async () => {
    setIsLoading(true);
    try {
      let res;
      if (mode === 'signup') {
        res = await api.post('/auth/signup', { email, password, name, role });
        if (res.data?.token) setToken(res.data.token);
      } else {
        res = await api.post('/auth/login', { email, password });
        if (res.data?.token) setToken(res.data.token);
      }
      const token = res.data?.token || useAuthStore.getState().token;
      if (token) {
        await api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        window.location.href = '/home';
      }
    } catch (e) {
      console.error(e);
      alert('Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const RoleCard = ({ title, description, icon, selected, onClick}) => (
    <motion.div
      onClick={onClick}
      className={`cursor-pointer p-6 rounded-2xl border-2 transition-all duration-300 ${
        selected 
          ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/20' 
          : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
      }`}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start space-x-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
          selected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
        }`}>
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-lg text-gray-900">{title}</h3>
          <p className="text-gray-600 text-sm mt-1">{description}</p>
      
        </div>
        {selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center"
          >
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
        )}
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-20"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 100, 0],
            y: [0, -50, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute top-3/4 right-1/4 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-20"
          animate={{
            scale: [1.2, 1, 1.2],
            x: [0, -100, 0],
            y: [0, 50, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-1/4 left-1/2 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-20"
          animate={{
            scale: [1, 1.3, 1],
            x: [0, 150, 0],
            y: [0, 25, 0],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      <div className="max-w-6xl w-full bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2 border border-white/20 relative z-10">
        {/* Left Panel - Brand & Welcome */}
        <motion.div
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="p-12 flex flex-col justify-between relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #3730a3 50%, #5b21b6 100%)'
          }}
        >
          <div className="absolute inset-0 bg-black/10" />
          
          {/* Brand Header */}
          <div className="relative z-10">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 100 }}
              className="flex items-center space-x-3 mb-8"
            >
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white font-serif">Legal Sahai</h1>
                <p className="text-blue-100 text-sm">Your Trusted Legal Companion</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-4"
            >
              <div className="flex items-center space-x-3 p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <div className="text-white font-semibold">AI-Powered Legal Assistance</div>
                  <div className="text-blue-100 text-sm">Smart document analysis</div>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <div className="text-white font-semibold">Bank-Grade Security</div>
                  <div className="text-blue-100 text-sm">Your data is always protected</div>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-white font-semibold">Expert Network</div>
                  <div className="text-blue-100 text-sm">Connect with legal professionals</div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Mode Toggle */}
          <motion.div 
            className="relative z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <div className="bg-white/10 rounded-2xl p-2 backdrop-blur-sm border border-white/10 inline-flex">
              <button
                onClick={() => setMode('login')}
                className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                  mode === 'login' 
                    ? 'bg-white text-blue-600 shadow-lg' 
                    : 'text-white hover:bg-white/10'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setMode('signup')}
                className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                  mode === 'signup' 
                    ? 'bg-white text-blue-600 shadow-lg' 
                    : 'text-white hover:bg-white/10'
                }`}
              >
                Sign Up
              </button>
            </div>
          </motion.div>
        </motion.div>

        {/* Right Panel - Form */}
        <motion.div
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="p-12 flex flex-col justify-center"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`${mode}-${signupStep}`}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2 font-serif">
                  {mode === 'signup' 
                    ? (signupStep === 1 ? 'Join Legal Sahai' : 'Create Your Account')
                    : 'Welcome Back to Legal Sahai'
                  }
                </h2>
                <p className="text-gray-600">
                  {mode === 'signup' 
                    ? (signupStep === 1 ? 'Choose how you want to use our platform' : 'Complete your profile to get started')
                    : 'Sign in to access your legal dashboard'
                  }
                </p>
              </div>

              {/* Role Selection Step */}
              {mode === 'signup' && signupStep === 1 && (
                <div className="space-y-4">
                  <RoleCard
                    title="Help Seeker"
                    description="I need legal assistance or advice"
                    icon="⚖️"
                    selected={role === 'helpseeker'}
                    onClick={() => { setRole('helpseeker'); setSignupStep(3); }}
                    
                  />
                  <RoleCard
                    title="Legal Professional"
                    description="I provide legal services"
                    icon="👨‍⚖️"
                    selected={role === 'lawyer'}
                    onClick={() => { setRole('lawyer'); setSignupStep(3); }}
                    
                  />
                </div>
              )}

              {/* Registration Form */}
              {mode === 'signup' && signupStep === 3 && (
                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-blue-50 rounded-2xl border border-blue-200"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">{role === 'helpseeker' ? '⚖️' : '👨‍⚖️'}</span>
                      </div>
                      <div>
                        <div className="font-semibold text-blue-900">Registering as {role === 'helpseeker' ? 'Help Seeker' : 'Legal Professional'}</div>
                        {/* <div className="text-blue-700 text-sm">You can change this later in settings</div> */}
                      </div>
                    </div>
                  </motion.div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                      <input
                        placeholder="Enter your full name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                      <input
                        placeholder="Enter your email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                      <input
                        placeholder="Create a secure password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        type="password"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setSignupStep(1)}
                      className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all duration-200"
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}

              {/* Login Form */}
              {mode === 'login' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                    <input
                      placeholder="Enter your email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                    <input
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      type="password"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                 
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-4 pt-4">
                <motion.button
                  onClick={submit}
                  disabled={(mode === 'signup' && !role) || isLoading}
                  className={`w-full py-4 rounded-xl font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-300 ${
                    (mode === 'signup' && !role) || isLoading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                  }`}
                  whileHover={!(mode === 'signup' && !role) && !isLoading ? { scale: 1.02 } : {}}
                  whileTap={!(mode === 'signup' && !role) && !isLoading ? { scale: 0.98 } : {}}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                      />
                      <span>Processing...</span>
                    </div>
                  ) : (
                    mode === 'signup' ? 'Create Account' : 'Sign In to Legal Sahai'
                  )}
                </motion.button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Or continue with</span>
                  </div>
                </div>

                <motion.a
                  href={mode === 'signup' && role ? `${backendUrl}/auth/google?role=${encodeURIComponent(role)}` : `${backendUrl}/auth/google`}
                  className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-200"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </motion.a>
              </div>

              {/* Footer Links */}
              <div className="text-center pt-6 border-t border-gray-100">
                <p className="text-gray-600 text-sm">
                  {mode === 'signup' 
                    ? 'Already have an account? ' 
                    : "Don't have an account? "
                  }
                  <button
                    onClick={() => {
                      setMode(mode === 'signup' ? 'login' : 'signup');
                      setSignupStep(1);
                      setRole(null);
                    }}
                    className="text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                  >
                    {mode === 'signup' ? 'Sign In' : 'Sign Up'}
                  </button>
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;