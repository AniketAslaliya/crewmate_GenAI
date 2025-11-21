import { motion, AnimatePresence } from "framer-motion";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../Axios/axios';
import useAuthStore from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';

const backendUrl = process.env.REACT_APP_BACKEND_URL;

const Login = () => {
  const navigate = useNavigate();
  const setToken = useAuthStore(s => s.setToken);
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState(null);
  const [signupStep, setSignupStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const toast = useToast();

  const handleGuestLogin = async () => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/guest-login');
      if (res.data?.token) {
        setToken(res.data.token);
        toast.success('Welcome! Exploring as Guest');
        window.location.href = '/home';
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to start guest mode');
    } finally {
      setIsLoading(false);
    }
  };

  const submit = async () => {
    // Clear previous errors
    setFieldErrors({});

    // Client-side validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordRegex = /(?=.*[A-Za-z])(?=.*\d)/;
    const errors = {};

    if (mode === 'signup' && (!name || !name.trim())) errors.name = 'Name is required';
    if (!email || !email.trim()) errors.email = 'Email is required';
    else if (!emailRegex.test(email)) errors.email = 'Invalid email format';
    if (!password) errors.password = 'Password is required';
    else if (mode === 'signup') {
      if (password.length < 8) errors.password = 'Password must be at least 8 characters';
      else if (!passwordRegex.test(password)) errors.password = 'Password must contain letters and numbers';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    try {
      let res;
      if (mode === 'signup') {
        // Send verification code first
        await api.post('/auth/send-verification-code', { email, name });
        toast.success('Verification code sent to your email!');
        
        // Navigate to verification page with signup data
        navigate('/verify-email', { 
          state: { email, name, password, role } 
        });
      } else {
        res = await api.post('/auth/login', { email, password });
        if (res.data?.token) setToken(res.data.token);
        const token = res.data?.token || useAuthStore.getState().token;
        if (token) {
          // Fetch user profile to check role and verification status
          const userRes = await api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
          const user = userRes.data?.user;
          
          // Check if user is a lawyer who needs onboarding
          if (user?.role === 'lawyer') {
            // Check if lawyer profile is incomplete or not verified
            if (!user.isVerified || !user.specialization || user.specialization.length === 0) {
              // Redirect to lawyer onboarding
              window.location.href = '/lawyer-onboard';
              return;
            }
          }
          
          // Default redirect to home
          window.location.href = '/home';
        }
      }
    } catch (e) {
      console.error(e);
      const resp = e?.response?.data;
      if (resp?.errors && typeof resp.errors === 'object') {
        // Map backend validation errors to fields
        setFieldErrors(resp.errors);
      } else if (resp?.error) {
        toast.error(resp.error);
      } else {
        toast.error(mode === 'signup' ? 'Failed to send verification code' : 'Authentication failed. Please check your credentials.');
      }
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 relative overflow-hidden">
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
        {/* Left Panel - Brand & Value Proposition */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="p-10 lg:p-12 flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-800 to-blue-900"
        >
          {/* Subtle Grid Background */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }} />
          
          <div className="relative z-10 flex flex-col justify-center h-full">
            {/* Brand Section */}
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Legal AI Support</h1>
              <p className="text-indigo-200 text-sm">Intelligent Legal Assistance Platform</p>
            </div>

            {/* Legal AI Illustration */}
            <div className="flex items-center justify-center mb-8">
              <svg className="w-full max-w-md" viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Document/Contract */}
                <g opacity="0.9">
                  {/* Main document */}
                  <rect x="80" y="40" width="240" height="180" rx="8" fill="white" stroke="#6366F1" strokeWidth="2"/>
                  
                  {/* Document header */}
                  <rect x="95" y="55" width="80" height="8" rx="4" fill="#818CF8"/>
                  <rect x="95" y="70" width="120" height="6" rx="3" fill="#C7D2FE"/>
                  
                  {/* Document lines */}
                  <rect x="95" y="90" width="210" height="4" rx="2" fill="#E0E7FF"/>
                  <rect x="95" y="100" width="190" height="4" rx="2" fill="#E0E7FF"/>
                  <rect x="95" y="110" width="200" height="4" rx="2" fill="#E0E7FF"/>
                  <rect x="95" y="120" width="180" height="4" rx="2" fill="#E0E7FF"/>
                  
                  <rect x="95" y="135" width="210" height="4" rx="2" fill="#E0E7FF"/>
                  <rect x="95" y="145" width="195" height="4" rx="2" fill="#E0E7FF"/>
                  <rect x="95" y="155" width="185" height="4" rx="2" fill="#E0E7FF"/>
                  
                  {/* Signature area */}
                  <path d="M 95 175 Q 115 170, 135 175" stroke="#818CF8" strokeWidth="2" fill="none"/>
                  <rect x="95" y="185" width="60" height="2" fill="#C7D2FE"/>
                </g>
                
                {/* Shield/Security Icon */}
                <g opacity="0.95">
                  <path d="M 200 100 L 220 90 L 240 100 L 240 130 Q 240 145, 220 155 Q 200 145, 200 130 Z" 
                        fill="#4F46E5" stroke="#312E81" strokeWidth="2"/>
                  <path d="M 215 110 L 220 120 L 230 105" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none"/>
                </g>
                
                {/* AI Brain Icon */}
                <g opacity="0.9">
                  <circle cx="140" cy="160" r="25" fill="#6366F1" stroke="#312E81" strokeWidth="2"/>
                  {/* Neural network lines */}
                  <circle cx="130" cy="150" r="3" fill="white"/>
                  <circle cx="140" cy="155" r="3" fill="white"/>
                  <circle cx="150" cy="150" r="3" fill="white"/>
                  <circle cx="135" cy="165" r="3" fill="white"/>
                  <circle cx="145" cy="165" r="3" fill="white"/>
                  <line x1="130" y1="150" x2="140" y2="155" stroke="white" strokeWidth="1"/>
                  <line x1="150" y1="150" x2="140" y2="155" stroke="white" strokeWidth="1"/>
                  <line x1="140" y1="155" x2="135" y2="165" stroke="white" strokeWidth="1"/>
                  <line x1="140" y1="155" x2="145" y2="165" stroke="white" strokeWidth="1"/>
                </g>
                
                {/* Chat/Support Icon */}
                <g opacity="0.9">
                  <rect x="260" y="140" width="50" height="40" rx="8" fill="#8B5CF6" stroke="#5B21B6" strokeWidth="2"/>
                  <rect x="267" y="150" width="15" height="3" rx="1.5" fill="white"/>
                  <rect x="267" y="157" width="25" height="3" rx="1.5" fill="white"/>
                  <rect x="267" y="164" width="20" height="3" rx="1.5" fill="white"/>
                  <path d="M 285 180 L 290 190 L 295 180" fill="#8B5CF6"/>
                </g>
                
                {/* Decorative circles */}
                <circle cx="70" cy="60" r="6" fill="#818CF8" opacity="0.3"/>
                <circle cx="330" cy="70" r="8" fill="#A5B4FC" opacity="0.3"/>
                <circle cx="60" cy="200" r="5" fill="#C7D2FE" opacity="0.3"/>
                <circle cx="340" cy="210" r="7" fill="#818CF8" opacity="0.3"/>
                
                {/* Connection lines */}
                <line x1="165" y1="160" x2="195" y2="120" stroke="#818CF8" strokeWidth="2" strokeDasharray="4,4" opacity="0.5"/>
                <line x1="245" y1="120" x2="260" y2="160" stroke="#A5B4FC" strokeWidth="2" strokeDasharray="4,4" opacity="0.5"/>
              </svg>
            </div>

            {/* Key Message */}
            <div className="text-center px-4">
              <p className="text-indigo-100 text-base leading-relaxed">
                AI-powered legal assistance with secure document analysis and expert lawyer connections
              </p>
            </div>
          </div>

          {/* Mode Toggle */}
          <motion.div 
            className="relative z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <div className="bg-indigo-800/30 rounded-2xl p-2 backdrop-blur-sm border border-indigo-400/20 inline-flex">
              <button
                onClick={() => setMode('login')}
                className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                  mode === 'login' 
                    ? 'bg-white text-indigo-600 shadow-lg' 
                    : 'text-white hover:bg-indigo-700/30'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setMode('signup')}
                className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                  mode === 'signup' 
                    ? 'bg-white text-indigo-600 shadow-lg' 
                    : 'text-white hover:bg-indigo-700/30'
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
                        {fieldErrors.name && (
                          <p className="text-sm text-red-600 mt-1">{fieldErrors.name}</p>
                        )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                      <input
                        placeholder="Enter your email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                      {fieldErrors.email && (
                        <p className="text-sm text-red-600 mt-1">{fieldErrors.email}</p>
                      )}
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
                      {fieldErrors.password && (
                        <p className="text-sm text-red-600 mt-1">{fieldErrors.password}</p>
                      )}
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
                      {fieldErrors.email && (
                        <p className="text-sm text-red-600 mt-1">{fieldErrors.email}</p>
                      )}
                  </div>
                  <div >
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-semibold text-gray-700">Password</label>
                      
                    </div>
                    <div className="relative">
                      <input
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      type="password"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                      {fieldErrors.password && (
                        <p className="text-sm text-red-600 mt-1">{fieldErrors.password}</p>
                      )}
                       <button
                        type="button"
                        onClick={() => navigate('/forgot-password')}
                        className="right-0 top-14 absolute text-[12px] text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    
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
                  onClick={() => {
                    try {
                      // Persist selected role so we can apply it after OAuth redirect if backend doesn't
                      if (mode === 'signup' && role) {
                        localStorage.setItem('pre_oauth_role', role);
                      }
                    } catch (e) {
                      // ignore storage errors
                    }
                  }}
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

              {/* Guest Login */}
              {mode === 'login' && (
                <div className="text-center pt-4">
                  <button
                    onClick={handleGuestLogin}
                    disabled={isLoading}
                    className="text-sm underline text-blue-600 hover:text-gray-800  transition-colors disabled:opacity-50"
                  >
                     Continue as Guest (Explore without signup)
                  </button>

                </div>
              )}

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