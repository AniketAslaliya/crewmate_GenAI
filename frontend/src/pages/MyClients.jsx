import React, { useEffect, useState } from 'react';
import api from '../Axios/axios';
import useAuthStore from '../context/AuthContext';
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

  const openChat = (chatId)=> setActiveChat(chatId);

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
          {clients.map(c=> (
            <div key={c._id} onClick={()=>openChat(c.chat)} className={`p-3 border-b hover:bg-surface cursor-pointer flex items-center gap-3 ${c.chat===activeChat? 'bg-surface' : ''}`}>
              <img src={(c.from||{}).picture} className="w-12 h-12 rounded-full" alt="client" />
              <div className="flex-1">
                <div className="font-semibold">{(c.from||{}).name}</div>
                <div className="text-sm text-gray-500 truncate">{c.lastMessage? c.lastMessage.content : 'No messages yet'}</div>
              </div>
            </div>
          ))}
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
          <input value={text} onChange={e=>setText(e.target.value)} placeholder="Type a message" className="flex-1 p-2 border rounded" />
          <button onClick={sendMessage} className="px-4 py-2 btn-gradient text-white rounded">Send</button>
        </div>
      </div>
    </div>
  );
};

export default MyClients;
