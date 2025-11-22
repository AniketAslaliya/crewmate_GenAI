import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../Axios/axios';
import { initSocket } from '../utils/socket';
import useAuthStore from '../context/AuthContext';
import InitialAvatar from '../components/InitialAvatar';
import { useGuestAccess } from '../hooks/useGuestAccess';
import GuestAccessModal from '../components/GuestAccessModal';

// WhatsApp-like chat view: left sidebar with connections, right pane with messages
const ChatView = () => {
  const { id } = useParams(); // chat id
  const navigate = useNavigate();
  const user = useAuthStore(s=>s.user);

  const [connections, setConnections] = useState([]); // { _id, chat, to/from, lastMessage, unread }
  const [activeChat, setActiveChat] = useState(id || null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef(null);
  const socketRef = useRef(null);
  const scrollRef = useRef(null);
  const activeChatRef = useRef(activeChat);

  const isLawyer = user?.role === 'lawyer';
  const location = useLocation();
  const qp = new URLSearchParams(location.search);
  const target = qp.get('target'); // optional: 'lawyer' or 'client'
  const { checkGuestAccess, showGuestModal, closeGuestModal, blockedFeature } = useGuestAccess();

  // Helper: normalize different possible shapes of lastMessage coming from the API
  const extractLastMessage = (lm) => {
    if (!lm) return null;
    let m = lm;
    // If API returns an array, take the last item
    if (Array.isArray(m)) m = m[m.length - 1] || null;
    // If wrapper object { lastMessage: {...} }
    if (m && m.lastMessage) m = m.lastMessage;
    if (!m) return null;
    const content = m.content || m.text || m.message || m.body || m.msg || (typeof m === 'string' ? m : null);
    const created = m.createdAt || m.created_at || m.created || m.timestamp || m.time || null;
    return { content, created };
  };

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
            unread: c.unread || 0,
            raw: c // keep the original connection for fallbacks when peer may be only an id
          };
        });

        // If a target filter is provided, filter normalized list by peer role.
        // Some backend responses may include only ids on `to`/`from` instead of full user objects,
        // so be resilient: prefer peer.role when available, otherwise inspect raw.from/raw.to or
        // fall back to assumptions based on the current user's role and which side contains the peer.
        let filtered = normalized;
        if (target === 'lawyer') {
          filtered = normalized.filter(n => {
            if (n.peer && typeof n.peer === 'object' && n.peer.role) return n.peer.role === 'lawyer';
            // if raw.to exists and current user is not a lawyer, it's likely the lawyer side
            if (!isLawyer && n.raw && n.raw.to) return true;
            // if raw.from exists and current user is a lawyer, the from side is likely the client, so skip
            if (isLawyer && n.raw && n.raw.to && typeof n.raw.to === 'object' && n.raw.to.role === 'lawyer') return true;
            return false;
          });
        }
        if (target === 'client' || target === 'helpseeker') {
          filtered = normalized.filter(n => {
            if (n.peer && typeof n.peer === 'object' && n.peer.role) return n.peer.role !== 'lawyer';
            // if current user is lawyer and raw.from exists, treat from as the client
            if (isLawyer && n.raw && n.raw.from) return true;
            // otherwise be conservative and exclude entries that look like lawyer-only
            return false;
          });
        }

        // If no matching peers found, do not redirect — show a friendly empty state instead
        setConnections(filtered);
      }catch(e){ console.error(e); }
    };
    fetchConnections();
  }, [isLawyer, navigate, target]);

  // init socket once on mount
  useEffect(()=>{
    const s = initSocket();
    socketRef.current = s;

    const onConnect = () => {
      // console.log('socket connected');
    };
    s.on('connect', onConnect);

    const onConnectError = (err) => console.warn('socket connect_error', err);
    const onReconnectAttempt = (count) => console.debug('socket reconnect attempt', count);
    s.on('connect_error', onConnectError);
    s.on('reconnect_attempt', onReconnectAttempt);

    return ()=>{
      // remove handlers we added (do not disconnect global socket)
      s.off('connect', onConnect);
      s.off('connect_error', onConnectError);
      s.off('reconnect_attempt', onReconnectAttempt);
    };
  }, []);

  // keep a ref in sync with activeChat so listeners can read latest value without re-registering handlers
  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);

  // single new_message listener (registered once) that uses activeChatRef to decide what to do
  useEffect(() => {
    const s = socketRef.current || initSocket();
    socketRef.current = s;

    const handler = (msg) => {
      const currentActive = activeChatRef.current;
      if (msg.chat === currentActive) {
        setMessages(prev => {
          if (msg.clientTempId) {
            const mapped = prev.map(m => m._id === msg.clientTempId ? msg : m);
            const uniq = [];
            const seen = new Set();
            for (const m of mapped) {
              if (!seen.has(m._id)) { uniq.push(m); seen.add(m._id); }
            }
            return uniq;
          }
          if (prev.some(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });

        setConnections(prev => prev.map(p => p.chat === msg.chat ? {...p, lastMessage: msg, unread: 0} : p));
      } else {
        setConnections(prev => prev.map(p => p.chat === msg.chat ? {...p, lastMessage: msg, unread: (p.unread||0)+1} : p));
      }
    };

    s.on('new_message', handler);
    return () => { s.off('new_message', handler); };
  }, []);

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
    const controller = new AbortController();
    const fetchMessages = async ()=>{
      const chatId = activeChat;
      try{
        const res = await api.get(`/api/messages/${chatId}`, { signal: controller.signal });
        // ignore if activeChat changed during the request
        if (activeChatRef.current !== chatId) return;
        setMessages(res.data.messages || []);
        // join socket room
        socketRef.current?.emit('join', chatId);
        // reset unread count locally
        setConnections(prev => prev.map(p => p.chat === chatId ? {...p, unread: 0} : p));
        // update URL only if it's different
        if (location.pathname !== `/chat/${chatId}`) navigate(`/chat/${chatId}`, { replace: true });
      }catch(e){
        if (e?.name === 'CanceledError' || e?.message === 'canceled') return; // aborted
        console.error(e);
      }
    };
    fetchMessages();

    return ()=>{
      // capture chatId to leave the correct room
      const chatToLeave = activeChat;
      try{ socketRef.current?.emit('leave', chatToLeave); }catch(e){}
      controller.abort();
    };
  }, [activeChat, navigate, location.pathname]);

  // if route param id changes, set active chat
  useEffect(()=>{ if(id) setActiveChat(id); }, [id]);

  // scroll to bottom on message list change
  useEffect(()=>{ if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const openChat = (chatId)=>{ setActiveChat(typeof chatId === 'object' ? chatId._id : chatId); };

  // Filter connections based on search query
  const filteredConnections = connections.filter(c => {
    if (!searchQuery.trim()) return true;
    const peerName = c.peer?.name || '';
    return peerName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendMessage = async ()=>{
    if (!checkGuestAccess('Send Message')) return;
    if((!text.trim() && !selectedFile) || !activeChat) return;
    
    setUploading(true);
    const messageContent = text.trim();
    const payload = { chatId: activeChat, content: messageContent, userId: user?._id, role: isLawyer ? 'lawyer' : 'user' };
    
    // optimistic UI
    const temp = { 
      _id: `tmp-${Date.now()}`, 
      chat: activeChat, 
      content: messageContent, 
      user: user?._id, 
      createdAt: new Date().toISOString(),
      attachment: selectedFile ? {
        filename: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type
      } : null
    };
    setMessages(prev => [...prev, temp]);
    setConnections(prev => prev.map(p => p.chat === activeChat ? {...p, lastMessage: {...temp}} : p));
    setText('');
    const fileToSend = selectedFile;
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    try{
      const clientTempId = temp._id;
      
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('chatId', activeChat);
      formData.append('role', payload.role);
      if (messageContent) formData.append('content', messageContent);
      if (fileToSend) formData.append('file', fileToSend);
      
      // Persist first via REST; server will save and emit via socket to other clients.
      const res = await api.post('/api/messages', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
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
      alert('Failed to send message. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Lawyers may use the chat UI just like helpseekers. (No early return.)

  // Mobile view (< 768px)
  const MobileView = () => {
    if (activeChat) {
      const conn = connections.find(x => x.chat === activeChat);
      return (
        <div className="h-full flex flex-col bg-[var(--bg)] overflow-hidden">
          {/* Fixed Mobile Header */}
          <div className="flex-none p-3 border-b flex items-center gap-3 bg-white shadow-sm z-10" style={{borderColor:'var(--border)'}}>
            <button 
              onClick={() => { setActiveChat(null); navigate('/chats'); }} 
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0" 
              aria-label="Back to chats"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {conn?.peer?.profileImage?.gcsUrl || conn?.peer?.picture ? (
              <img
                src={conn?.peer?.profileImage?.gcsUrl || conn?.peer?.picture}
                alt={conn?.peer?.name}
                className="w-9 h-9 rounded-full border-2 border-blue-100 shadow-sm flex-shrink-0 object-cover"
                onError={e => { e.target.style.display = 'none'; e.target.parentNode.querySelector('.chatview-fallback-avatar').style.display = 'block'; }}
              />
            ) : null}
            <span className="chatview-fallback-avatar" style={{display: (!conn?.peer?.profileImage?.gcsUrl && !conn?.peer?.picture) ? 'block' : 'none'}}>
              <InitialAvatar name={conn?.peer?.name} className="w-9 h-9 rounded-full border-2 border-blue-100 shadow-sm flex-shrink-0" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900 truncate">{conn?.peer?.name}</div>
              <div className="text-xs text-gray-500 truncate">{conn?.peer?.specialties || (isLawyer ? 'Client' : 'Lawyer')}</div>
            </div>
          </div>

          {/* Scrollable Messages Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 bg-[var(--palette-4)]">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-gray-700 mb-2">No Messages Yet</h3>
                <p className="text-sm text-gray-500">Start the conversation by sending a message below</p>
              </div>
            ) : (
              messages.map(m => (
                <div key={m._id} className={`mb-3 flex ${m.user === user?._id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`${m.user === user?._id ? 'bg-[var(--palette-1)] text-white rounded-tl-lg rounded-br-lg rounded-bl-lg' : 'bg-[var(--panel)] text-[var(--text)] rounded-tr-lg rounded-br-lg rounded-bl-lg'} max-w-[80%] px-3 py-2`}> 
                    {m.attachment && (
                      <div className="mb-2">
                        {m.attachment.fileType?.startsWith('image/') ? (
                          <a href={m.attachment.url} target="_blank" rel="noopener noreferrer">
                            <img 
                              src={m.attachment.url} 
                              alt={m.attachment.filename} 
                              className="max-w-full rounded-lg max-h-48 object-contain cursor-pointer hover:opacity-90"
                            />
                          </a>
                        ) : (
                          <a 
                            href={m.attachment.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 p-2 rounded ${m.user === user?._id ? 'bg-white/20' : 'bg-gray-100'} hover:opacity-80 transition-opacity`}
                          >
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate">{m.attachment.filename}</div>
                              <div className="text-xs opacity-75">{(m.attachment.fileSize / 1024).toFixed(1)} KB</div>
                            </div>
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </a>
                        )}
                      </div>
                    )}
                    {m.content && <div className="break-words text-sm">{m.content}</div>}
                    <span className={`text-xs flex mt-1 ${m.user === user?._id ? 'justify-end' : 'justify-end'} opacity-75`}>
                      {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Fixed Input Footer */}
          <div className="flex-none border-t bg-white z-10" style={{borderColor:'var(--border)'}}>
            {selectedFile && (
              <div className="px-3 pt-2 pb-1 border-b" style={{borderColor:'var(--border)'}}>
                <div className="flex items-center gap-2 bg-blue-50 p-2 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</div>
                    <div className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</div>
                  </div>
                  <button 
                    onClick={removeSelectedFile}
                    className="p-1 hover:bg-red-100 rounded-full text-red-600 flex-shrink-0"
                    aria-label="Remove file"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            
            <div className="p-2 flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,application/pdf,.doc,.docx,.txt"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-[var(--muted)] hover:bg-[var(--palette-4)] rounded flex-shrink-0"
                disabled={uploading}
                aria-label="Attach file"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              
              <input
                value={text}
                onChange={e=>setText(e.target.value)}
                placeholder="Type a message"
                className="flex-1 p-2 border rounded-lg text-sm bg-white text-[var(--text)] placeholder-[var(--muted)]"
                disabled={uploading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button 
                onClick={sendMessage} 
                className="px-3 py-2 btn-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm flex-shrink-0"
                disabled={uploading || (!text.trim() && !selectedFile)}
              >
                {uploading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Mobile Conversations List
    return (
      <div className="h-full flex flex-col bg-[var(--bg)] overflow-hidden">
        {/* Fixed Header */}
        <div className="flex-none p-4 border-b flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 z-10" style={{borderColor:'var(--border)'}}>
          {user?.profileImage?.gcsUrl || user?.picture ? (
            <img
              src={user?.profileImage?.gcsUrl || user?.picture}
              alt={user?.name}
              className="w-10 h-10 rounded-full border-2 border-white shadow-sm flex-shrink-0 object-cover"
              onError={e => { e.target.style.display = 'none'; e.target.parentNode.querySelector('.chatview-user-fallback-avatar').style.display = 'block'; }}
            />
          ) : null}
          <span className="chatview-user-fallback-avatar" style={{display: (!user?.profileImage?.gcsUrl && !user?.picture) ? 'block' : 'none'}}>
            <InitialAvatar name={user?.name} className="w-10 h-10 rounded-full border-2 border-white shadow-sm flex-shrink-0" />
          </span>
          <div>
            <div className="font-semibold text-gray-900">{user?.name}</div>
            <div className="text-xs text-gray-600 font-medium">{isLawyer ? '⚖️ Lawyer' : '👤 Helpseeker'}</div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex-none p-3 bg-white">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isLawyer ? "Search clients..." : "Search lawyers..."} 
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-[var(--text)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Connections List */}
        <div className="flex-1 overflow-y-auto bg-white">
          {filteredConnections.length === 0 && searchQuery ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-700 mb-2">No Results Found</h3>
              <p className="text-sm text-gray-500 mb-4">
                No {isLawyer ? 'clients' : 'lawyers'} match "{searchQuery}"
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Clear search
              </button>
            </div>
          ) : connections.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                {isLawyer ? 'No Client Connections Yet' : 'No Lawyer Connections Yet'}
              </h3>
              <p className="text-sm text-gray-600 mb-4 max-w-xs">
                {isLawyer 
                  ? 'When clients connect with you, their chats will appear here.' 
                  : 'Start by finding and connecting with a lawyer to get legal assistance.'}
              </p>
              {!isLawyer && (
                <button
                  onClick={() => navigate('/find-lawyer')}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg text-sm"
                >
                  Find Lawyers
                </button>
              )}
              {isLawyer && (
                <button
                  onClick={() => navigate('/lawyer/requests')}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg text-sm"
                >
                  View Requests
                </button>
              )}
            </div>
          ) : (
            filteredConnections.map(c => (
              <div 
                key={c.id} 
                onClick={()=>openChat(c.chat)} 
                className="p-3 border-b hover:bg-gray-50 active:bg-gray-100 cursor-pointer flex items-center gap-3 transition-all"
              >
                {c.peer?.profileImage?.gcsUrl || c.peer?.picture ? (
                  <img
                    src={c.peer?.profileImage?.gcsUrl || c.peer?.picture}
                    alt={c.peer?.name}
                    className="w-12 h-12 rounded-full border-2 border-white shadow-sm flex-shrink-0 object-cover"
                    onError={e => { e.target.style.display = 'none'; e.target.parentNode.querySelector('.chatview-conn-fallback-avatar').style.display = 'block'; }}
                  />
                ) : null}
                <span className="chatview-conn-fallback-avatar" style={{display: (!c.peer?.profileImage?.gcsUrl && !c.peer?.picture) ? 'block' : 'none'}}>
                  <InitialAvatar name={c.peer?.name} className="w-12 h-12 rounded-full border-2 border-white shadow-sm flex-shrink-0" />
                </span>
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900 truncate">{c.peer?.name || 'Unknown'}</h4>
                  {c.unread > 0 && (
                    <div className="bg-red-500 text-white text-xs font-semibold px-2 py-1 rounded-full ml-2 flex-shrink-0">
                      {c.unread}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  // Desktop/Tablet view (>= 768px)
  return (
    <>
      {/* Mobile View */}
      <div className="md:hidden fixed inset-0 top-12 z-20 bg-white">
        <MobileView />
      </div>

      {/* Desktop/Tablet View */}
      <div className="hidden md:block h-full">
        <div className="h-full flex bg-[var(--bg)] overflow-hidden rounded min-h-0 overflow-x-hidden">
          {/* Conversations list (left) */}
          <div className="flex w-80 border-r flex-col min-h-0 h-full bg-[var(--panel)]" style={{borderColor:'var(--palette-3)'}}>
            <div className="p-4 border-b flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50" style={{borderColor:'var(--border)'}}>
      {user?.profileImage?.gcsUrl || user?.picture ? (
        <img
          src={user?.profileImage?.gcsUrl || user?.picture}
          alt={user?.name}
          className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover"
        />
      ) : (
        <InitialAvatar name={user?.name} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
      )}
          <div>
            <div className="font-semibold text-gray-900">{user?.name}</div>
            <div className="text-xs text-gray-600 font-medium">{isLawyer ? '⚖️ Lawyer' : '👤 Helpseeker'}</div>
          </div>
        </div>
        <div className="p-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isLawyer ? "Search clients..." : "Search lawyers..."} 
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-[var(--text)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConnections.length === 0 && searchQuery ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Results Found</h3>
              <p className="text-sm text-gray-500 mb-4">
                No {isLawyer ? 'clients' : 'lawyers'} match "{searchQuery}"
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Clear search
              </button>
            </div>
          ) : connections.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {isLawyer ? 'No Client Connections Yet' : 'No Lawyer Connections Yet'}
              </h3>
              <p className="text-sm text-gray-600 mb-4 max-w-xs">
                {isLawyer 
                  ? 'When clients connect with you, their chats will appear here.' 
                  : 'Start by finding and connecting with a lawyer to get legal assistance.'}
              </p>
              {!isLawyer && (
                <button
                  onClick={() => navigate('/find-lawyer')}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
                >
                  Find Lawyers
                </button>
              )}
              {isLawyer && (
                <button
                  onClick={() => navigate('/lawyer/requests')}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
                >
                  View Requests
                </button>
              )}
            </div>
          ) : (
            filteredConnections.map(c => (
              <div 
                key={c.id} 
                onClick={()=>openChat(c.chat)} 
                className={`p-3 border-b hover:bg-[var(--palette-4)] cursor-pointer flex items-center gap-3 transition-all ${
                  c.chat===activeChat ? 'bg-[var(--palette-4)] border-l-4 border-l-blue-600' : 'border-l-4 border-l-transparent'
                }`}
              >
                {c.peer?.profileImage?.gcsUrl || c.peer?.picture ? (
                  <img
                    src={c.peer?.profileImage?.gcsUrl || c.peer?.picture}
                    alt={c.peer?.name}
                    className="w-12 h-12 rounded-full border-2 border-white shadow-sm flex-shrink-0 object-cover"
                  />
                ) : (
                  <InitialAvatar name={c.peer?.name} className="w-12 h-12 rounded-full border-2 border-white shadow-sm flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <h4 className="font-semibold text-[var(--text)] truncate">{c.peer?.name || 'Unknown'}</h4>
                  {c.unread > 0 && (
                    <div className="bg-red-500 text-white text-xs font-semibold px-2 py-1 rounded-full ml-2 flex-shrink-0">
                      {c.unread}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Message thread (right) */}
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden h-full">
            {/* Desktop header */}
            <div className="flex flex-none p-4 border-b items-center gap-3 bg-white shadow-sm" style={{borderColor:'var(--border)'}}>
          {activeChat ? (
            (() => {
              const conn = connections.find(x=>x.chat===activeChat);
              return (
                  <>
                  {conn?.peer?.profileImage?.gcsUrl || conn?.peer?.picture ? (
                    <img
                      src={conn?.peer?.profileImage?.gcsUrl || conn?.peer?.picture}
                      alt={conn?.peer?.name}
                      className="w-10 h-10 rounded-full border-2 border-blue-100 shadow-sm object-cover"
                    />
                  ) : (
                    <InitialAvatar name={conn?.peer?.name} className="w-10 h-10 rounded-full border-2 border-blue-100 shadow-sm" />
                  )}
                  <div>
                    <div className="font-semibold text-gray-900">{conn?.peer?.name}</div>
                    <div className="text-xs text-gray-500">{conn?.peer?.specialties || (isLawyer ? 'Client' : 'Lawyer')}</div>
                  </div>
                </>
              );
            })()
          ) : (
            <div className="text-gray-400 text-sm">Select a conversation to start chatting</div>
          )}
        </div>

  {/* messages */}
  <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 bg-[var(--palette-4)]">
          {activeChat ? (
            messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No Messages Yet</h3>
                <p className="text-sm text-gray-500">Start the conversation by sending a message below</p>
              </div>
            ) : (
            messages.map(m => (
              <div key={m._id} className={`mb-3 flex ${m.user === user?._id ? 'justify-end' : 'justify-start'}`}>
                <div className={`${m.user === user?._id ? 'bg-[var(--palette-1)] text-white rounded-tl-lg rounded-br-lg rounded-bl-lg' : 'bg-[var(--panel)] text-[var(--text)] rounded-tr-lg rounded-br-lg rounded-bl-lg'} max-w-[70%] px-3 py-2`}> 
                  {m.attachment && (
                    <div className="mb-2">
                      {m.attachment.fileType?.startsWith('image/') ? (
                        <a href={m.attachment.url} target="_blank" rel="noopener noreferrer">
                          <img 
                            src={m.attachment.url} 
                            alt={m.attachment.filename} 
                            className="max-w-full rounded-lg max-h-64 object-contain cursor-pointer hover:opacity-90"
                          />
                        </a>
                      ) : (
                        <a 
                          href={m.attachment.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={`flex items-center gap-2 p-2 rounded ${m.user === user?._id ? 'bg-white/20' : 'bg-gray-100'} hover:opacity-80 transition-opacity`}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{m.attachment.filename}</div>
                            <div className="text-xs opacity-75">{(m.attachment.fileSize / 1024).toFixed(1)} KB</div>
                          </div>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </a>
                      )}
                    </div>
                  )}
                  {m.content && <div className="break-words">{m.content}</div>}
                    <span className={`text-xs flex ${m.user === user?._id ? 'bg-[var(--palette-1)] text-[var(--panel)] justify-end' : 'bg-[var(--panel)] text-neutral-400 justify-end'}`}>
                      {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                </div>
              </div>
            ))
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Select a Conversation</h3>
              <p className="text-sm text-gray-500 max-w-xs">
                {connections.length === 0 
                  ? (isLawyer ? 'No clients connected yet' : 'No lawyers connected yet')
                  : 'Choose a conversation from the left to start chatting'
                }
              </p>
            </div>
          )}
        </div>

        {/* input */}
  <div className="flex-none border-t flex-shrink-0" style={{borderColor:'var(--border)', background: 'var(--panel)'}}>
          {/* File preview */}
          {selectedFile && (
            <div className="px-3 pt-2 pb-1 border-b" style={{borderColor:'var(--border)'}}>
              <div className="flex items-center gap-2 bg-blue-50 p-2 rounded-lg">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</div>
                  <div className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</div>
                </div>
                <button 
                  onClick={removeSelectedFile}
                  className="p-1 hover:bg-red-100 rounded-full text-red-600"
                  aria-label="Remove file"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          
          <div className="p-2 flex items-center gap-2">
            {/* File attachment button */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,application/pdf,.doc,.docx,.txt"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-[var(--muted)] hover:bg-[var(--palette-4)] rounded"
              disabled={uploading}
              aria-label="Attach file"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            
            <input
              value={text}
              onChange={e=>setText(e.target.value)}
              placeholder="Type a message"
              className="flex-1 p-2 border rounded h-9 bg-white text-[var(--text)] placeholder-[var(--muted)]"
              disabled={uploading}
              onKeyDown={(e) => {
                // Press Enter to send; allow Shift+Enter for newline if ever changed to textarea
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button 
              onClick={sendMessage} 
              className="px-3 py-1 btn-primary text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={uploading || (!text.trim() && !selectedFile)}
            >
              {uploading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
          </div>
        </div>
      </div>

      <GuestAccessModal
        isOpen={showGuestModal}
        onClose={closeGuestModal}
        featureName={blockedFeature}
      />
    </>
  );
};

export default ChatView;
