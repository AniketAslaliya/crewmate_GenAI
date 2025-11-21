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
  
  // Support messages state
  const [supportMessages, setSupportMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportStats, setSupportStats] = useState({ pending: 0, total: 0 });

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
    if (authUser?.role === 'admin' && activeTab !== 'support') {
      fetchLawyers();
    }
  }, [activeTab, authUser]);

  // Fetch support messages when support tab is active
  useEffect(() => {
    const fetchSupportMessages = async () => {
      setLoading(true);
      try {
        const res = await api.get('/api/support/all');
        const messages = res.data.messages || [];
        setSupportMessages(messages);
        
        const pending = messages.filter(m => m.status === 'pending').length;
        setSupportStats({ pending, total: messages.length });
      } catch (err) {
        console.error('Failed to fetch support messages:', err);
        alert('Failed to load support messages');
      } finally {
        setLoading(false);
      }
    };
    
    if (authUser?.role === 'admin' && activeTab === 'support') {
      fetchSupportMessages();
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

  // Support message handlers
  const handleViewMessage = async (messageId) => {
    try {
      const res = await api.get(`/api/support/${messageId}`);
      setSelectedMessage(res.data.message);
      setShowSupportModal(true);
    } catch (err) {
      console.error('Failed to fetch message details:', err);
      alert('Failed to load message details');
    }
  };

  const handleUpdateMessageStatus = async (messageId, newStatus, priority, adminNotes) => {
    try {
      await api.put(`/api/support/${messageId}`, {
        status: newStatus,
        priority,
        adminNotes
      });
      alert('Message updated successfully');
      
      // Refresh support messages
      const res = await api.get('/api/support/all');
      const messages = res.data.messages || [];
      setSupportMessages(messages);
      const pending = messages.filter(m => m.status === 'pending').length;
      setSupportStats({ pending, total: messages.length });
      
      setShowSupportModal(false);
      setSelectedMessage(null);
    } catch (err) {
      console.error('Failed to update message:', err);
      alert('Failed to update message');
    }
  };

  const handleImpersonateUser = (userId) => {
    // Navigate to user's profile for admin to make changes
    navigate(`/admin/user/${userId}`);
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
          <div className="flex flex-wrap border-b border-gray-200">
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
            <TabButton
              active={activeTab === 'support'}
              onClick={() => setActiveTab('support')}
              label="Support Messages"
              badge={supportStats.pending}
            />
          </div>
        </div>

        {/* Content Area */}
        {activeTab === 'support' ? (
          <SupportMessagesSection
            loading={loading}
            messages={supportMessages}
            onViewMessage={handleViewMessage}
            onUpdateStatus={handleUpdateMessageStatus}
            onImpersonate={handleImpersonateUser}
          />
        ) : (
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
        )}
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

      {/* Support Message Modal */}
      <AnimatePresence>
        {showSupportModal && selectedMessage && (
          <SupportMessageModal
            message={selectedMessage}
            onUpdate={handleUpdateMessageStatus}
            onClose={() => {
              setShowSupportModal(false);
              setSelectedMessage(null);
            }}
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

// Support Messages Section Component
const SupportMessagesSection = ({ loading, messages, onViewMessage, onUpdateStatus, onImpersonate }) => {
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  const filteredMessages = messages.filter(msg => {
    if (filterStatus !== 'all' && msg.status !== filterStatus) return false;
    if (filterPriority !== 'all' && msg.priority !== filterPriority) return false;
    return true;
  });

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      'in-progress': 'bg-blue-100 text-blue-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-gray-100 text-gray-600',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      urgent: 'bg-red-100 text-red-700'
    };
    return colors[priority] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Filters */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading support messages...</p>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <p>No support messages found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredMessages.map((msg) => (
                <tr key={msg._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {msg.user?.profileImage?.gcsUrl || msg.user?.picture ? (
                        <img
                          src={msg.user?.profileImage?.gcsUrl || msg.user?.picture}
                          alt={msg.name}
                          className="w-10 h-10 rounded-full object-cover mr-3"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold mr-3">
                          {msg.name?.charAt(0) || 'U'}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-gray-900">{msg.name}</div>
                        <div className="text-sm text-gray-500">{msg.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-xs">
                      <div className="font-medium text-gray-900 truncate">{msg.subject}</div>
                      <div className="text-sm text-gray-500 truncate">{msg.message}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(msg.status)}`}>
                      {msg.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(msg.priority)}`}>
                      {msg.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(msg.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => onViewMessage(msg._id)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      View
                    </button>
                    <button
                      onClick={() => onImpersonate(msg.user._id)}
                      className="text-indigo-600 hover:text-indigo-900"
                      title="View user details"
                    >
                      User
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Support Message Modal Component
const SupportMessageModal = ({ message, onUpdate, onClose }) => {
  const [status, setStatus] = useState(message.status);
  const [priority, setPriority] = useState(message.priority);
  const [adminNotes, setAdminNotes] = useState(message.adminNotes || '');

  const handleSubmit = () => {
    onUpdate(message._id, status, priority, adminNotes);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Support Message Details</h2>
              <p className="text-sm text-gray-500 mt-1">
                Submitted on {new Date(message.createdAt).toLocaleString()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* User Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">User Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium text-gray-900">{message.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium text-gray-900">{message.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Role</p>
                <p className="font-medium text-gray-900">{message.user?.role || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium text-gray-900">{message.user?.phone || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Message Content */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Subject</h3>
            <p className="text-gray-700 mb-4">{message.subject}</p>
            
            <h3 className="font-semibold text-gray-900 mb-2">Message</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-700 whitespace-pre-wrap">{message.message}</p>
            </div>
          </div>

          {/* Status Management */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="font-semibold text-gray-900 mb-4">Manage Ticket</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Admin Notes</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add internal notes about this support request..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Resolution Info */}
          {message.resolvedAt && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                <strong>Resolved:</strong> {new Date(message.resolvedAt).toLocaleString()}
                {message.resolvedBy && ` by ${message.resolvedBy.name}`}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Update Ticket
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AdminPanel;
