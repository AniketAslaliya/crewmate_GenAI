import React, { useEffect, useState } from 'react';
import api from '../Axios/axios';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';

const LawyerRequests = () => {
  const [pending, setPending] = useState([]);
  const [accepted, setAccepted] = useState([]);
  const [processing, setProcessing] = useState({});
  const navigate = useNavigate();
  const authUser = useAuthStore(s=>s.user);
  const toast = useToast();
  const isOnboarded = Boolean(authUser?.onboarded) || Boolean((authUser?.bio && authUser.bio.length > 0) || (authUser?.specialties && authUser?.specialties.length > 0));

  useEffect(()=>{
    if(!authUser || authUser.role !== 'lawyer'){
      navigate('/home');
    }
  },[authUser, navigate]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [pRes, aRes] = await Promise.all([
          api.get('/api/lawyers/requests'),
          api.get('/api/lawyers/connections/lawyer')
        ]);
        setPending(pRes.data.requests || []);
        setAccepted(aRes.data.connections || []);
      } catch (err) { console.error(err); }
    };
    fetch();
  }, []);

  // helper: robustly extract the peer's display name from different connection shapes
  const getConnectionName = (c) => {
    // c may be a ConnectionRequest doc or a populated connection
    // prefer 'from' for lawyer view (helpseeker -> lawyer)
    if (!c) return 'Unknown';
    const from = c.from || c.peer || c.to; // try common fields
    if (from) {
      if (typeof from === 'string') return from;
      if (from.name) return from.name;
      if (from.email) return from.email;
      if (from._id) return String(from._id).slice(-6); // fallback short id
    }
    // as a last resort, try title from chat
    if (c.chat && typeof c.chat === 'object' && c.chat.title) return c.chat.title;
    return 'Unknown';
  };

  const refreshAccepted = async () => {
    try {
      const res = await api.get('/api/lawyers/connections/lawyer');
      setAccepted(res.data.connections || []);
    } catch (e) {
      console.error('failed to refresh accepted', e);
    }
  };

  const accept = async (id) => {
    try {
      setProcessing(prev => ({ ...prev, [id]: 'accept' }));
      const res = await api.post(`/api/lawyers/requests/${id}/accept`);
      // update local state: remove from pending, add to accepted
      setPending(prev => prev.filter(r => r._id !== id));
      const newConnRaw = res.data.request;
      const newConn = {
        ...newConnRaw,
        chat: newConnRaw.chat && typeof newConnRaw.chat === 'object' ? newConnRaw.chat._id : newConnRaw.chat,
      };
  // ensure accepted has the populated 'from' and 'chat' if returned
  setAccepted(prev => [ ...(prev || []), newConn ]);
  // refresh canonical accepted connections (server will populate 'from' fields)
  refreshAccepted();
  toast.success('Accepted');
  } catch (err) { console.error(err); toast.error('Failed to accept request'); }
    finally { setProcessing(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    }); }
  };

  const reject = async (id) => {
    try {
      setProcessing(prev => ({ ...prev, [id]: 'reject' }));
      await api.post(`/api/lawyers/requests/${id}/reject`);
      setPending(prev => prev.filter(r => r._id !== id));
      toast.info('Rejected');
  } catch (err) { console.error(err); toast.error('Failed to reject request'); }
    finally { setProcessing(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    }); }
  };

  const acceptedPrivate = (accepted || []).filter(c => {
    if (!c) return false;
    if (!c.chat) return false;
    if (typeof c.chat === 'object' && c.chat.channel) return c.chat.channel === 'private';
    return true;
  });

  return (
    <div className="p-6 flex gap-6 flex-1 min-h-0">
      <div className="w-1/3 bg-white border border-gray-100 rounded-lg p-4 overflow-y-auto min-h-0 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Accepted Connections</h3>
        {acceptedPrivate.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m-8 8h16a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-gray-700 font-semibold">No connected clients yet</div>
            <div className="text-sm text-gray-500 mt-2">You'll see accepted connections here once someone connects with you.</div>
            {!isOnboarded ? (
              <div className="mt-4 text-sm text-gray-600">
                It looks like your lawyer profile isn't complete yet. <button onClick={()=>navigate('/onboard-lawyer')} className="ml-2 text-blue-600 underline">Complete onboarding</button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {acceptedPrivate.map(c=> (
              <div key={c._id} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-800">{getConnectionName(c)}</div>
                </div>
                <div>
                  {c.chat ? (
                    <button onClick={()=>navigate(`/chat/${typeof c.chat === 'object' ? c.chat._id : c.chat}`)} className="px-3 py-1 bg-blue-600 text-white rounded">Open Chat</button>
                  ) : <span className="text-sm text-gray-500">No chat</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 bg-white border border-gray-100 rounded-lg p-4 overflow-y-auto min-h-0 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Pending Requests</h3>
        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-yellow-50 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l9 6 9-6" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 8v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8" />
              </svg>
            </div>
            <div className="text-gray-700 font-semibold">No pending requests</div>
            <div className="text-sm text-gray-500 mt-2">When someone requests a connection you'll be able to accept or reject it here.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(r => (
              <div key={r._id} className="p-4 bg-gray-50 rounded-lg flex justify-between items-center">
                <div>
                  <div className="font-semibold text-gray-800">{r.from?.name || 'Unknown'}</div>
                  <div className="text-sm text-gray-500">{r.message}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={!!processing[r._id]}
                    onClick={() => accept(r._id)}
                    className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50 min-w-[90px] text-center"
                  >
                    {processing[r._id] === 'accept' ? 'Accepting...' : 'Accept'}
                  </button>

                  <button
                    disabled={!!processing[r._id]}
                    onClick={() => reject(r._id)}
                    className="px-3 py-1 bg-red-500 text-white rounded disabled:opacity-50 min-w-[90px] text-center"
                  >
                    {processing[r._id] === 'reject' ? 'Rejecting...' : 'Reject'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LawyerRequests;
