import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../context/AuthContext';
import api from '../Axios/axios';
import { useToast } from '../components/ToastProvider';
import { motion, AnimatePresence } from 'framer-motion';

const RoleCard = ({ role, title, description, selected, onClick, icon }) => (
  <motion.div
    onClick={() => onClick(role)}
    className={`cursor-pointer p-6 rounded-2xl border-2 transition-all duration-200 ${
      selected 
        ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg scale-[1.02]' 
        : 'border-gray-200 bg-white hover:border-gray-300'
    }`}
    whileHover={{ y: -2 }}
    whileTap={{ scale: 0.98 }}
    style={{ minWidth: 240 }}
  >
    <div className="flex items-start space-x-3">
      <div className={`p-2 rounded-xl ${
        selected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
      }`}>
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-bold mb-2 text-gray-800">{title}</h3>
        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
      </div>
    </div>
    
    {selected && (
      <motion.div 
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="absolute top-3 right-3 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center"
      >
        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </motion.div>
    )}
  </motion.div>
);

const CompleteRegistration = () => {
  const authUser = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState(null);
  const [name, setName] = useState(authUser?.name || '');
  const [email] = useState(authUser?.email || authUser?.username || '');
  const [loading, setLoading] = useState(false);

  const benefits = {
    helpseeker: [
      'Ask legal questions with AI summaries',
      'Secure document uploads',
      'Connect with vetted lawyers',
    ],
    lawyer: [
      'Receive client requests',
      'Showcase expertise',
      'Access professional tools',
    ],
  };

  const handleRolePick = (role) => {
    setSelectedRole(role);
    setStep(2);
  };

  const handleContinueToForm = () => {
    setStep(3);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRole) { 
      toast.error('Please choose a role'); 
      return; 
    }
    if (!name.trim()) {
      toast.error('Please enter your full name');
      return;
    }
    setLoading(true);
    try {
      await api.post(
        '/auth/set-role',
        { role: selectedRole, name: name.trim(), email },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const me = await api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      const updatedUser = me.data.user || me.data;
      setUser(updatedUser);
      
      toast.success('Profile created successfully!');
      
      // If user selected lawyer role, redirect to onboard-lawyer page
      if (selectedRole === 'lawyer') {
        navigate('/onboard-lawyer');
      } else {
        navigate('/home');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to complete registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { number: 1, title: 'Role' },
    { number: 2, title: 'Benefits' },
    { number: 3, title: 'Profile' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden"
      >
        {/* Compact Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold">Complete Your Profile</h1>
            <p className="text-blue-100 text-sm mt-1">Tailor your experience in 3 steps</p>
          </div>
          
          {/* Compact Progress */}
          <div className="flex justify-center space-x-6">
            {steps.map((stepItem, index) => (
              <div key={stepItem.number} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm ${
                  step >= stepItem.number 
                    ? 'bg-white text-blue-600' 
                    : 'bg-blue-500/50 text-white'
                } font-semibold`}>
                  {stepItem.number}
                </div>
                <span className="ml-2 text-xs font-medium">{stepItem.title}</span>
                {index < steps.length - 1 && (
                  <div className={`w-8 h-0.5 mx-2 ${
                    step > stepItem.number ? 'bg-white' : 'bg-blue-400/50'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Compact Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="text-lg font-bold text-gray-800 mb-2">How will you use Legal SahAI?</h2>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <RoleCard
                    role="helpseeker"
                    title="Help Seeker"
                    description="Need legal guidance or document review"
                    selected={selectedRole === 'helpseeker'}
                    onClick={handleRolePick}
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                  />
                  
                  <RoleCard
                    role="lawyer"
                    title="Legal Professional"
                    description="Provide legal services and consultation"
                    selected={selectedRole === 'lawyer'}
                    onClick={handleRolePick}
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    }
                  />
                </div>
              </motion.div>
            )}

            {step === 2 && selectedRole && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="text-lg font-bold text-gray-800 mb-2">
                    {selectedRole === 'lawyer' ? 'Legal Professional' : 'Help Seeker'} Benefits
                  </h2>
                </div>

                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="space-y-3">
                    {benefits[selectedRole].map((benefit, index) => (
                      <motion.div 
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start space-x-3 p-3 bg-white rounded-lg"
                      >
                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-700 font-medium">{benefit}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-center space-x-3 pt-2">
                  <button 
                    onClick={() => setStep(1)}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:border-gray-400 transition-colors text-sm"
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleContinueToForm}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
                  >
                    Continue
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.form
                key="step3"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                <div className="text-center mb-2">
                  <h2 className="text-lg font-bold text-gray-800">Complete Your Profile</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input 
                      value={email} 
                      readOnly 
                      disabled 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed text-sm"
                    />
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          selectedRole === 'lawyer' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                        }`}>
                          {selectedRole === 'lawyer' ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-800 capitalize">{selectedRole}</div>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setStep(1)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4">
                  <button 
                    type="button" 
                    onClick={() => setStep(2)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:border-gray-400 transition-colors text-sm"
                  >
                    Back
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading || !name.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center space-x-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <span>Complete</span>
                    )}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default CompleteRegistration;