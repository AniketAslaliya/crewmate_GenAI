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

  return (
    <div className="p-6 flex gap-6 flex-1 min-h-0">
      <div className="w-1/3 border rounded p-4 overflow-y-auto min-h-0">
        <h3 className="text-lg font-semibold mb-3">Accepted Connections</h3>
        <div className="space-y-3">
          {accepted
            .filter(c => {
              // only show connections that have an associated private chat
              if (!c.chat) return false;
              // c.chat may be populated object (with channel) or an id string
              if (typeof c.chat === 'object' && c.chat.channel) {
                return c.chat.channel === 'private';
              }
              // fallback: if we only have an id, assume it's private (server should populate when possible)
              return true;
            })
            .map(c=> (
              <div key={c._id} className="p-2 border rounded flex items-center justify-between">
                <div>
                  <div className="font-semibold">{getConnectionName(c)}</div>
                </div>
                <div>
                  {c.chat ? (
                    // if chat is populated use its _id, otherwise use as string
                    <button onClick={()=>navigate(`/chat/${typeof c.chat === 'object' ? c.chat._id : c.chat}`)} className="px-2 py-1 btn-gradient text-white rounded">Open Chat</button>
                  ) : <span className="text-sm text-gray-500">No chat</span>}
                </div>
              </div>
            ))}
        </div>
      </div>

  <div className="flex-1 border rounded p-4 overflow-y-auto min-h-0">
        <h3 className="text-lg font-semibold mb-3">Pending Requests</h3>
        <div className="space-y-3">
          {pending.map(r => (
            <div key={r._id} className="p-4 border rounded flex justify-between">
                <div>
                <div className="font-semibold">{r.from?.name || 'Unknown'}</div>
                <div className="text-sm text-gray-500">{r.message}</div>
              </div>
                <div className="flex gap-2">
                  {/* shared button base ensures visual consistency */}
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
      </div>
    </div>
  );
};

export default LawyerRequests;
