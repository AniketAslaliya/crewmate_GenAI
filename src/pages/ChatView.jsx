import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../Axios/axios';
import { initSocket } from '../utils/socket';
import useAuthStore from '../context/AuthContext';

// WhatsApp-like chat view: left sidebar with connections, right pane with messages
const ChatView = () => {
  const { id } = useParams(); // chat id
  const navigate = useNavigate();
  const user = useAuthStore(s=>s.user);

  const [connections, setConnections] = useState([]); // { _id, chat, to/from, lastMessage, unread }
  const [activeChat, setActiveChat] = useState(id || null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const socketRef = useRef(null);
  const scrollRef = useRef(null);

  const isLawyer = user?.role === 'lawyer';

  // If the current user is a lawyer, redirect them to the lawyer requests page
  // Previously lawyers were redirected away from chat; allow lawyers to use the chat UI now.

  // load connections (accepted) depending on role
  useEffect(()=>{
    const fetchConnections = async ()=>{
      try{
        const route = isLawyer ? '/api/lawyers/connections/lawyer' : '/api/lawyers/connections/me';
        const res = await api.get(route);
        // normalize each connection to have: _id (request id), chat, peer (object with name,picture,_id), lastMessage, unread
        const normalized = (res.data.connections || []).map(c => {
          const peer = isLawyer ? c.from : c.to; // if I'm lawyer, peers are 'from' users; else 'to' are lawyers
          const chatId = (c.chat && typeof c.chat === 'object') ? c.chat._id : c.chat;
          return {
            id: c._id,
            chat: chatId,
            peer,
            lastMessage: c.lastMessage || null,
            unread: c.unread || 0
          };
        });
        setConnections(normalized);
      }catch(e){ console.error(e); }
    };
    fetchConnections();
  }, [isLawyer]);

  // init socket once
  useEffect(()=>{
    const s = initSocket();
    socketRef.current = s;

    s.on('connect', ()=>{
      // console.log('socket connected');
    });

  s.on('new_message', (msg)=>{
      // If the server echoed a clientTempId, reconcile optimistic message
      if(msg.chat === activeChat){
        setMessages(prev => {
          // If server echoed clientTempId, replace the optimistic message with server message
          if(msg.clientTempId){
            const mapped = prev.map(m => m._id === msg.clientTempId ? msg : m);
            // remove any duplicate _id entries while preserving order
            const uniq = [];
            const seen = new Set();
            for(const m of mapped){
              if(!seen.has(m._id)){
                uniq.push(m);
                seen.add(m._id);
              }
            }
            return uniq;
          }

          // If no clientTempId, skip appending if we already have this message (dedupe by _id)
          if(prev.some(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });

        // mark read - we can inform backend about read status (not implemented) or adjust unread locally
        setConnections(prev => prev.map(p => p.chat === msg.chat ? {...p, lastMessage: msg, unread: 0} : p));
      } else {
        // update lastMessage and increment unread for that chat
        setConnections(prev => prev.map(p => p.chat === msg.chat ? {...p, lastMessage: msg, unread: (p.unread||0)+1} : p));
      }
    });

    return ()=>{
      s.off('new_message');
      s.off('connect_error');
      s.off('reconnect_attempt');
      // do not force disconnect here; keep socket instance for reuse
    };
  }, [activeChat]);

  // ensure we re-join the active chat room after a reconnect
  useEffect(()=>{
    const s = socketRef.current;
    if(!s) return;
    const onReconnect = () => {
      if(activeChat) s.emit('join', activeChat);
    };
    s.on('reconnect', onReconnect);
    return ()=>{ s.off('reconnect', onReconnect); };
  }, [activeChat]);

  // load messages when activeChat changes
  useEffect(()=>{
    if(!activeChat) return;
    const fetchMessages = async ()=>{
      try{
        const res = await api.get(`/api/messages/${activeChat}`);
        setMessages(res.data.messages || []);
        // join socket room
        socketRef.current?.emit('join', activeChat);
        // reset unread count locally
        setConnections(prev => prev.map(p => p.chat === activeChat ? {...p, unread: 0} : p));
        // update URL
        navigate(`/chat/${activeChat}`, { replace: true });
      }catch(e){ console.error(e); }
    };
    fetchMessages();

    return ()=>{
      socketRef.current?.emit('leave', activeChat);
    };
  }, [activeChat, navigate]);

  // if route param id changes, set active chat
  useEffect(()=>{ if(id) setActiveChat(id); }, [id]);

  // scroll to bottom on message list change
  useEffect(()=>{ if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const openChat = (chatId)=>{ setActiveChat(typeof chatId === 'object' ? chatId._id : chatId); };

  const sendMessage = async ()=>{
    if(!text.trim() || !activeChat) return;
    const payload = { chatId: activeChat, content: text, userId: user?._id, role: isLawyer ? 'lawyer' : 'user' };
    // optimistic UI
    const temp = { _id: `tmp-${Date.now()}`, chat: activeChat, content: text, user: user?._id, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, temp]);
    setConnections(prev => prev.map(p => p.chat === activeChat ? {...p, lastMessage: {...temp}} : p));
    setText('');

    try{
      const clientTempId = temp._id;
      // Persist first via REST; server will save and emit via socket to other clients.
      const res = await api.post('/api/messages', { chatId: activeChat, content: payload.content, role: payload.role });
      const saved = res.data.message;
      // reconcile optimistic message with saved message
      setMessages(prev => {
        // replace optimistic by clientTempId if present
        let replaced = prev.map(m => m._id === clientTempId ? saved : m);
        // ensure we don't have duplicates with same saved._id
        if(!replaced.some(m => m._id === saved._id)){
          // if server _id wasn't present in list, append it (replace may have swapped tmp id)
          replaced = replaced.map(m => m._id === clientTempId ? saved : m);
          // if the optimistic wasn't found (race with socket), append
          if(!replaced.some(m => m._id === saved._id)) replaced = [...replaced, saved];
        }
        // final dedupe pass
        const uniq = [];
        const seen = new Set();
        for(const m of replaced){
          if(!seen.has(m._id)){
            uniq.push(m);
            seen.add(m._id);
          }
        }
        return uniq;
      });
      setConnections(prev => prev.map(p => p.chat === activeChat ? {...p, lastMessage: saved} : p));
    }catch(e){
      console.error('send failed', e);
      // remove optimistic message on failure
      setMessages(prev => prev.filter(m => m._id !== temp._id));
      setConnections(prev => prev.map(p => p.chat === activeChat ? {...p, lastMessage: null} : p));
    }
  };

  // Lawyers may use the chat UI just like helpseekers. (No early return.)

  return (
  <div className="h-full flex bg-[var(--color-bg)] border rounded overflow-hidden min-h-0">
      {/* Sidebar */}
  <div className="w-80 border-r flex flex-col min-h-0 h-full bg-card" style={{borderColor:'var(--palette-3)'}}>
        <div className="p-4 border-b flex items-center gap-3">
          <img src={user?.picture} className="w-10 h-10 rounded-full" alt="me" />
          <div>
            <div className="font-semibold">{user?.name}</div>
            <div className="text-xs text-[var(--color-muted)]">{isLawyer ? 'Lawyer' : 'Helpseeker'}</div>
          </div>
        </div>
        <div className="p-3">
          <input placeholder="Search or start new chat" className="w-full p-2 border rounded text-sm" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {connections.map(c => (
            <div key={c.id} onClick={()=>openChat(c.chat)} className={`p-3 border-b hover:bg-[var(--palette-4)] cursor-pointer flex items-center gap-3 ${c.chat===activeChat? 'bg-[var(--palette-4)]' : ''}`}>
              <img src={c.peer?.picture} className="w-12 h-12 rounded-full" alt="peer" />
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <div className="font-semibold">{c.peer?.name}</div>
                  <div className="text-xs text-[var(--color-muted)]">{c.lastMessage ? new Date(c.lastMessage.createdAt).toLocaleTimeString() : ''}</div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-sm text-[var(--color-muted)] truncate">{c.lastMessage ? c.lastMessage.content : 'No messages yet'}</div>
                  {c.unread > 0 && <div className="ml-2 bg-[var(--palette-1)] text-white text-xs px-2 rounded-full">{c.unread}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Pane */}
  <div className="flex-1 flex flex-col min-h-0 overflow-hidden h-full">
        {/* header */}
        <div className="p-4 border-b flex items-center gap-3" style={{borderColor:'var(--palette-3)'}}>
          {activeChat ? (
            (() => {
              const conn = connections.find(x=>x.chat===activeChat);
              return (
                <>
                  <img src={conn?.peer?.picture} className="w-10 h-10 rounded-full" alt="peer" />
                  <div>
                    <div className="font-semibold">{conn?.peer?.name}</div>
                    <div className="text-xs text-[var(--color-muted)]">{conn?.peer?.specialties || ''}</div>
                  </div>
                </>
              );
            })()
          ) : (
            <div className="text-gray-500">Select a conversation</div>
          )}
        </div>

  {/* messages */}
  <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 bg-[var(--palette-4)]">
          {activeChat ? (
            messages.map(m => (
              <div key={m._id} className={`mb-3 flex ${m.user === user?._id ? 'justify-end' : 'justify-start'}`}>
                <div className={`${m.user === user?._id ? 'bg-[var(--palette-1)] text-white' : 'bg-card text-[var(--color-primary)]'} max-w-[60%] px-4 py-2 rounded-lg shadow`}> 
                  <div className="break-words">{m.content}</div>
                  <div className="text-xs text-[var(--palette-4)] mt-1 text-right">{new Date(m.createdAt).toLocaleTimeString()}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-[var(--color-muted)]">No chat selected</div>
          )}
        </div>

        {/* input */}
        <div className="p-3 border-t flex items-center gap-2 flex-shrink-0 h-14" style={{borderColor:'var(--palette-3)'}}>
          <button className="p-2 text-[var(--color-muted)] hover:bg-[var(--palette-4)] rounded">😊</button>
          <input value={text} onChange={e=>setText(e.target.value)} placeholder="Type a message" className="flex-1 p-2 border rounded h-10" />
          <button onClick={sendMessage} className="px-4 py-2 btn-gradient text-white rounded">Send</button>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
