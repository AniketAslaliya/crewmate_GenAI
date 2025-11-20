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
          
          <div className="relative z-10">
            {/* Brand Section */}
            <div className="mb-10">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center border border-indigo-400/30">
                  <svg className="w-6 h-6 text-indigo-300" viewBox="0 0 512 512" fill="currentColor">
                    <path d="M504.5,247.522l-63.255-63.255c-4.862-4.862-11.519-7.633-18.435-7.633c-6.916,0-13.573,2.771-18.435,7.633 c-10.172,10.172-10.172,26.698,0,36.87l22.261,22.261H332.8c-5.12-39.822-39.066-70.4-79.644-70.4 c-44.433,0-80.533,36.1-80.533,80.533s36.1,80.533,80.533,80.533c40.578,0,74.524-30.578,79.644-70.4h93.867l-22.261,22.261 c-10.172,10.172-10.172,26.698,0,36.87c5.086,5.086,11.776,7.629,18.466,7.629s13.38-2.543,18.466-7.629l63.255-63.255 C514.672,274.219,514.672,257.693,504.5,247.522z M253.156,280.178c-14.811,0-26.844-12.033-26.844-26.844 s12.033-26.844,26.844-26.844s26.844,12.033,26.844,26.844S267.967,280.178,253.156,280.178z"/>
                    <path d="M253.156,360.178c-54.044,0-98.133-43.255-99.911-96.711H58.311l22.261,22.261c10.172,10.172,10.172,26.698,0,36.87 c-5.086,5.086-11.776,7.629-18.466,7.629s-13.38-2.543-18.466-7.629L7.395,286.353c-10.172-10.172-10.172-26.698,0-36.87 l63.255-63.255c10.172-10.172,26.698-10.172,36.87,0c10.172,10.172,10.172,26.698,0,36.87l-22.261,22.261h94.933 c1.778-53.456,45.867-96.711,99.911-96.711c55.198,0,100.978,44.78,100.978,100.978S308.354,360.178,253.156,360.178z"/>
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-white tracking-tight">Legal Sahai</h1>
                  <p className="text-sm text-indigo-300">Modern Legal Solutions</p>
                </div>
              </div>
              
              <p className="text-indigo-100 text-[15px] leading-relaxed">
                Navigate the legal landscape with confidence. We connect you with expert lawyers and provide intelligent tools to simplify your legal journey.
              </p>
            </div>

            {/* Key Benefits - Clean List */}
            <div className="space-y-3 mb-10">
              <div className="flex items-start space-x-3">
                <div className="w-1 h-1 rounded-full bg-emerald-400 mt-2" />
                <div>
                  <p className="text-white font-medium text-sm">Smart Document Analysis</p>
                  <p className="text-indigo-200 text-xs">AI extracts key info from your legal documents instantly</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-1 h-1 rounded-full bg-blue-400 mt-2" />
                <div>
                  <p className="text-white font-medium text-sm">Connect with Verified Lawyers</p>
                  <p className="text-indigo-200 text-xs">Direct access to experienced legal professionals</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-1 h-1 rounded-full bg-violet-400 mt-2" />
                <div>
                  <p className="text-white font-medium text-sm">Secure & Confidential</p>
                  <p className="text-indigo-200 text-xs">Your documents and conversations are encrypted</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-1 h-1 rounded-full bg-amber-400 mt-2" />
                <div>
                  <p className="text-white font-medium text-sm">24/7 Legal Guidance</p>
                  <p className="text-indigo-200 text-xs">Get instant answers to your legal questions anytime</p>
                </div>
              </div>
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