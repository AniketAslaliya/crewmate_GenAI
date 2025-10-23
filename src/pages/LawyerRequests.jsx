import React, { useEffect, useState } from 'react';
import api from '../Axios/axios';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../context/AuthContext';

const LawyerRequests = () => {
  const [pending, setPending] = useState([]);
  const [accepted, setAccepted] = useState([]);
  const [processing, setProcessing] = useState({});
  const navigate = useNavigate();
  const authUser = useAuthStore(s=>s.user);

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

  const accept = async (id) => {
    try {
      setProcessing(prev => ({ ...prev, [id]: true }));
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
      const chatId = res.data.chat?._id;
      if (chatId) {
        navigate(`/chat/${chatId}`);
      } else {
        alert('Accepted');
      }
    } catch (err) { console.error(err); alert('Failed'); }
    finally { setProcessing(prev => ({ ...prev, [id]: false })); }
  };

  const reject = async (id) => {
    try {
      setProcessing(prev => ({ ...prev, [id]: true }));
      await api.post(`/api/lawyers/requests/${id}/reject`);
      setPending(prev => prev.filter(r => r._id !== id));
      alert('Rejected');
    } catch (err) { console.error(err); alert('Failed'); }
    finally { setProcessing(prev => ({ ...prev, [id]: false })); }
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
                  <div className="font-semibold">{c.from.name}</div>
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
                <div className="font-semibold">{r.from.name}</div>
                <div className="text-sm text-gray-500">{r.message}</div>
              </div>
                <div className="flex gap-2">
                <button disabled={processing[r._id]} onClick={()=>accept(r._id)} className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50">{processing[r._id] ? 'Accepting...' : 'Accept'}</button>
                <button disabled={processing[r._id]} onClick={()=>reject(r._id)} className="px-3 py-1 bg-red-500 text-white rounded disabled:opacity-50">{processing[r._id] ? 'Rejecting...' : 'Reject'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LawyerRequests;
