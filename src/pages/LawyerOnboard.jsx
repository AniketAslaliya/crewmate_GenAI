import React, { useState, useEffect } from 'react';
import api from '../Axios/axios';
import useAuthStore from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ToastProvider';

const LawyerOnboard = () => {
  const authUser = useAuthStore(s=>s.user);
  const navigate = useNavigate();
  const toast = useToast();

  // Check freeze period for rejected lawyers
  const [canReapply, setCanReapply] = useState(true);
  const [freezeTimeLeft, setFreezeTimeLeft] = useState('');

  // require login
  useEffect(()=>{
    if(!authUser) navigate('/login');
  },[authUser, navigate]);

  // Check if lawyer is in freeze period after rejection - with real-time countdown
  useEffect(() => {
    if (authUser?.role === 'lawyer' && authUser?.verificationStatus === 'rejected' && authUser?.verificationDate) {
      const rejectionDate = new Date(authUser.verificationDate);
      const freezeEndDate = new Date(rejectionDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      const updateCountdown = () => {
        const now = new Date();
        
        if (now < freezeEndDate) {
          setCanReapply(false);
          
          // Calculate time difference
          const diff = freezeEndDate - now;
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          
          // Format countdown string
          if (days > 0) {
            setFreezeTimeLeft(`${days} day${days > 1 ? 's' : ''} and ${hours} hour${hours !== 1 ? 's' : ''}`);
          } else if (hours > 0) {
            setFreezeTimeLeft(`${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`);
          } else {
            setFreezeTimeLeft(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
          }
        } else {
          setCanReapply(true);
          setFreezeTimeLeft('');
        }
      };
      
      // Update immediately
      updateCountdown();
      
      // Update every minute for real-time countdown
      const interval = setInterval(updateCountdown, 60000); // Update every 60 seconds
      
      return () => clearInterval(interval); // Cleanup on unmount
    } else {
      setCanReapply(true);
    }
  }, [authUser]);

  // Predefined options
  const SPECIALTIES_OPTIONS = [
    'Criminal Law', 'Civil Law', 'Corporate Law', 'Family Law', 'Property Law',
    'Labor Law', 'Tax Law', 'Intellectual Property', 'Constitutional Law',
    'Environmental Law', 'Immigration Law', 'Consumer Law', 'Banking Law',
    'Insurance Law', 'Cyber Law', 'Human Rights', 'Medical Negligence'
  ];

  const MODES_OPTIONS = ['In-Person', 'Video Call', 'Phone Call', 'Chat'];
  
  const LANGUAGES_OPTIONS = [
    'English', 'Hindi', 'Bengali', 'Telugu', 'Marathi', 'Tamil',
    'Gujarati', 'Urdu', 'Kannada', 'Malayalam', 'Punjabi', 'Odia'
  ];

  const COURTS_OPTIONS = [
    'District Court', 'High Court', 'Supreme Court',
    'Magistrate Court', 'Family Court', 'Consumer Court',
    'Labor Court', 'Tax Tribunal', 'NCLT', 'NCLAT'
  ];

  const EDUCATION_OPTIONS = [
    'LLB', 'BA LLB', 'BBA LLB', 'LLM', 'PhD in Law',
    'Diploma in Law', 'Corporate Law Certification',
    'Intellectual Property Certification'
  ];

  const CITIES_OPTIONS = [
    'Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata',
    'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Chandigarh', 'Indore',
    'Bhopal', 'Nagpur', 'Kochi', 'Coimbatore', 'Visakhapatnam', 'Patna'
  ];

  const [bio, setBio] = useState(authUser?.bio || '');
  const [phone, setPhone] = useState(authUser?.phone || '');
  const [specialties, setSpecialties] = useState(authUser?.specialties || []);
  const [location] = useState(authUser?.location || '');
  const [city, setCity] = useState(authUser?.city || '');
  const [yearsExperience, setYearsExperience] = useState(authUser?.yearsExperience || 0);
  const [fee, setFee] = useState(authUser?.fee || '');
  const [modes, setModes] = useState(authUser?.modes || []);
  const [languages, setLanguages] = useState(authUser?.languages || []);
  const [courts, setCourts] = useState(authUser?.courts || []);
  const [freeFirst, setFreeFirst] = useState(Boolean(authUser?.freeFirst));
  const [firmType, setFirmType] = useState(authUser?.firmType || 'independent');
  const [education, setEducation] = useState(authUser?.education || []);
  const [successRate, setSuccessRate] = useState(authUser?.successRate || '');
  const [responseTimeHours, setResponseTimeHours] = useState(authUser?.responseTimeHours || 24);
  const [organization, setOrganization] = useState(authUser?.organization || '');
  
  // Document upload states
  const [proofDocument, setProofDocument] = useState(null);
  const [degreeCertificate, setDegreeCertificate] = useState(null);
  const [proofDocPreview, setProofDocPreview] = useState('');
  const [degreeCertPreview, setDegreeCertPreview] = useState('');
  
  // Field-specific error states
  const [errors, setErrors] = useState({});

  const setUser = useAuthStore(s=>s.setUser);

  // Handlers for multi-select
  const toggleItem = (item, list, setList) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const removeItem = (item, list, setList) => {
    setList(list.filter(i => i !== item));
  };

  // File handlers
  const handleProofDocumentChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProofDocument(file);
      // Create preview
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setProofDocPreview(reader.result);
        reader.readAsDataURL(file);
      } else {
        setProofDocPreview('pdf');
      }
    }
  };

  const handleDegreeCertificateChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setDegreeCertificate(file);
      // Create preview
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setDegreeCertPreview(reader.result);
        reader.readAsDataURL(file);
      } else {
        setDegreeCertPreview('pdf');
      }
    }
  };

  const submit = async () => {
    try {
      // Clear previous errors
      setErrors({});

      // Frontend Validation
      const validationErrors = {};

      // Bio validation
      if (!bio.trim()) {
        validationErrors.bio = 'Bio is required';
      } else if (bio.trim().length < 50) {
        validationErrors.bio = `Bio must be at least 50 characters (currently ${bio.trim().length} characters)`;
      } else if (bio.trim().length > 2000) {
        validationErrors.bio = 'Bio must not exceed 2000 characters';
      }

      // Phone validation
      if (!phone.trim()) {
        validationErrors.phone = 'Phone number is required';
      } else {
        const phoneRegex = /^[6-9]\d{9}$/;
        const cleanPhone = phone.replace(/\s+/g, '').replace(/[()-]/g, '');
        if (!phoneRegex.test(cleanPhone)) {
          validationErrors.phone = 'Must be a valid 10-digit Indian mobile number starting with 6-9';
        }
      }

      // City validation
      if (!city) {
        validationErrors.city = 'City is required';
      }

      // Specialties validation
      if (specialties.length === 0) {
        validationErrors.specialties = 'Please select at least one specialty';
      } else if (specialties.length > 10) {
        validationErrors.specialties = 'Maximum 10 specialties allowed';
      }

      // Years of experience validation
      if (yearsExperience && (Number(yearsExperience) < 0 || Number(yearsExperience) > 70)) {
        validationErrors.yearsExperience = 'Must be between 0 and 70';
      }

      // Fee validation
      if (fee && (Number(fee) < 0 || Number(fee) > 1000000)) {
        validationErrors.fee = 'Must be between ₹0 and ₹10,00,000';
      }

      // Success rate validation
      if (successRate && (Number(successRate) < 0 || Number(successRate) > 100)) {
        validationErrors.successRate = 'Must be between 0 and 100';
      }

      // Document validation
      if (!proofDocument) {
        validationErrors.proofDocument = 'Proof document (Bar Council ID/License) is required';
      } else {
        const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!validTypes.includes(proofDocument.type)) {
          validationErrors.proofDocument = 'Proof document must be PDF, JPG, or PNG';
        } else if (proofDocument.size > 5 * 1024 * 1024) {
          validationErrors.proofDocument = 'Proof document must be less than 5MB';
        }
      }

      if (!degreeCertificate) {
        validationErrors.degreeCertificate = 'Degree certificate is required';
      } else {
        const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!validTypes.includes(degreeCertificate.type)) {
          validationErrors.degreeCertificate = 'Degree certificate must be PDF, JPG, or PNG';
        } else if (degreeCertificate.size > 5 * 1024 * 1024) {
          validationErrors.degreeCertificate = 'Degree certificate must be less than 5MB';
        }
      }

      // Show all validation errors
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        toast.error('Please fix the validation errors below');
        // Scroll to first error
        const firstErrorField = Object.keys(validationErrors)[0];
        const element = document.querySelector(`[data-field="${firstErrorField}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('bio', bio.trim());
      formData.append('phone', phone.replace(/\s+/g, '').replace(/[()-]/g, ''));
      formData.append('specialties', JSON.stringify(specialties));
      formData.append('location', location.trim());
      formData.append('city', city);
      formData.append('yearsExperience', Number(yearsExperience) || 0);
      formData.append('fee', fee ? Number(fee) : 0);
      formData.append('modes', JSON.stringify(modes));
      formData.append('languages', JSON.stringify(languages));
      formData.append('courts', JSON.stringify(courts));
      formData.append('freeFirst', Boolean(freeFirst));
      formData.append('firmType', firmType);
      formData.append('education', JSON.stringify(education));
      formData.append('successRate', successRate ? Number(successRate) : 0);
      formData.append('responseTimeHours', Number(responseTimeHours) || 24);
      formData.append('organization', organization.trim());
      
      // Append files
      formData.append('proofDocument', proofDocument);
      formData.append('degreeCertificate', degreeCertificate);

      await api.post('/api/lawyers/onboard', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      // refresh profile
      const me = await api.get('/auth/me');
      setUser(me.data.user || me.data);
      toast.success('Application submitted successfully! Your profile is pending admin verification.');
      navigate('/onboard-lawyer');
    } catch (err) { 
      console.error(err);
      // Handle backend validation errors
      if (err?.response?.data?.errors) {
        const backendErrors = err.response.data.errors;
        setErrors(backendErrors);
        toast.error('Please fix the validation errors below');
      } else {
        toast.error(err?.response?.data?.error || 'Failed to submit application. Please try again.');
      }
    }
  };

  // Determine if the lawyer has completed onboarding (bio or specialties present)
  const isOnboarded = !!(authUser?.bio && authUser.bio.length > 0) || !!(authUser?.specialties && authUser.specialties.length > 0);

  // Check verification status
  const verificationStatus = authUser?.verificationStatus || 'pending';

  // If user is a lawyer and already onboarded, show status message based on verification
  if (authUser?.role === 'lawyer' && isOnboarded) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        {verificationStatus === 'pending' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-yellow-900 mb-2">Verification Pending</h2>
                <p className="text-sm text-yellow-800 mb-4">
                  Thank you for submitting your lawyer profile! Your application is currently under review by our admin team.
                </p>
                <div className="bg-white rounded-md p-4 mb-4">
                  <p className="text-sm text-gray-700 mb-2"><strong>What happens next?</strong></p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    <li>Our team will review your credentials and profile information</li>
                    <li>You'll be notified once your profile is verified</li>
                    <li>After approval, you'll be visible in the lawyer directory</li>
                    <li>You can then start accepting client requests</li>
                  </ul>
                </div>
                <p className="text-xs text-yellow-700">
                  <strong>Note:</strong> Verification typically takes 24-48 hours. You'll receive an update via email.
                </p>
              </div>
            </div>
          </div>
        )}

        {verificationStatus === 'approved' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-green-900 mb-2">Profile Verified! 🎉</h2>
                <p className="text-sm text-green-800 mb-4">
                  Congratulations! Your lawyer profile has been verified and approved by our admin team.
                </p>
                <div className="bg-white rounded-md p-4 mb-4">
                  <p className="text-sm text-gray-700 mb-2"><strong>You can now:</strong></p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    <li>Appear in the lawyer directory for clients to find you</li>
                    <li>Receive and accept connection requests from clients</li>
                    <li>Chat with clients who connect with you</li>
                    <li>Build your reputation on the platform</li>
                  </ul>
                </div>
                {authUser?.verificationNotes && (
                  <div className="bg-blue-50 rounded-md p-3 mb-3">
                    <p className="text-xs font-semibold text-blue-900 mb-1">Admin Note:</p>
                    <p className="text-sm text-blue-800">{authUser.verificationNotes}</p>
                  </div>
                )}
                <p className="text-xs text-green-700">
                  If you need to update your profile, please contact support.
                </p>
              </div>
            </div>
          </div>
        )}

        {verificationStatus === 'rejected' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-red-900 mb-2">Verification Declined</h2>
                <p className="text-sm text-red-800 mb-4">
                  Unfortunately, your lawyer profile verification was not approved at this time.
                </p>
                {authUser?.verificationNotes && (
                  <div className="bg-white rounded-md p-4 mb-4">
                    <p className="text-sm font-semibold text-gray-900 mb-2">Reason for Rejection:</p>
                    <p className="text-sm text-gray-700">{authUser.verificationNotes}</p>
                  </div>
                )}
                <div className="bg-white rounded-md p-4 mb-4">
                  <p className="text-sm text-gray-700 mb-2"><strong>What you can do:</strong></p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    <li>Review the rejection reason carefully</li>
                    <li>Update your credentials or documentation</li>
                    <li>Contact support for clarification</li>
                    <li>Reapply once you've addressed the concerns</li>
                  </ul>
                </div>
                {!canReapply ? (
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <p className="text-orange-800 font-semibold mb-1">⏰ Reapplication Freeze Period</p>
                    <p className="text-orange-700 text-sm">
                      You can reapply in <span className="font-bold">{freezeTimeLeft}</span>. Please use this time to address the feedback above.
                    </p>
                  </div>
                ) : (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <p className="text-green-800 font-semibold mb-1">✓ Ready to Reapply</p>
                    <p className="text-green-700 text-sm mb-3">
                      You can now submit a new application. Please address the feedback above before reapplying.
                    </p>
                    <button
                      onClick={() => {
                        // Reset to help seeker to allow new application
                        if (window.confirm('Start a new lawyer application? Your previous application data will be cleared.')) {
                          window.location.reload();
                        }
                      }}
                      className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Start New Application
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Join as Lawyer</h2>
      <p className="text-sm text-gray-600 mb-6">Fill out the form below to apply as a lawyer on our platform. Your application will be reviewed by our admin team.</p>
      
      <div className="grid grid-cols-1 gap-6">
        {/* Bio */}
        <div data-field="bio">
          <label className="block mb-2 font-semibold text-gray-700">Bio <span className="text-red-500">*</span></label>
          <textarea 
            value={bio} 
            onChange={e=>setBio(e.target.value)} 
            className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.bio ? 'border-red-500 bg-red-50' : 'border-gray-300'
            }`}
            rows={4}
            placeholder="Tell us about your legal experience, expertise, and what makes you unique..."
          />
          <div className="flex justify-between items-start mt-1">
            <div className="flex-1">
              {errors.bio && (
                <p className="text-red-600 text-sm">{errors.bio}</p>
              )}
            </div>
            <p className="text-xs text-gray-500">{bio.trim().length}/2000</p>
          </div>
        </div>

        {/* Phone & City */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div data-field="phone">
            <label className="block mb-2 font-semibold text-gray-700">Phone Number <span className="text-red-500">*</span></label>
            <input 
              value={phone} 
              onChange={e=>setPhone(e.target.value)} 
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.phone ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Enter 10-digit mobile number"
              maxLength={10}
            />
            {errors.phone && (
              <p className="text-red-600 text-sm mt-1">{errors.phone}</p>
            )}
          </div>
          <div data-field="city">
            <label className="block mb-2 font-semibold text-gray-700">City <span className="text-red-500">*</span></label>
            <select 
              value={city} 
              onChange={e=>setCity(e.target.value)} 
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.city ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
            >
              <option value="">Select City</option>
              {CITIES_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.city && (
              <p className="text-red-600 text-sm mt-1">{errors.city}</p>
            )}
          </div>
        </div>

        {/* Specialties */}
        <div data-field="specialties">
          <label className="block mb-2 font-semibold text-gray-700">Legal Specialties <span className="text-red-500">*</span></label>
          <p className="text-xs text-gray-500 mb-2">Select all that apply</p>
          {errors.specialties && (
            <p className="text-red-600 text-sm mb-2">{errors.specialties}</p>
          )}
          <div className={`border rounded-lg p-3 bg-gray-50 ${
            errors.specialties ? 'border-red-500' : 'border-gray-300'
          }`}>
            <div className="flex flex-wrap gap-2 mb-3">
              {specialties.length > 0 ? (
                specialties.map(s => (
                  <span key={s} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                    {s}
                    <button onClick={() => removeItem(s, specialties, setSpecialties)} className="hover:text-blue-900">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-gray-400 text-sm">No specialties selected</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => toggleItem(s, specialties, setSpecialties)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    specialties.includes(s)
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:border-blue-500'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Experience, Fee, Firm Type */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div data-field="yearsExperience">
            <label className="block mb-2 font-semibold text-gray-700">Years of Experience</label>
            <input 
              value={yearsExperience} 
              onChange={e=>setYearsExperience(e.target.value)} 
              type="number" 
              min="0"
              max="70"
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.yearsExperience ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.yearsExperience && (
              <p className="text-red-600 text-sm mt-1">{errors.yearsExperience}</p>
            )}
          </div>
          <div data-field="fee">
            <label className="block mb-2 font-semibold text-gray-700">Consultation Fee (₹)</label>
            <input 
              value={fee} 
              onChange={e=>setFee(e.target.value)} 
              type="number" 
              min="0"
              max="1000000"
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.fee ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Per session"
            />
            {errors.fee && (
              <p className="text-red-600 text-sm mt-1">{errors.fee}</p>
            )}
          </div>
          <div>
            <label className="block mb-2 font-semibold text-gray-700">Firm Type</label>
            <select 
              value={firmType} 
              onChange={e=>setFirmType(e.target.value)} 
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="independent">Independent</option>
              <option value="firm">Law Firm</option>
            </select>
          </div>
        </div>

        {/* Consultation Modes */}
        <div>
          <label className="block mb-2 font-semibold text-gray-700">Consultation Modes</label>
          <p className="text-xs text-gray-500 mb-2">Select all consultation modes you offer</p>
          <div className="border border-gray-300 rounded-lg p-3 bg-gray-50">
            <div className="flex flex-wrap gap-2 mb-3">
              {modes.length > 0 ? (
                modes.map(m => (
                  <span key={m} className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                    {m}
                    <button onClick={() => removeItem(m, modes, setModes)} className="hover:text-green-900">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-gray-400 text-sm">No modes selected</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {MODES_OPTIONS.map(m => (
                <button
                  key={m}
                  onClick={() => toggleItem(m, modes, setModes)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    modes.includes(m)
                      ? 'bg-green-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:border-green-500'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Languages */}
        <div>
          <label className="block mb-2 font-semibold text-gray-700">Languages</label>
          <p className="text-xs text-gray-500 mb-2">Select languages you can consult in</p>
          <div className="border border-gray-300 rounded-lg p-3 bg-gray-50">
            <div className="flex flex-wrap gap-2 mb-3">
              {languages.length > 0 ? (
                languages.map(l => (
                  <span key={l} className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                    {l}
                    <button onClick={() => removeItem(l, languages, setLanguages)} className="hover:text-purple-900">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-gray-400 text-sm">No languages selected</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES_OPTIONS.map(l => (
                <button
                  key={l}
                  onClick={() => toggleItem(l, languages, setLanguages)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    languages.includes(l)
                      ? 'bg-purple-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:border-purple-500'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Courts */}
        <div>
          <label className="block mb-2 font-semibold text-gray-700">Courts</label>
          <p className="text-xs text-gray-500 mb-2">Select courts where you practice</p>
          <div className="border border-gray-300 rounded-lg p-3 bg-gray-50">
            <div className="flex flex-wrap gap-2 mb-3">
              {courts.length > 0 ? (
                courts.map(c => (
                  <span key={c} className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                    {c}
                    <button onClick={() => removeItem(c, courts, setCourts)} className="hover:text-orange-900">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-gray-400 text-sm">No courts selected</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {COURTS_OPTIONS.map(c => (
                <button
                  key={c}
                  onClick={() => toggleItem(c, courts, setCourts)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    courts.includes(c)
                      ? 'bg-orange-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:border-orange-500'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Education */}
        <div>
          <label className="block mb-2 font-semibold text-gray-700">Education & Certifications</label>
          <p className="text-xs text-gray-500 mb-2">Select your legal qualifications</p>
          <div className="border border-gray-300 rounded-lg p-3 bg-gray-50">
            <div className="flex flex-wrap gap-2 mb-3">
              {education.length > 0 ? (
                education.map(e => (
                  <span key={e} className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                    {e}
                    <button onClick={() => removeItem(e, education, setEducation)} className="hover:text-indigo-900">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-gray-400 text-sm">No education selected</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {EDUCATION_OPTIONS.map(e => (
                <button
                  key={e}
                  onClick={() => toggleItem(e, education, setEducation)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    education.includes(e)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:border-indigo-500'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Additional Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block mb-2 font-semibold text-gray-700">Free First Consultation</label>
            <select 
              value={freeFirst ? 'yes' : 'no'} 
              onChange={e=>setFreeFirst(e.target.value === 'yes')} 
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div data-field="successRate">
            <label className="block mb-2 font-semibold text-gray-700">Success Rate (%)</label>
            <input 
              value={successRate} 
              onChange={e=>setSuccessRate(e.target.value)} 
              type="number" 
              min="0" 
              max="100" 
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.successRate ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="e.g., 85"
            />
            {errors.successRate && (
              <p className="text-red-600 text-sm mt-1">{errors.successRate}</p>
            )}
          </div>
          <div>
            <label className="block mb-2 font-semibold text-gray-700">Response Time (hrs)</label>
            <select 
              value={responseTimeHours} 
              onChange={e=>setResponseTimeHours(e.target.value)} 
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="1">1 hour</option>
              <option value="2">2 hours</option>
              <option value="6">6 hours</option>
              <option value="12">12 hours</option>
              <option value="24">24 hours</option>
              <option value="48">48 hours</option>
            </select>
          </div>
        </div>

        {/* Organization */}
        <div>
          <label className="block mb-2 font-semibold text-gray-700">Organization / Law Firm (Optional)</label>
          <input 
            value={organization} 
            onChange={e=>setOrganization(e.target.value)} 
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your law firm or organization name"
          />
        </div>

        {/* Document Uploads */}
        <div className="border-t-2 border-gray-200 pt-6 mt-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Required Documents</h3>
          <p className="text-sm text-gray-600 mb-6">Upload your verification documents. These will be reviewed by our admin team.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Proof Document */}
            <div data-field="proofDocument">
              <label className="block mb-2 font-semibold text-gray-700">
                Proof Document <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">Bar Council ID, License, or Professional Certificate</p>
              <div className={`border-2 border-dashed rounded-lg p-4 text-center ${
                errors.proofDocument ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-gray-50'
              }`}>
                {proofDocPreview ? (
                  <div className="space-y-3">
                    {proofDocPreview === 'pdf' ? (
                      <div className="flex items-center justify-center">
                        <svg className="w-16 h-16 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ) : (
                      <img src={proofDocPreview} alt="Proof preview" className="max-h-32 mx-auto rounded" />
                    )}
                    <p className="text-sm text-gray-700 font-medium">{proofDocument?.name}</p>
                    <button
                      onClick={() => {
                        setProofDocument(null);
                        setProofDocPreview('');
                      }}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <label className="cursor-pointer">
                      <span className="text-blue-600 hover:text-blue-700 font-medium">Upload file</span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleProofDocumentChange}
                      />
                    </label>
                    <p className="text-xs text-gray-500 mt-1">PDF, JPG, or PNG (max 5MB)</p>
                  </div>
                )}
              </div>
              {errors.proofDocument && (
                <p className="text-red-600 text-sm mt-1">{errors.proofDocument}</p>
              )}
            </div>

            {/* Degree Certificate */}
            <div data-field="degreeCertificate">
              <label className="block mb-2 font-semibold text-gray-700">
                Degree Certificate <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">LLB, LLM, or equivalent degree certificate</p>
              <div className={`border-2 border-dashed rounded-lg p-4 text-center ${
                errors.degreeCertificate ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-gray-50'
              }`}>
                {degreeCertPreview ? (
                  <div className="space-y-3">
                    {degreeCertPreview === 'pdf' ? (
                      <div className="flex items-center justify-center">
                        <svg className="w-16 h-16 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ) : (
                      <img src={degreeCertPreview} alt="Degree preview" className="max-h-32 mx-auto rounded" />
                    )}
                    <p className="text-sm text-gray-700 font-medium">{degreeCertificate?.name}</p>
                    <button
                      onClick={() => {
                        setDegreeCertificate(null);
                        setDegreeCertPreview('');
                      }}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <label className="cursor-pointer">
                      <span className="text-blue-600 hover:text-blue-700 font-medium">Upload file</span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleDegreeCertificateChange}
                      />
                    </label>
                    <p className="text-xs text-gray-500 mt-1">PDF, JPG, or PNG (max 5MB)</p>
                  </div>
                )}
              </div>
              {errors.degreeCertificate && (
                <p className="text-red-600 text-sm mt-1">{errors.degreeCertificate}</p>
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-6 flex gap-4">
          <button 
            onClick={submit} 
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
          >
            Submit Application
          </button>
          <button 
            onClick={() => navigate(-1)} 
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center">
          By submitting this application, you agree to our terms and conditions. Your application will be reviewed by our admin team within 24-48 hours.
        </p>
      </div>
    </div>
  );
};

export default LawyerOnboard;
