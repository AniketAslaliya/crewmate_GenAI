import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../Axios/axios';
import { useToast } from '../components/ToastProvider';
import { MdVerifiedUser, MdEmail } from 'react-icons/md';
import useAuthStore from '../context/AuthContext';

const VerifyEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const setToken = useAuthStore((s) => s.setToken);
  
  const { email, name, password, role } = location.state || {};
  
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(60);

  useEffect(() => {
    if (!email || !password) {
      navigate('/login');
      return;
    }

    const countdown = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(countdown);
  }, [email, password, navigate]);

  const handleChange = (index, value) => {
    if (value.length > 1) value = value[0];
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      document.getElementById(`code-${index + 1}`).focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      document.getElementById(`code-${index - 1}`).focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newCode = pastedData.split('');
    while (newCode.length < 6) newCode.push('');
    setCode(newCode);

    if (pastedData.length === 6) {
      document.getElementById('code-5').focus();
    }
  };

  const handleVerify = async () => {
    const verificationCode = code.join('');
    if (verificationCode.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/verify-and-signup', {
        email,
        code: verificationCode,
        password,
        name,
        role,
      });

      toast.success('Email verified successfully! Welcome aboard! 🎉');
      
      // Auto-login: Store token in auth store
      const token = response.data.token;
      if (token) {
        setToken(token);
        
        // Redirect based on role
        setTimeout(() => {
          if (role === 'lawyer') {
            // Redirect lawyers to onboarding page
            window.location.href = '/lawyer-onboard';
          } else {
            // Redirect help seekers to home
            window.location.href = '/home';
          }
        }, 800);
      }
    } catch (err) {
      console.error(err);
      if (err?.response?.data?.errors) {
        const errors = err.response.data.errors;
        toast.error(errors.code || errors.email || 'Verification failed');
      } else {
        toast.error(err?.response?.data?.error || 'Verification failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await api.post('/auth/send-verification-code', { email, name });
      toast.success('Verification code resent!');
      setTimer(60);
      setCode(['', '', '', '', '', '']);
    } catch (err) {
      toast.error('Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white text-center">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <MdVerifiedUser className="text-5xl" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Verify Your Email</h1>
            <p className="text-blue-100">We've sent a code to your email</p>
          </div>

          {/* Content */}
          <div className="p-8">
            <div className="flex items-center justify-center gap-2 mb-6 p-4 bg-blue-50 rounded-lg">
              <MdEmail className="text-blue-600 text-xl" />
              <span className="text-sm text-gray-700">{email}</span>
            </div>

            <p className="text-center text-gray-600 mb-6">
              Enter the 6-digit verification code sent to your email
            </p>

            {/* Code Input */}
            <div className="flex gap-2 justify-center mb-6">
              {code.map((digit, index) => (
                <input
                  key={index}
                  id={`code-${index}`}
                  type="text"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                />
              ))}
            </div>

            {/* Verify Button */}
            <button
              onClick={handleVerify}
              disabled={loading || code.join('').length !== 6}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
            >
              {loading ? 'Verifying & Signing In...' : 'Verify & Continue'}
            </button>

            {/* Resend Code */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600 mb-2">
                Didn't receive the code?
              </p>
              {timer > 0 ? (
                <p className="text-sm text-gray-500">
                  Resend code in <span className="font-semibold text-blue-600">{timer}s</span>
                </p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="text-sm text-blue-600 hover:text-blue-800 font-semibold disabled:opacity-50"
                >
                  {resending ? 'Sending...' : 'Resend Code'}
                </button>
              )}
            </div>

            {/* Back to Login */}
            <div className="mt-6 text-center">
              <button
                onClick={() => navigate('/login')}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                ← Back to Login
              </button>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-white/80 backdrop-blur-sm rounded-lg p-4 text-center shadow-md">
          <p className="text-xs text-gray-600">
            🔒 Code expires in 10 minutes. Keep this page open.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
