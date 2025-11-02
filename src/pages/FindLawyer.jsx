import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FiltersContainer from '../components/FiltersContainer';
import { useNavigate } from 'react-router-dom';
import api from '../Axios/axios';
import useAuthStore from '../context/AuthContext';
import Button from '../components/ui/Button';
import { useToast } from '../components/ToastProvider';
import InitialAvatar from '../components/InitialAvatar';

const FindLawyer = () => {
  const [lawyers, setLawyers] = useState([]);
  const [filters, setFilters] = useState({
    query: '',
    city: '',
    specialization: '',
    minExp: '',
    feeMin: '',
    feeMax: '',
    modeFilter: '',
    languageFilter: '',
    courtFilter: '',
    verifiedOnly: false,
    minRating: '',
    freeFirst: '',
    firmType: '',
  });
  const [myLawyers, setMyLawyers] = useState([]);
  const [selectedTab, setSelectedTab] = useState('your');
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(null);
  const [sentRequests, setSentRequests] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);
  // Debounced filters: update after user stops typing
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const user = useAuthStore(s => s.user);
  const isLawyer = user?.role === 'lawyer';
  const navigate = useNavigate();
  const toast = useToast();

  // Memoized update filter function
  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      query: '',
      city: '',
      specialization: '',
      minExp: '',
      feeMin: '',
      feeMax: '',
      modeFilter: '',
      languageFilter: '',
      courtFilter: '',
      verifiedOnly: false,
      minRating: '',
      freeFirst: '',
      firmType: '',
    });
  }, []);

  useEffect(() => {
    if (isLawyer) navigate('/lawyer/requests');
  }, [isLawyer, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
          const [res, my, myReqs] = await Promise.all([
            api.get('/api/lawyers/list'),
            api.get('/api/lawyers/connections/me'),
            api.get('/api/lawyers/my-requests')
          ]);
          setLawyers(res.data.lawyers || []);
          const normalizedMy = (my.data.connections || []).map(c => {
          const chatId = c.chat && typeof c.chat === 'object' ? c.chat._id : c.chat;
          let toObj = c.to;
          if (!toObj || typeof toObj !== 'object') {
            toObj = (res.data.lawyers || []).find(l => l._id === (c.to || c.to?._id)) || { _id: c.to };
          }
          return { ...c, chat: chatId, to: toObj };
        });
        setMyLawyers(normalizedMy);
          // normalize outgoing requests so we can mark buttons as Sent
          try {
            const outgoing = (myReqs && myReqs.data && Array.isArray(myReqs.data.requests)) ? myReqs.data.requests : [];
            const ids = new Set(outgoing.map(r => (r.to && typeof r.to === 'object') ? (r.to._id || r.to.id) : (r.to || r.to)));
            setSentRequests(ids);
          } catch (e) {
            console.warn('failed to normalize my-requests', e);
          }
      } catch (err) { 
        console.error(err); 
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const requestLawyer = async (lawyerId) => {
    setRequesting(lawyerId);
    try {
      await api.post('/api/lawyers/request', { 
        to: lawyerId, 
        message: 'I would like to request a consultation with you.' 
      });

      // mark as sent locally (use immutable Set copy)
      setSentRequests(prev => {
        const copy = new Set(prev);
        copy.add(lawyerId);
        return copy;
      });

      // clear requesting flag
      setRequesting(null);

      // try to refresh outgoing requests to sync canonical data (non-blocking)
      (async () => {
        try {
          const r = await api.get('/api/lawyers/my-requests');
          const outgoing = (r && r.data && Array.isArray(r.data.requests)) ? r.data.requests : [];
          const ids = new Set(outgoing.map(rr => (rr.to && typeof rr.to === 'object') ? (rr.to._id || rr.to.id) : (rr.to || rr.to)));
          setSentRequests(ids);
        } catch (e) { /* ignore */ }
      })();
    } catch (err) {
      console.error(err);
      const status = err?.response?.status;
      if (status === 400) {
        toast.info('You already have an active request to this lawyer.');
        // ensure UI marks it as sent
        setSentRequests(prev => {
          const copy = new Set(prev);
          copy.add(lawyerId);
          return copy;
        });
      } else {
        toast.error('Failed to send request. Please try again.');
      }
      setRequesting(null);
    }
  };

  // Memoized filtered lawyers (uses debouncedFilters so typing doesn't re-filter on every keystroke)
  const filteredLawyers = useMemo(() => {
  const connectedIds = new Set(myLawyers.map(c => c.to?._id || c.to));

    return lawyers.filter(lawyer => {
      const isConnected = connectedIds.has(lawyer._id);

      if (isConnected) {
        // Show connected lawyers only in the 'your' tab
        return selectedTab === 'your';
      }

      // For the 'find' tab apply filters (use debouncedFilters so we don't filter on every keystroke)
      if (selectedTab === 'find') {
        const {
          query, city, specialization, minExp, feeMin, feeMax,
          modeFilter, languageFilter, courtFilter, verifiedOnly,
          minRating, freeFirst, firmType
        } = debouncedFilters;

        if (query && !`${lawyer.name} ${lawyer.specialties?.join(' ')} ${lawyer.bio}`.toLowerCase().includes(query.toLowerCase())) return false;
        if (city && lawyer.city && !lawyer.city.toLowerCase().includes(city.toLowerCase())) return false;
        if (specialization && !(lawyer.specialties || []).some(s => s.toLowerCase().includes(specialization.toLowerCase()))) return false;
        if (minExp && (!lawyer.yearsExperience || lawyer.yearsExperience < Number(minExp))) return false;
        if (feeMin && (!lawyer.fee || lawyer.fee < Number(feeMin))) return false;
        if (feeMax && (!lawyer.fee || lawyer.fee > Number(feeMax))) return false;
        if (modeFilter && !(lawyer.modes || []).includes(modeFilter)) return false;
        if (languageFilter && !(lawyer.languages || []).some(lang => lang.toLowerCase().includes(languageFilter.toLowerCase()))) return false;
        if (courtFilter && !(lawyer.courts || []).some(court => court.toLowerCase().includes(courtFilter.toLowerCase()))) return false;
        if (verifiedOnly && !lawyer.verified) return false;
        if (minRating && (!lawyer.rating || lawyer.rating < Number(minRating))) return false;
        if (freeFirst === 'yes' && !lawyer.freeFirst) return false;
        if (freeFirst === 'no' && lawyer.freeFirst) return false;
        if (firmType && lawyer.firmType !== firmType) return false;
      }

      // Default: include in lists where not excluded above
      return true;
    });
  }, [lawyers, myLawyers, selectedTab, debouncedFilters]);

  // Debounce effect: update debouncedFilters 300ms after last change
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilters(filters), 300);
    return () => clearTimeout(t);
  }, [filters]);

  // Counts for stats in the filters panel
  const counts = useMemo(() => {
    const available = filteredLawyers.length;
    const ratings = filteredLawyers.map(l => Number(l.rating || 0));
    const avgRating = ratings.length ? (ratings.reduce((a,b) => a + b, 0) / ratings.length).toFixed(1) : '-';
    return { available, avgRating };
  }, [filteredLawyers]);

  // FilterSection moved to `FiltersContainer` to avoid re-renders

  const DetailRow = React.memo(({ icon, title, items }) => (
    items && items.length > 0 && (
      <div className="flex items-start space-x-3 py-2">
        <div className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-500 mb-1">{title}</div>
          <div className="flex flex-wrap gap-1">
            {items.slice(0, 3).map((item, index) => (
              <span
                key={index}
                className="inline-block px-2 py-1 bg-gray-50 text-gray-700 text-xs rounded-md border border-gray-200"
              >
                {item}
              </span>
            ))}
            {items.length > 3 && (
              <span className="inline-block px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-md">
                +{items.length - 3} more
              </span>
            )}
          </div>
        </div>
      </div>
    )
  ));

  const LawyerCard = React.memo(({ lawyer, isConnected = false, chatId, onRequest, requestingId }) => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 overflow-hidden group"
    >
      {/* Verified Badge */}
      {lawyer.verified && (
        <div className="absolute top-4 right-4 z-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-semibold rounded-full flex items-center gap-1 shadow-lg"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Verified
          </motion.div>
        </div>
      )}

      {/* Lawyer Image and Basic Info */}
      <div className="p-6">
        <div className="flex items-start space-x-4">
          <motion.div 
            className="relative"
            whileHover={{ scale: 1.1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <InitialAvatar name={lawyer.name} className="w-16 h-16 rounded-2xl border-2 border-white shadow-lg" />
            {lawyer.online && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
            )}
          </motion.div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg text-gray-900 truncate">{lawyer.name}</h3>
            <p className="text-gray-600 text-sm">{lawyer.organization || 'Independent Lawyer'}</p>
            <div className="flex items-center space-x-3 mt-1">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{(lawyer.city || lawyer.location) || 'Location not specified'}</span>
              </div>

              <div className="text-sm text-gray-500 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">{lawyer.successRate !== undefined ? `${lawyer.successRate}% success` : 'Success rate N/A'}</span>
                <span className="px-2 py-0.5 bg-gray-50 text-gray-700 rounded-full text-xs">{lawyer.yearsExperience ? `${lawyer.yearsExperience} yrs` : 'Experience N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Specialties */}
        <div className="mt-4">
          <div className="text-xs font-medium text-gray-500 mb-2">SPECIALTIES</div>
          <div className="flex flex-wrap gap-2">
            {(lawyer.specialties || []).slice(0, 4).map((specialty, index) => (
              <motion.span
                key={specialty}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="px-3 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-medium rounded-full shadow-sm"
              >
                {specialty}
              </motion.span>
            ))}
            {(lawyer.specialties || []).length > 4 && (
              <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                +{(lawyer.specialties || []).length - 4} more
              </span>
            )}
          </div>
        </div>

        {/* Detailed Information Rows */}
        <div className="mt-4 space-y-1">
          <DetailRow
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            }
            title="LANGUAGES"
            items={lawyer.languages}
          />

          <DetailRow
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14v6l9-5-9-5-9 5 9 5z" />
              </svg>
            }
            title="EDUCATION"
            items={lawyer.education}
          />

          <DetailRow
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
            title="COURTS"
            items={lawyer.courts}
          />

          <DetailRow
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            title="CONSULTATION MODES"
            items={lawyer.modes}
          />
        </div>
      </div>

      {/* Action Button */}
      <div className="px-6 pb-6">
        {isConnected ? (
          <div className="flex space-x-3">
            <Button
              variant="primary"
              className={`flex-1 ${!chatId ? 'bg-gray-300 cursor-not-allowed' : ''}`}
              onClick={() => chatId ? navigate(`/chat/${chatId}`) : null}
              disabled={!chatId}
            >
              {chatId ? 'Open Chat' : 'Chat Unavailable'}
            </Button>
          </div>
        ) : (
          <motion.button
            onClick={() => onRequest(lawyer._id)}
            disabled={requestingId === lawyer._id || sentRequests.has(lawyer._id)}
            className={`w-full py-3 rounded-xl font-semibold text-white transition-all duration-300 ${
              sentRequests.has(lawyer._id)
                ? 'bg-gray-500 cursor-default'
                : requestingId === lawyer._id
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
            }`}
            whileHover={!sentRequests.has(lawyer._id) && requestingId !== lawyer._id ? { scale: 1.02 } : {}}
            whileTap={!sentRequests.has(lawyer._id) && requestingId !== lawyer._id ? { scale: 0.98 } : {}}
          >
            {sentRequests.has(lawyer._id) ? (
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                <span>Request Sent</span>
              </div>
            ) : requestingId === lawyer._id ? (
              <div className="flex items-center justify-center space-x-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                />
                <span>Sending Request...</span>
              </div>
            ) : (
              'Request Consultation'
            )}
          </motion.button>
        )}
      </div>
    </motion.div>
  ));

  // Filters UI has been moved to `FiltersContainer` component to avoid re-renders.

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-20"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 100, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-20"
          animate={{
            scale: [1.2, 1, 1.2],
            x: [0, -100, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-4 font-serif bg-gradient-to-r from-blue-900 to-indigo-800 bg-clip-text text-transparent">
            Find Your Legal Expert
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Connect with verified legal professionals tailored to your specific needs
          </p>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-8"
        >
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-2 shadow-lg border border-white/20">
            <button
              onClick={() => setSelectedTab('your')}
              className={`px-8 py-3 rounded-xl font-semibold transition-all duration-300 ${
                selectedTab === 'your'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Your Lawyers
            </button>
            <button
              onClick={() => setSelectedTab('find')}
              className={`px-8 py-3 rounded-xl font-semibold transition-all duration-300 ${
                selectedTab === 'find'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Find Lawyers
            </button>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"
            />
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Filters Sidebar (extracted component) */}
            {selectedTab === 'find' && (
              <FiltersContainer
                filters={filters}
                onFilterChange={updateFilter}
                onReset={resetFilters}
                show={showFilters}
                onClose={() => setShowFilters(false)}
                counts={counts}
              />
            )}

            {/* Main Content */}
            <motion.main
              layout
              className="flex-1"
            >
              {/* Mobile Filter Toggle */}
              {selectedTab === 'find' && (
                <div className="lg:hidden mb-4">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="w-full py-3 bg-white rounded-xl shadow-lg border border-gray-200 font-semibold text-gray-700 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
                    </svg>
                    {showFilters ? 'Hide Filters' : 'Show Filters'}
                  </button>
                </div>
              )}

              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedTab}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="grid grid-cols-1 xl:grid-cols-2 gap-8"
                >
                  {selectedTab === 'your' ? (
                    myLawyers.length === 0 ? (
                      <div className="col-span-full text-center py-20">
                        <div className="w-32 h-32 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                          <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-3">No Lawyers Connected</h3>
                        <p className="text-gray-600 mb-6">Start by finding and connecting with legal experts</p>
                        <Button
                          variant="primary"
                          onClick={() => setSelectedTab('find')}
                          className="px-8 py-3 rounded-xl"
                        >
                          Find Lawyers
                        </Button>
                      </div>
                    ) : (
                      myLawyers.map(connection => {
                        const lawyer = connection.to || {};
                        const lastMsg = connection.lastMessage || connection.last_message || null;
                        const lastText = lastMsg?.text || lastMsg?.content || '';
                        const lastAt = lastMsg?.createdAt || lastMsg?.created_at || connection.updatedAt || connection.lastUpdated || null;
                        const unread = connection.unread || connection.unreadCount || 0;

                        return (
                          <motion.div
                            key={connection._id}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            whileHover={{ scale: 1.01 }}
                            className={`bg-white rounded-2xl shadow-md border border-gray-100 p-4 flex items-center justify-between cursor-pointer transition-all`} 
                            onClick={() => connection.chat ? navigate(`/chat/${connection.chat}`) : toast.info('Chat not available')}
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <InitialAvatar name={lawyer.name} className="w-12 h-12 rounded-lg border border-white shadow-sm flex-shrink-0" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold text-gray-900 truncate">{lawyer.name || 'Unknown'}</h4>
                                  <span className="text-xs text-gray-400">•</span>
                                  <span className="text-xs text-gray-500 truncate">{lawyer.organization || 'Independent'}</span>
                                </div>
                                <div className="text-sm text-gray-600 truncate mt-1 max-w-[40ch]">
                                  {lastText ? lastText : <span className="text-gray-400">No messages yet</span>}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col items-end ml-4">
                              {lastAt && (
                                <div className="text-xs text-gray-400 mb-2">{new Date(lastAt).toLocaleString()}</div>
                              )}
                              {unread > 0 ? (
                                <div className="bg-red-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">{unread}</div>
                              ) : (
                                <div className="text-xs text-gray-300">&nbsp;</div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })
                    )
                  ) : (
                    filteredLawyers.length === 0 ? (
                      <div className="col-span-full text-center py-20">
                        <div className="w-32 h-32 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                          <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-3">No Lawyers Found</h3>
                        <p className="text-gray-600 mb-6">Try adjusting your filters to find more results</p>
                        <Button
                          variant="secondary"
                          onClick={resetFilters}
                          className="px-8 py-3 rounded-xl"
                        >
                          Clear All Filters
                        </Button>
                      </div>
                    ) : (
                      filteredLawyers.map(lawyer => (
                        <LawyerCard
                          key={lawyer._id}
                          lawyer={lawyer}
                          isConnected={false}
                          onRequest={requestLawyer}
                          requestingId={requesting}
                        />
                      ))
                    )
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.main>
          </div>
        )}
      </div>
    </div>
  );
};

export default FindLawyer;