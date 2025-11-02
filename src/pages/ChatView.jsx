import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../Axios/axios';
import { initSocket } from '../utils/socket';
import useAuthStore from '../context/AuthContext';
import InitialAvatar from '../components/InitialAvatar';

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
  const activeChatRef = useRef(activeChat);

  const isLawyer = user?.role === 'lawyer';
  const location = useLocation();
  const qp = new URLSearchParams(location.search);
  const target = qp.get('target'); // optional: 'lawyer' or 'client'

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
  <div className="h-[100vh] flex bg-[var(--bg)] overflow-hidden rounded min-h-0 ">
      {/* Sidebar */}
  <div className="w-80 border-r flex flex-col min-h-0 h-full bg-[var(--panel)]" style={{borderColor:'var(--palette-3)'}}>
    <div className="p-3 border-b flex items-center gap-3 bg-[var(--panel)]" style={{borderColor:'var(--border)'}}>
      <InitialAvatar name={user?.name} className="w-9 h-9 rounded-full" />
          <div>
            <div className="font-semibold">{user?.name}</div>
            <div className="text-xs text-[var(--color-muted)]">{isLawyer ? 'Lawyer' : 'Helpseeker'}</div>
          </div>
        </div>
        <div className="p-2">
          <input placeholder="Search or start new chat" className="w-full p-2 border rounded text-sm bg-white/40 text-[var(--text)] placeholder-[var(--muted)]" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {connections.map(c => {
            const lm = extractLastMessage(c.lastMessage);
            const timeStr = lm && lm.created ? (() => { try { return new Date(lm.created).toLocaleTimeString(); } catch(e){ return ''; } })() : '';
            const preview = lm && lm.content ? lm.content : 'No messages yet';
            return (
              <div key={c.id} onClick={()=>openChat(c.chat)} className={`p-2 border-b hover:bg-[var(--palette-4)] cursor-pointer flex items-center gap-3 ${c.chat===activeChat? 'bg-[var(--palette-4)]' : ''}`}>
                <InitialAvatar name={c.peer?.name} className="w-10 h-10 rounded-full border" />
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <div className="font-semibold text-[var(--text)]">{c.peer?.name}</div>
                    <div className="text-xs text-[var(--muted)]">{timeStr}</div>
                  </div>
                  <div className="flex justify-between items-center">
                    {/* <div className="text-sm text-[var(--muted)] truncate">{preview}</div> */}
                    {c.unread > 0 && <div className="ml-2 bg-[var(--palette-1)] text-white text-xs px-2 rounded-full">{c.unread}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Chat Pane */}
  <div className="flex-1 flex flex-col min-h-0 overflow-hidden h-full ">
        {/* header (static) */}
  <div className="flex-none p-3 border-b flex items-center gap-3 bg-white" style={{borderColor:'var(--border)'}}>
          {activeChat ? (
            (() => {
              const conn = connections.find(x=>x.chat===activeChat);
              return (
                  <>
                  <InitialAvatar name={conn?.peer?.name} className="w-9 h-9 rounded-full" />
                  <div>
                    <div className="font-semibold">{conn?.peer?.name}</div>
                    <div className="text-xs text-[var(--muted)]">{conn?.peer?.specialties || ''}</div>
                  </div>
                </>
              );
            })()
          ) : (
            <div className="text-gray-500">Select a conversation</div>
          )}
        </div>

  {/* messages */}
  <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 bg-[var(--palette-4)]">
          {activeChat ? (
            messages.map(m => (
              <div key={m._id} className={`mb-3 flex ${m.user === user?._id ? 'justify-end' : 'justify-start'}`}>
                <div className={`${m.user === user?._id ? 'bg-[var(--palette-1)] text-white rounded-tl-lg rounded-br-lg rounded-bl-lg' : 'bg-[var(--panel)] text-[var(--text)] rounded-tr-lg rounded-br-lg rounded-bl-lg'} max-w-[70%] px-3 py-2`}> 
                  <div className="break-words">{m.content}</div>
                    <span className={`text-xs flex ${m.user === user?._id ? 'bg-[var(--palette-1)] text-[var(--panel)] justify-end' : 'bg-[var(--panel)] text-neutral-400 justify-end'}`}>
                      {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-[var(--color-muted)]">No chat selected</div>
          )}
        </div>

        {/* input */}
  <div className="flex-none p-2 border-t flex items-center gap-2 flex-shrink-0" style={{borderColor:'var(--border)', background: 'var(--panel)'}}>
          {/* <button className="p-2 text-[var(--muted)] hover:bg-[var(--palette-4)] rounded">😊</button> */}
          <input
            value={text}
            onChange={e=>setText(e.target.value)}
            placeholder="Type a message"
            className="flex-1 p-2 border rounded h-9 bg-white text-[var(--text)] placeholder-[var(--muted)]"
            onKeyDown={(e) => {
              // Press Enter to send; allow Shift+Enter for newline if ever changed to textarea
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button onClick={sendMessage} className="px-3 py-1 btn-primary text-white rounded">Send</button>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
