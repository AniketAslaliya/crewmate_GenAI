import React, { useState, useEffect } from 'react';
import api from '../Axios/axios';
import useAuthStore from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const AdminPanel = () => {
  const authUser = useAuthStore(s => s.user);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('pending');
  const [lawyers, setLawyers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLawyer, setSelectedLawyer] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [actionType, setActionType] = useState(''); // 'approve' or 'reject'

  // Check admin access
  useEffect(() => {
    if (!authUser) {
      navigate('/login');
      return;
    }
    if (authUser.role !== 'admin') {
      alert('Admin access required');
      navigate('/');
      return;
    }
  }, [authUser, navigate]);

  // Fetch statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/api/admin/stats');
        setStats(res.data.stats);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    };
    if (authUser?.role === 'admin') {
      fetchStats();
    }
  }, [authUser]);

  // Fetch lawyers based on active tab
  useEffect(() => {
    const fetchLawyers = async () => {
      setLoading(true);
      try {
        const endpoint = `/api/admin/lawyers/${activeTab}`;
        const res = await api.get(endpoint);
        setLawyers(res.data.lawyers);
      } catch (err) {
        console.error('Failed to fetch lawyers:', err);
        alert('Failed to load lawyers');
      } finally {
        setLoading(false);
      }
    };
    if (authUser?.role === 'admin') {
      fetchLawyers();
    }
  }, [activeTab, authUser]);

  const handleViewDetails = async (lawyerId) => {
    try {
      const res = await api.get(`/api/admin/lawyers/${lawyerId}`);
      setSelectedLawyer(res.data.lawyer);
      setShowModal(true);
    } catch (err) {
      console.error('Failed to fetch lawyer details:', err);
      alert('Failed to load lawyer details');
    }
  };

  const handleApprove = (lawyer) => {
    setSelectedLawyer(lawyer);
    setActionType('approve');
    setNotes('');
    setShowModal(true);
  };

  const handleReject = (lawyer) => {
    setSelectedLawyer(lawyer);
    setActionType('reject');
    setNotes('');
    setShowModal(true);
  };

  const submitAction = async () => {
    if (actionType === 'reject' && !notes.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      const endpoint = `/api/admin/lawyers/${selectedLawyer._id}/${actionType}`;
      await api.post(endpoint, { notes });
      alert(`Lawyer ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`);
      setShowModal(false);
      setSelectedLawyer(null);
      setNotes('');
      // Refresh the list
      const res = await api.get(`/api/admin/lawyers/${activeTab}`);
      setLawyers(res.data.lawyers);
      // Refresh stats
      const statsRes = await api.get('/api/admin/stats');
      setStats(statsRes.data.stats);
    } catch (err) {
      console.error('Action failed:', err);
      alert(err?.response?.data?.error || 'Action failed');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedLawyer(null);
    setNotes('');
    setActionType('');
  };

  if (!authUser || authUser.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
          <p className="text-gray-600">Manage lawyer verifications and platform statistics</p>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <StatCard title="Total Lawyers" value={stats.totalLawyers} color="blue" />
            <StatCard title="Pending" value={stats.pendingVerifications} color="yellow" />
            <StatCard title="Approved" value={stats.approvedLawyers} color="green" />
            <StatCard title="Rejected" value={stats.rejectedLawyers} color="red" />
            <StatCard title="Total Users" value={stats.totalUsers} color="purple" />
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            <TabButton
              active={activeTab === 'pending'}
              onClick={() => setActiveTab('pending')}
              label="Pending Verifications"
              badge={stats?.pendingVerifications}
            />
            <TabButton
              active={activeTab === 'verified'}
              onClick={() => setActiveTab('verified')}
              label="Verified Lawyers"
              badge={stats?.approvedLawyers}
            />
            <TabButton
              active={activeTab === 'rejected'}
              onClick={() => setActiveTab('rejected')}
              label="Rejected"
              badge={stats?.rejectedLawyers}
            />
          </div>
        </div>

        {/* Lawyers List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-600">Loading lawyers...</p>
            </div>
          ) : lawyers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No lawyers found in this category</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lawyer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Specialties</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Experience</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fee</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {lawyers.map((lawyer) => (
                    <LawyerRow
                      key={lawyer._id}
                      lawyer={lawyer}
                      activeTab={activeTab}
                      onViewDetails={handleViewDetails}
                      onApprove={handleApprove}
                      onReject={handleReject}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && selectedLawyer && (
          <Modal
            lawyer={selectedLawyer}
            actionType={actionType}
            notes={notes}
            setNotes={setNotes}
            onSubmit={submitAction}
            onClose={closeModal}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ title, value, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
  };

  return (
    <div className={`rounded-lg border p-6 ${colorClasses[color]}`}>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  );
};

// Tab Button Component
const TabButton = ({ active, onClick, label, badge }) => (
  <button
    onClick={onClick}
    className={`px-6 py-3 text-sm font-medium transition-colors relative ${
      active
        ? 'text-blue-600 border-b-2 border-blue-600'
        : 'text-gray-600 hover:text-gray-900'
    }`}
  >
    {label}
    {badge > 0 && (
      <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
        active ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
      }`}>
        {badge}
      </span>
    )}
  </button>
);

// Lawyer Row Component
const LawyerRow = ({ lawyer, activeTab, onViewDetails, onApprove, onReject }) => (
  <tr className="hover:bg-gray-50 transition-colors">
    <td className="px-6 py-4">
      <div className="flex items-center">
        <img
          src={lawyer.picture || 'https://via.placeholder.com/40'}
          alt={lawyer.name}
          className="w-10 h-10 rounded-full mr-3"
        />
        <div>
          <p className="font-medium text-gray-900">{lawyer.name}</p>
          <p className="text-sm text-gray-500">{lawyer.email}</p>
        </div>
      </div>
    </td>
    <td className="px-6 py-4">
      <div className="flex flex-wrap gap-1">
        {lawyer.specialties?.slice(0, 2).map((spec, idx) => (
          <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded">
            {spec}
          </span>
        ))}
        {lawyer.specialties?.length > 2 && (
          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
            +{lawyer.specialties.length - 2}
          </span>
        )}
      </div>
    </td>
    <td className="px-6 py-4 text-sm text-gray-600">
      {lawyer.city || lawyer.location || 'N/A'}
    </td>
    <td className="px-6 py-4 text-sm text-gray-600">
      {lawyer.yearsExperience} years
    </td>
    <td className="px-6 py-4 text-sm text-gray-600">
      ₹{lawyer.fee || 0}
    </td>
    <td className="px-6 py-4 text-right">
      <div className="flex justify-end gap-2">
        <button
          onClick={() => onViewDetails(lawyer._id)}
          className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
        >
          View Details
        </button>
        {activeTab === 'pending' && (
          <>
            <button
              onClick={() => onApprove(lawyer)}
              className="px-3 py-1.5 text-sm text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => onReject(lawyer)}
              className="px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
            >
              Reject
            </button>
          </>
        )}
      </div>
    </td>
  </tr>
);

// Modal Component
const Modal = ({ lawyer, actionType, notes, setNotes, onSubmit, onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900">
          {actionType === 'approve' ? 'Approve Lawyer' : actionType === 'reject' ? 'Reject Lawyer' : 'Lawyer Details'}
        </h2>
      </div>

      <div className="p-6 space-y-4">
        {/* Lawyer Info */}
        <div className="flex items-start gap-4 pb-4 border-b border-gray-200">
          <img
            src={lawyer.picture || 'https://via.placeholder.com/80'}
            alt={lawyer.name}
            className="w-20 h-20 rounded-full"
          />
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{lawyer.name}</h3>
            <p className="text-gray-600">{lawyer.email}</p>
            {lawyer.phone && <p className="text-gray-600">📞 {lawyer.phone}</p>}
          </div>
        </div>

        {/* Bio */}
        {lawyer.bio && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Bio</h4>
            <p className="text-gray-700">{lawyer.bio}</p>
          </div>
        )}

        {/* Documents Section */}
        {(lawyer.proofDocument || lawyer.degreeCertificate) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Verification Documents
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lawyer.proofDocument?.url && (
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Proof Document</p>
                  <p className="text-xs text-gray-500 mb-2">{lawyer.proofDocument.filename}</p>
                  <a
                    href={lawyer.proofDocument.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View Document
                  </a>
                </div>
              )}
              {lawyer.degreeCertificate?.url && (
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Degree Certificate</p>
                  <p className="text-xs text-gray-500 mb-2">{lawyer.degreeCertificate.filename}</p>
                  <a
                    href={lawyer.degreeCertificate.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View Document
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4">
          <DetailItem label="Specialties" value={lawyer.specialties?.join(', ') || 'N/A'} />
          <DetailItem label="Location" value={`${lawyer.city || ''} ${lawyer.location || ''}`.trim() || 'N/A'} />
          <DetailItem label="Experience" value={`${lawyer.yearsExperience} years`} />
          <DetailItem label="Fee" value={`₹${lawyer.fee || 0}`} />
          <DetailItem label="Firm Type" value={lawyer.firmType || 'N/A'} />
          <DetailItem label="Success Rate" value={`${lawyer.successRate || 0}%`} />
          <DetailItem label="Response Time" value={`${lawyer.responseTimeHours || 24} hours`} />
          <DetailItem label="Free First" value={lawyer.freeFirst ? 'Yes' : 'No'} />
        </div>

        {/* Arrays */}
        {lawyer.modes?.length > 0 && (
          <DetailItem label="Modes" value={lawyer.modes.join(', ')} />
        )}
        {lawyer.languages?.length > 0 && (
          <DetailItem label="Languages" value={lawyer.languages.join(', ')} />
        )}
        {lawyer.courts?.length > 0 && (
          <DetailItem label="Courts" value={lawyer.courts.join(', ')} />
        )}
        {lawyer.education?.length > 0 && (
          <DetailItem label="Education" value={lawyer.education.join(', ')} />
        )}
        {lawyer.organization && (
          <DetailItem label="Organization" value={lawyer.organization} />
        )}

        {/* Action Form */}
        {(actionType === 'approve' || actionType === 'reject') && (
          <div className="pt-4 border-t border-gray-200">
            <label className="block mb-2 font-semibold text-gray-900">
              {actionType === 'reject' ? 'Rejection Reason (Required)' : 'Notes (Optional)'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              placeholder={actionType === 'reject' ? 'Enter reason for rejection...' : 'Enter any notes...'}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          {actionType ? 'Cancel' : 'Close'}
        </button>
        {(actionType === 'approve' || actionType === 'reject') && (
          <button
            onClick={onSubmit}
            className={`px-4 py-2 text-white rounded-lg transition-colors ${
              actionType === 'approve'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {actionType === 'approve' ? 'Approve Lawyer' : 'Reject Lawyer'}
          </button>
        )}
      </div>
    </motion.div>
  </motion.div>
);

// Detail Item Component
const DetailItem = ({ label, value }) => (
  <div>
    <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
    <p className="text-gray-900">{value}</p>
  </div>
);

export default AdminPanel;
