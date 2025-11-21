import React, { useEffect, useState } from 'react';
import api from '../Axios/axios';
import useAuthStore from '../context/AuthContext';
import InitialAvatar from '../components/InitialAvatar';
import { useNavigate } from 'react-router-dom';

const MyClients = () => {
  const user = useAuthStore(s=>s.user);
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  useEffect(()=>{
    if(!user || user.role !== 'lawyer') {
      navigate('/home');
      return;
    }
    const fetch = async ()=>{
      try{
        const res = await api.get('/api/lawyers/connections/lawyer');
        setClients(res.data.connections || []);
      }catch(e){console.error(e);}    
    };
    fetch();
  }, [user, navigate]);

  useEffect(()=>{
    if(!activeChat) return;
    const fetchMsgs = async ()=>{
      try{ const res = await api.get(`/api/messages/${activeChat}`); setMessages(res.data.messages || []);}catch(e){console.error(e);}    
    };
    fetchMsgs();
  }, [activeChat]);

  const openChat = (chatId)=> {
    setActiveChat(chatId);
    // Clear local unread indicator for this chat (optimistic, server should persist)
    setClients(prev => prev.map(c => c.chat === chatId ? { ...c, unread: 0, unreadCount: 0 } : c));
  };

  const sendMessage = async ()=>{
    if(!text.trim() || !activeChat) return;
    try{
      await api.post('/api/messages', { chatId: activeChat, content: text });
      setMessages(prev => [...prev, { _id: `tmp-${Date.now()}`, content: text, user: user._id, createdAt: new Date().toISOString() }]);
      setText('');
    }catch(e){console.error(e);}    
  };

  return (
  <div className="flex-1 flex bg-card border rounded overflow-hidden min-h-0">
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b flex items-center gap-3">
          <div>
            <div className="font-semibold">{user?.name}</div>
            <div className="text-xs text-gray-500">Lawyer</div>
          </div>
        </div>
          <div className="flex-1 overflow-y-auto">
            {clients.map(c=> {
              const last = c.lastMessage || null;
              const lastText = last ? (last.content || '') : null;
              const lastTime = last ? new Date(last.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
              const unread = c.unread || c.unreadCount || c.unreadMessages || 0;

              return (
              <div key={c._id} onClick={()=>openChat(c.chat)} className={`p-3 border-b hover:bg-surface cursor-pointer flex items-center gap-3 ${c.chat===activeChat? 'bg-surface' : ''}`}>
                {c.from?.profileImage?.gcsUrl || c.from?.picture ? (
                  <img
                    src={c.from?.profileImage?.gcsUrl || c.from?.picture}
                    alt={c.from?.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <InitialAvatar name={(c.from||{}).name} className="w-12 h-12 rounded-full" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold truncate">{(c.from||{}).name}</div>
                    <div className="text-[11px] text-gray-400 ml-2">{lastTime}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className={`text-sm truncate min-w-0 ${unread > 0 ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                      {lastText ? lastText : <em className="text-xs text-gray-400">No messages yet</em>}
                    </div>
                    <div className="ml-3">
                      {unread > 0 ? (
                        <div className="inline-flex items-center justify-center w-6 h-6 bg-red-500 text-white text-[11px] font-semibold rounded-full">{unread > 9 ? '9+' : unread}</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            )})}
          </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b">
          {activeChat ? 'Conversation' : 'Select a client'}
        </div>
  <div className="flex-1 p-4 overflow-y-auto bg-surface min-h-0">
          {activeChat ? messages.map(m => (
            <div key={m._id} className={`mb-3 flex ${m.user === user?._id ? 'justify-end' : 'justify-start'}`}>
              <div className={`${m.user === user?._id ? 'text-white btn-gradient' : 'bg-white text-gray-900'} max-w-[60%] px-4 py-2 rounded-lg shadow`}>
                <div className="break-words">{m.content}</div>
                <div className="text-xs text-gray-300 mt-1 text-right">{new Date(m.createdAt).toLocaleTimeString()}</div>
              </div>
            </div>
          )) : <div className="p-6 text-center text-gray-500">No client selected</div>}
        </div>
        <div className="p-3 border-t flex items-center gap-2">
          <input
            value={text}
            onChange={e=>setText(e.target.value)}
            placeholder="Type a message"
            className="flex-1 p-2 border rounded"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button onClick={sendMessage} className="px-4 py-2 btn-gradient text-white rounded">Send</button>
        </div>
      </div>
    </div>
  );
};

export default MyClients;
