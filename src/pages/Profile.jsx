import React, { useState } from 'react';
import useAuthStore from '../context/AuthContext';
import api from '../Axios/axios';
import { useToast } from '../components/ToastProvider';
import { MdEdit, MdSave, MdCancel, MdPerson, MdEmail, MdPhone, MdLocationOn } from 'react-icons/md';

const Profile = () => {
  const authUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const toast = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const isLawyer = authUser?.role === 'lawyer';
  
  // Predefined options (same as LawyerOnboard)
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
  
  const [formData, setFormData] = useState({
    name: authUser?.name || '',
    phone: authUser?.phone || '',
    location: authUser?.location || '',
    // Lawyer specific fields (arrays kept as arrays)
    bio: authUser?.bio || '',
    city: authUser?.city || '',
    yearsExperience: authUser?.yearsExperience || 0,
    fee: authUser?.fee || 0,
    organization: authUser?.organization || '',
    specialties: authUser?.specialties || [],
    languages: authUser?.languages || [],
    courts: authUser?.courts || [],
    modes: authUser?.modes || [],
    education: authUser?.education || []
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Toggle item in array fields
  const toggleItem = (item, fieldName) => {
    const currentList = formData[fieldName];
    if (currentList.includes(item)) {
      setFormData({
        ...formData,
        [fieldName]: currentList.filter(i => i !== item)
      });
    } else {
      setFormData({
        ...formData,
        [fieldName]: [...currentList, item]
      });
    }
  };

  const removeItem = (item, fieldName) => {
    setFormData({
      ...formData,
      [fieldName]: formData[fieldName].filter(i => i !== item)
    });
  };

  const handleCancel = () => {
    setFormData({
      name: authUser?.name || '',
      phone: authUser?.phone || '',
      location: authUser?.location || '',
      // Lawyer specific fields
      bio: authUser?.bio || '',
      city: authUser?.city || '',
      yearsExperience: authUser?.yearsExperience || 0,
      fee: authUser?.fee || 0,
      organization: authUser?.organization || '',
      specialties: authUser?.specialties || [],
      languages: authUser?.languages || [],
      courts: authUser?.courts || [],
      modes: authUser?.modes || [],
      education: authUser?.education || []
    });
    setErrors({});
    setIsEditing(false);
  };

  const handleSave = async () => {
    // Clear previous errors
    setErrors({});

    if (!formData.name.trim()) {
      setErrors({ name: 'Name is required' });
      toast.error('Please fix the errors before saving');
      return;
    }

    setLoading(true);
    try {
      // Prepare data - arrays are already in correct format
      const dataToSend = {
        name: formData.name,
        phone: formData.phone,
        location: formData.location
      };
      
      // Add lawyer fields if user is a lawyer
      if (isLawyer) {
        dataToSend.bio = formData.bio;
        dataToSend.city = formData.city;
        dataToSend.yearsExperience = parseInt(formData.yearsExperience) || 0;
        dataToSend.fee = parseInt(formData.fee) || 0;
        dataToSend.organization = formData.organization;
        dataToSend.specialties = formData.specialties;
        dataToSend.languages = formData.languages;
        dataToSend.courts = formData.courts;
        dataToSend.modes = formData.modes;
        dataToSend.education = formData.education;
      }
      
      const response = await api.put('/auth/profile/update', dataToSend);
      const updatedUser = response.data.user;
      setUser(updatedUser);
      toast.success('Profile updated successfully!');
      setIsEditing(false);
      setErrors({});
    } catch (err) {
      console.error(err);
      // Handle backend validation errors
      if (err?.response?.data?.errors) {
        setErrors(err.response.data.errors);
        toast.error('Please fix the errors before saving');
      } else {
        toast.error(err?.response?.data?.error || 'Failed to update profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    });
  };

  const handleChangePassword = async () => {
    setPasswordErrors({});
    const errors = {};
    const passwordRegex = /(?=.*[A-Za-z])(?=.*\d)/;

    if (!passwordData.currentPassword) errors.currentPassword = 'Current password is required';
    if (!passwordData.newPassword) errors.newPassword = 'New password is required';
    else if (passwordData.newPassword.length < 8) errors.newPassword = 'Password must be at least 8 characters';
    else if (!passwordRegex.test(passwordData.newPassword)) errors.newPassword = 'Password must contain letters and numbers';
    if (!passwordData.confirmPassword) errors.confirmPassword = 'Please confirm your password';
    else if (passwordData.newPassword !== passwordData.confirmPassword) errors.confirmPassword = 'Passwords do not match';

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      toast.error('Please fix the errors');
      return;
    }

    setLoading(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      toast.success('Password changed successfully!');
      setIsChangingPassword(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordErrors({});
    } catch (err) {
      console.error(err);
      if (err?.response?.data?.error) {
        toast.error(err.response.data.error);
      } else {
        toast.error('Failed to change password');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPasswordChange = () => {
    setIsChangingPassword(false);
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordErrors({});
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">My Profile</h1>
                <p className="text-blue-100 text-sm mt-1">Manage your account information</p>
              </div>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  <MdEdit className="text-xl" />
                  <span className="font-medium">Edit Profile</span>
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleCancel}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <MdCancel className="text-xl" />
                    <span className="font-medium">Cancel</span>
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <MdSave className="text-xl" />
                    <span className="font-medium">{loading ? 'Saving...' : 'Save'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Profile Content */}
          <div className="p-6 space-y-6">
            {/* Profile Picture Section */}
            <div className="flex items-center gap-6 pb-6 border-b border-gray-200">
              <div className="relative">
                {authUser?.picture ? (
                  <img
                    src={authUser.picture}
                    alt={authUser.name}
                    className="w-24 h-24 rounded-full object-cover border-4 border-blue-100"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold border-4 border-blue-100">
                    {authUser?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-800">{authUser?.name}</h2>
                <p className="text-gray-600 text-sm mt-1">{authUser?.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                    authUser?.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                    authUser?.role === 'lawyer' ? 'bg-blue-100 text-blue-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {authUser?.role === 'admin' ? '👑 Admin' :
                     authUser?.role === 'lawyer' ? '⚖️ Lawyer' :
                     '🤝 Help Seeker'}
                  </span>
                  {isLawyer && authUser?.verificationStatus && (
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                      authUser.verificationStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      authUser.verificationStatus === 'approved' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {authUser.verificationStatus === 'pending' ? '⏳ Pending Verification' :
                       authUser.verificationStatus === 'approved' ? '✓ Verified' :
                       '✗ Rejected'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Basic Information</h3>
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <MdPerson className="text-gray-500" />
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      isEditing ? (errors.name ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white') : 'border-gray-200 bg-gray-50 cursor-not-allowed'
                    }`}
                    placeholder="Enter your full name"
                  />
                  {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
                </div>

                {/* Email (Read-only) */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <MdEmail className="text-gray-500" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={authUser?.email || ''}
                    disabled
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 cursor-not-allowed text-gray-600"
                  />
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>

                {/* Phone */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <MdPhone className="text-gray-500" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      isEditing ? (errors.phone ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white') : 'border-gray-200 bg-gray-50 cursor-not-allowed'
                    }`}
                    placeholder="Enter your phone number"
                    maxLength={10}
                  />
                  {errors.phone && <p className="text-red-600 text-sm mt-1">{errors.phone}</p>}
                </div>

                {/* Location */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <MdLocationOn className="text-gray-500" />
                    Location
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      isEditing ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 cursor-not-allowed'
                    }`}
                    placeholder="Enter your location"
                  />
                </div>
              </div>
            </div>

            {/* Lawyer Specific Info */}
            {isLawyer && (
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Professional Information</h3>
                <div className="space-y-4">
                  {/* Specialties */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Specialties {isEditing && <span className="text-red-500">*</span>}
                    </label>
                    {isEditing ? (
                      <div>
                        <div className="flex flex-wrap gap-2 p-3 border border-gray-300 rounded-lg bg-white min-h-[80px]">
                          {formData.specialties.map((item, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                            >
                              {item}
                              <button
                                type="button"
                                onClick={() => removeItem(item, 'specialties')}
                                className="hover:text-blue-900"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {SPECIALTIES_OPTIONS.filter(opt => !formData.specialties.includes(opt)).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => toggleItem(opt, 'specialties')}
                              className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-blue-50 hover:border-blue-300 transition-colors"
                            >
                              + {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {authUser?.specialties && authUser.specialties.length > 0 ? (
                          authUser.specialties.map((specialty, index) => (
                            <span key={index} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                              {specialty}
                            </span>
                          ))
                        ) : (
                          <p className="text-gray-400 text-sm">Not specified</p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Years of Experience */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Years of Experience</label>
                    {isEditing ? (
                      <input
                        type="number"
                        name="yearsExperience"
                        value={formData.yearsExperience}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter years of experience"
                        min="0"
                      />
                    ) : (
                      <p className="text-gray-600">{authUser?.yearsExperience || 0} years</p>
                    )}
                  </div>
                  
                  {/* Professional Bio */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Professional Bio</label>
                    {isEditing ? (
                      <textarea
                        name="bio"
                        value={formData.bio}
                        onChange={handleChange}
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Describe your professional background and expertise"
                      />
                    ) : (
                      <p className="text-gray-600 whitespace-pre-wrap">{authUser?.bio || 'Not provided'}</p>
                    )}
                  </div>
                  
                  {/* Practice City */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Practice City {isEditing && <span className="text-red-500">*</span>}</label>
                    {isEditing ? (
                      <select
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select City</option>
                        {CITIES_OPTIONS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-gray-600">{authUser?.city || 'Not specified'}</p>
                    )}
                  </div>
                  
                  {/* Languages */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Languages</label>
                    {isEditing ? (
                      <div>
                        <div className="flex flex-wrap gap-2 p-3 border border-gray-300 rounded-lg bg-white min-h-[60px]">
                          {formData.languages.map((item, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                            >
                              {item}
                              <button
                                type="button"
                                onClick={() => removeItem(item, 'languages')}
                                className="hover:text-gray-900"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {LANGUAGES_OPTIONS.filter(opt => !formData.languages.includes(opt)).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => toggleItem(opt, 'languages')}
                              className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-gray-50 hover:border-gray-400 transition-colors"
                            >
                              + {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {authUser?.languages && authUser.languages.length > 0 ? (
                          authUser.languages.map((lang, index) => (
                            <span key={index} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                              {lang}
                            </span>
                          ))
                        ) : (
                          <p className="text-gray-400 text-sm">Not specified</p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Courts */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Courts</label>
                    {isEditing ? (
                      <div>
                        <div className="flex flex-wrap gap-2 p-3 border border-gray-300 rounded-lg bg-white min-h-[60px]">
                          {formData.courts.map((item, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                            >
                              {item}
                              <button
                                type="button"
                                onClick={() => removeItem(item, 'courts')}
                                className="hover:text-purple-900"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {COURTS_OPTIONS.filter(opt => !formData.courts.includes(opt)).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => toggleItem(opt, 'courts')}
                              className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-purple-50 hover:border-purple-300 transition-colors"
                            >
                              + {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {authUser?.courts && authUser.courts.length > 0 ? (
                          authUser.courts.map((court, index) => (
                            <span key={index} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                              {court}
                            </span>
                          ))
                        ) : (
                          <p className="text-gray-400 text-sm">Not specified</p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Consultation Fee */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Consultation Fee (₹)</label>
                    {isEditing ? (
                      <input
                        type="number"
                        name="fee"
                        value={formData.fee}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter consultation fee per session"
                        min="0"
                      />
                    ) : (
                      <p className="text-gray-600 font-medium">
                        {authUser?.fee > 0 ? `₹${authUser.fee.toLocaleString()} per session` : 'Not specified'}
                      </p>
                    )}
                  </div>
                  
                  {/* Consultation Modes */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Consultation Modes</label>
                    {isEditing ? (
                      <div>
                        <div className="flex flex-wrap gap-2 p-3 border border-gray-300 rounded-lg bg-white min-h-[60px]">
                          {formData.modes.map((item, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm"
                            >
                              {item}
                              <button
                                type="button"
                                onClick={() => removeItem(item, 'modes')}
                                className="hover:text-green-900"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {MODES_OPTIONS.filter(opt => !formData.modes.includes(opt)).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => toggleItem(opt, 'modes')}
                              className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-green-50 hover:border-green-300 transition-colors"
                            >
                              + {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {authUser?.modes && authUser.modes.length > 0 ? (
                          authUser.modes.map((mode, index) => (
                            <span key={index} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm capitalize">
                              {mode}
                            </span>
                          ))
                        ) : (
                          <p className="text-gray-400 text-sm">Not specified</p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Organization */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Organization / Law Firm</label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="organization"
                        value={formData.organization}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter your organization or law firm name"
                      />
                    ) : (
                      <p className="text-gray-600">{authUser?.organization || 'Not specified'}</p>
                    )}
                  </div>
                  
                  {/* Education */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Education</label>
                    {isEditing ? (
                      <div>
                        <div className="flex flex-wrap gap-2 p-3 border border-gray-300 rounded-lg bg-white min-h-[60px]">
                          {formData.education.map((item, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm"
                            >
                              {item}
                              <button
                                type="button"
                                onClick={() => removeItem(item, 'education')}
                                className="hover:text-indigo-900"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {EDUCATION_OPTIONS.filter(opt => !formData.education.includes(opt)).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => toggleItem(opt, 'education')}
                              className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                            >
                              + {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        {authUser?.education && authUser.education.length > 0 ? (
                          <ul className="list-disc list-inside space-y-1">
                            {authUser.education.map((edu, index) => (
                              <li key={index} className="text-gray-600 text-sm">{edu}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-400 text-sm">Not provided</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Security Section - Change Password */}
            <div className="pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Security</h3>
                {!isChangingPassword && (
                  <button
                    onClick={() => setIsChangingPassword(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    Change Password
                  </button>
                )}
              </div>

              {isChangingPassword ? (
                <div className="bg-blue-50 rounded-lg p-6 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Current Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      name="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        passwordErrors.currentPassword ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'
                      }`}
                      placeholder="Enter current password"
                    />
                    {passwordErrors.currentPassword && (
                      <p className="text-red-600 text-sm mt-1">{passwordErrors.currentPassword}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      New Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      name="newPassword"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        passwordErrors.newPassword ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'
                      }`}
                      placeholder="Enter new password"
                    />
                    {passwordErrors.newPassword && (
                      <p className="text-red-600 text-sm mt-1">{passwordErrors.newPassword}</p>
                    )}
                    <p className="text-xs text-gray-600 mt-1">
                      At least 8 characters with letters and numbers
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Confirm New Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        passwordErrors.confirmPassword ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'
                      }`}
                      placeholder="Confirm new password"
                    />
                    {passwordErrors.confirmPassword && (
                      <p className="text-red-600 text-sm mt-1">{passwordErrors.confirmPassword}</p>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleCancelPasswordChange}
                      disabled={loading}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleChangePassword}
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Changing...' : 'Change Password'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    🔒 Keep your account secure by using a strong password
                  </p>
                </div>
              )}
            </div>

            {/* Account Info */}
            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Account Information</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Account Created</span>
                  <span className="text-gray-800 font-medium">
                    {authUser?.createdAt ? new Date(authUser.createdAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Last Updated</span>
                  <span className="text-gray-800 font-medium">
                    {authUser?.updatedAt ? new Date(authUser.updatedAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
