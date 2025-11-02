import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../Axios/axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../components/ToastProvider';
// papi is the AI backend axios instance (used for model answers)
import papi from '../Axios/paxios';
// Simple General Ask chat UI (not PDF-bound). Stores chats locally and attempts
// to persist to backend at /api/general-ask/save (optional). Uses /api/general-ask
// to get AI answers from the server's general knowledge base.
// const STORAGE_KEY = 'generalAsk:chats:v1';
const makeId = () => `gch-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

const GeneralAsk = () => {
  // using server-authenticated axios instance `api`
  const [chats, setChats] = useState([]); // { id, title, messages: [{role:'user'|'assistant', text, createdAt}], updated }
  const [activeChatId, setActiveChatId] = useState(null);
  const [autoSendRequest, setAutoSendRequest] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [followUps, setFollowUps] = useState([]);
  const listRef = useRef(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const ACTIVE_CHAT_KEY = 'generalAsk:activeChatId';
  const toast = useToast();

  // helper to set active chat and persist selection across reloads
  const setActive = useCallback((id) => {
    setActiveChatId(id);
    try {
      if (id) localStorage.setItem(ACTIVE_CHAT_KEY, id);
      else localStorage.removeItem(ACTIVE_CHAT_KEY);
    } catch (e) {
      // ignore
    }
  }, []);

  const openChat = useCallback((id) => {
    setActive(id);
    // load historical messages for this chat from backend if possible
    (async () => {
      try {
        const res = await api.get(`/api/messages/${id}?_=${Date.now()}`);
        const msgs = (res && res.data && res.data.messages) ? res.data.messages : [];
        // normalize messages into { role: 'user'|'assistant', text, createdAt }
        const mapped = msgs.map(m => ({ role: (m.role === 'ai' || m.role === 'response') ? 'assistant' : 'user', text: m.content, createdAt: m.createdAt || m.createdAt }));
        setChats(prev => prev.map(c => c.id === id ? { ...c, messages: mapped, updated: Date.now(), preview: mapped.length ? mapped[mapped.length-1].text : (c.preview || '') } : c));
      } catch (e) {
        // ignore — may be local-only chat
      }
    })();
  }, [setActive]);

  useEffect(()=>{
    (async () => {
      try {
        // try to load persisted chats from backend
        // add a cache-busting query to avoid receiving 304 Not Modified responses
        const res = await api.get('/api/general-ask/list?_=' + Date.now());
        const backendChats = (res && res.data && res.data.chats) ? res.data.chats : [];
        if (backendChats && backendChats.length) {
            const mapped = backendChats.map(c => ({ id: c._id, title: c.title || 'Quick Guide', messages: [], updated: c.updatedAt || c.createdAt, preview: c.lastMessageText || '' }));
            setChats(mapped);
            // restore previously-selected active chat if present
            const stored = (() => { try { return localStorage.getItem(ACTIVE_CHAT_KEY); } catch(e){ return null; } })();
            const pick = stored && mapped.find(m => String(m.id) === String(stored)) ? stored : mapped[0].id;
            setActive(pick);
            // load messages for selected chat
            try { openChat(pick); } catch(e) {}
            return;
          }
      } catch (e) {
        console.warn('list general chats failed', e);
        // do not fall back to local storage — this UI relies on server persistence
      }
    })();
  }, [openChat, setActive]);

  // Handle incoming navigation state: startQuestion + chatId from Home quick guide
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const st = location?.state || null;
    if (!st) return;
    const { startQuestion, chatId } = st;
    if (!startQuestion) return;
    (async () => {
      try {
        // If chatId provided, set it as active (and create a stub entry)
        if (chatId) {
          const stub = { id: chatId, title: 'Quick Guide', messages: [], updated: Date.now(), isNew: true };
          setChats(prev => [stub, ...prev]);
          setActive(chatId);
          setQuery(startQuestion);
          // schedule auto-send when active chat becomes available
          setAutoSendRequest({ chatId, question: startQuestion });
        } else {
          // no chatId: create via existing create flow then send
          try {
            const r = await api.post('/api/general-ask/create', { title: startQuestion.slice(0,60) });
            const c = r?.data?.chat;
            if (c && c._id) {
              const newChat = { id: c._id, title: c.title || 'Quick Guide', messages: [], updated: Date.now(), isNew: true };
              setChats(prev => [newChat, ...prev]);
              setActive(c._id);
              setQuery(startQuestion);
              setAutoSendRequest({ chatId: c._id, question: startQuestion });
            }
          } catch (e) {
            // fallback: just set query and let user press Ask
            setQuery(startQuestion);
          }
        }
      } catch (e) {
        console.warn('auto-start quick guide failed', e);
      } finally {
        // clear navigation state so repeated mounts don't resend
        try { navigate(location.pathname, { replace: true }); } catch(e) {}
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // Auto-send handler: when an autoSendRequest is set and the activeChatId becomes available, send the question
  // Keep a stable ref to the latest sendQuery implementation so the auto-send
  // effect can call it without needing it in the dependency array.
  const sendQueryRef = useRef(null);

  useEffect(() => {
    if (!autoSendRequest) return;
    const { chatId, question } = autoSendRequest;
    // If a specific chatId was requested, wait until activeChatId matches it
    if (chatId) {
      if (String(activeChatId) === String(chatId)) {
        // send only if query has been set
        try { if (question) { setQuery(question); sendQueryRef.current && sendQueryRef.current(); } } catch (e) { console.warn(e); }
        setAutoSendRequest(null);
      }
    } else {
      // no specific chatId required: if any activeChatId is present, send
      if (activeChatId) {
        try { if (question) { setQuery(question); sendQueryRef.current && sendQueryRef.current(); } } catch (e) { console.warn(e); }
        setAutoSendRequest(null);
      }
    }
  }, [autoSendRequest, activeChatId]);

  const createNew = () => {
    // create on backend to obtain persistent chat id
    (async () => {
      try {
        const res = await api.post('/api/general-ask/create', { title: 'Quick Guide' });
        const chat = res.data && res.data.chat ? res.data.chat : null;
        if (chat && chat._id) {
          // mark as new so first question can become the chat title
          const c = { id: chat._id, title: chat.title || 'Quick Guide', messages: [], updated: Date.now(), isNew: true };
          setChats(prev => [c, ...prev]);
          setActive(chat._id);
          // focus the input so user can type the first question
          setTimeout(() => { try { inputRef.current?.focus(); } catch(e) {} }, 50);
          return;
        }
      } catch (e) {
        console.error('create backend chat failed', e);
        toast.error('Failed to create a new conversation on the server. Please try again.');
        return;
      }
    })();
  };

  const activeChat = chats.find(c => c.id === activeChatId) || null;

  // Simple safe formatter: escape HTML, convert **bold** to <strong> and preserve line breaks.
  const escapeHtml = (unsafe) => {
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const formatMessageToHtml = (text) => {
    if (!text && text !== 0) return '';
    const escaped = escapeHtml(text);
    // Convert **bold** (markdown-like) to <strong>
    const bolded = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // preserve line breaks
    return bolded.replace(/\n/g, '<br/>');
  };
  

  // auto-scroll when messages or thinking state changes
  useEffect(() => {
    try { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); } catch (e) { }
  }, [chats, isAiThinking]);

  const sendQuery = async () => {
    const txt = (query || '').trim();
    if (!txt) return;
    setQuery('');
    setLoading(true);

    try {
      // ensure we have a chatId (create if necessary)
      let chatId = activeChatId;
      // track if we create a new chat during this send so we can decide rename behavior
      let createdNewChatLocal = null;
      if (!chatId) {
        try {
          const resCreate = await api.post('/api/general-ask/create', { title: 'Quick Guide' });
          const chat = resCreate && resCreate.data && resCreate.data.chat ? resCreate.data.chat : null;
            if (chat && chat._id) {
            chatId = chat._id;
            const newChat = { id: chatId, title: chat.title || 'Quick Guide', messages: [], updated: Date.now(), preview: '' };
            setChats(prev => [newChat, ...prev]);
            setActive(chatId);
            createdNewChatLocal = newChat;
          }
        } catch (e) {
          // fallback to local id
          const id = makeId();
          chatId = id;
          const newChat = { id, title: 'New Conversation', messages: [], updated: Date.now(), preview: '' };
          // local fallback chat is treated as new
          newChat.isNew = true;
          setChats(prev => [newChat, ...prev]);
          setActive(id);
          createdNewChatLocal = newChat;
          setTimeout(() => { try { inputRef.current?.focus(); } catch(e) {} }, 50);
        }
      }

      // Determine whether this should trigger a rename: prefer the freshly-created local chat object
      const chatObj = createdNewChatLocal || chats.find(c => c.id === chatId) || null;
      const prevMessageCount = (chatObj && Array.isArray(chatObj.messages)) ? chatObj.messages.length : 0;
      const shouldRenameOnFirstMessage = !!(chatObj && chatObj.isNew && prevMessageCount === 0);

      // optimistic user message
      const userMsg = { role: 'user', text: txt, createdAt: new Date().toISOString(), _id: `optimistic-${Date.now()}` };
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, userMsg], updated: Date.now(), preview: txt } : c));
  setIsAiThinking(true);

        // call the AI backend (papi) to get an answer, then persist to storage backend (api)
      const payload = { query: txt, output_language: 'en', chatId };
      const papiRes = await papi.post('/api/general-ask', payload);
      console.log('papi response', papiRes && papiRes.data ? papiRes.data : papiRes);
      // extract answer from common response shapes (res.data.answer OR res.data.data.answer)
      let answerText = '';
      try {
        if (papiRes && papiRes.data) {
          if (typeof papiRes.data.answer === 'string') answerText = papiRes.data.answer;
          else if (papiRes.data.data && typeof papiRes.data.data.answer === 'string') answerText = papiRes.data.data.answer;
          else if (papiRes.data.data && typeof papiRes.data.data.response === 'string') answerText = papiRes.data.data.response;
          else if (typeof papiRes.data === 'string') answerText = String(papiRes.data);
          else if (papiRes.data && papiRes.data.data && typeof papiRes.data.data === 'string') answerText = papiRes.data.data;
        }
      } catch (e) {
        console.warn('failed to parse papi response', e);
      }

      // persist both user and assistant messages to storage backend
      try {
        await api.post('/api/general-ask/save', { chatId, messages: [{ role: 'user', text: txt }, { role: 'assistant', text: answerText }] });
      } catch (saveErr) {
        console.warn('failed to save messages via api', saveErr);
      }

      const returnedChatId = null; // storage create/save flow will keep same chatId

      // reconcile chat id if server returned a canonical id
      if (returnedChatId && returnedChatId !== chatId) {
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, id: returnedChatId } : c));
        chatId = returnedChatId;
        setActive(returnedChatId);
      }

      // fetch canonical persisted messages from server and replace local messages for this chat
        try {
          // After persisting, fetch canonical messages from storage backend
          const msgsRes = await api.get(`/api/messages/${chatId}?_=${Date.now()}`);
          const msgs = (msgsRes && msgsRes.data && msgsRes.data.messages) ? msgsRes.data.messages : [];

          if (!msgs || msgs.length === 0) {
            // No persisted messages available; use assistant answer from papi as fallback
            const assistantMsg = { role: 'assistant', text: String(answerText || ''), createdAt: new Date().toISOString() };
            setChats(prev => {
              const updated = prev.map(c => c.id === chatId ? { ...c, messages: [...(c.messages || []), assistantMsg], updated: Date.now(), preview: assistantMsg.text } : c);
              const picked = updated.find(c => c.id === chatId);
              const others = updated.filter(c => c.id !== chatId);
              return [picked, ...others];
            });
            // record follow ups if provided by papi
            setFollowUps((papiRes && papiRes.data && (papiRes.data.followups || papiRes.data.follow_up_questions)) ? (papiRes.data.followups || papiRes.data.follow_up_questions) : []);
          } else {
            const mapped = msgs.map(m => ({ role: (m.role === 'ai' || m.role === 'response') ? 'assistant' : 'user', text: m.content, createdAt: m.createdAt || m.createdAt }));
            setChats(prev => {
              const updated = prev.map(c => c.id === chatId ? { ...c, messages: mapped, updated: Date.now(), preview: mapped.length ? mapped[mapped.length-1].text : (c.preview || '') } : c);
              // promote to top
              const picked = updated.find(c => c.id === chatId);
              const others = updated.filter(c => c.id !== chatId);
              // record follow ups from the AI response if present
              setFollowUps((papiRes && papiRes.data && (papiRes.data.followups || papiRes.data.follow_up_questions)) ? (papiRes.data.followups || papiRes.data.follow_up_questions) : []);
              // if this chat was just created and flagged as new, update its title to the first question
              const firstQuestion = txt;
              setTimeout(async () => {
                try {
                  // mark as no longer new; if it was new AND this is the first message, update the title
                  setChats(prev2 => prev2.map(ch => ch.id === chatId ? { ...ch, isNew: false, title: (ch.isNew && shouldRenameOnFirstMessage) ? firstQuestion : ch.title } : ch));
                  // persist title to backend only when this was the first message for a new chat
                  if (shouldRenameOnFirstMessage) {
                    await api.post('/api/general-ask/rename', { chatId, title: firstQuestion });
                  }
                } catch (renameErr) {
                  // non-fatal
                  console.warn('rename chat failed', renameErr);
                }
              }, 100);
              return picked ? [picked, ...others] : updated;
            });
          }
        } catch (e) {
          // if fetching messages failed, fall back to optimistic assistant message
          const assistantMsg = { role: 'assistant', text: String(answerText || ''), createdAt: new Date().toISOString() };
          setChats(prev => {
            const updated = prev.map(c => c.id === chatId ? { ...c, messages: [...(c.messages || []), assistantMsg], updated: Date.now(), preview: assistantMsg.text } : c);
            const picked = updated.find(c => c.id === chatId);
            const others = updated.filter(c => c.id !== chatId);
            return [picked, ...others];
          });
          setFollowUps((papiRes && papiRes.data && (papiRes.data.followups || papiRes.data.follow_up_questions)) ? (papiRes.data.followups || papiRes.data.follow_up_questions) : []);
        }

    } catch (err) {
      console.error('general ask failed', err);
      const errMsg = { role: 'assistant', text: 'Error: failed to get an answer. Please try again.', createdAt: new Date().toISOString() };
      setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, errMsg], updated: Date.now() } : c));
    } finally {
      setLoading(false);
      setIsAiThinking(false);
    }
  };

  // keep ref to latest sendQuery implementation (placed after sendQuery is defined)
  // assign directly so the ref always points to the latest function without
  // creating a useEffect dependency on the changing function reference.
  sendQueryRef.current = sendQuery;

  const deleteChat = async (id) => {
    try {
      // attempt server-side delete
      await api.delete(`/api/delete/${id}`);
    } catch (e) {
      // ignore server errors, still remove locally
    }
    setChats(prev => {
      const updated = prev.filter(c => c.id !== id);
      if (activeChatId === id) {
        const next = updated.length ? updated[0].id : null;
        setActive(next);
      }
      return updated;
    });
  };

  return (
    <div className="h-[100vh] flex bg-[var(--bg)] overflow-hidden rounded min-h-0">
      <div className="w-80 border-r flex flex-col min-h-0 h-full bg-[var(--panel)]" style={{borderColor:'var(--palette-3)'}}>
        <div className="p-3 border-b flex items-center justify-between">
          <div className="font-semibold">Quick Guide</div>
          <div>
            <button onClick={createNew} className="px-2 py-1 bg-green-600 text-white rounded">New</button>
          </div>
        </div>
        <div className="p-2">
          <input placeholder="Search conversations" className="w-full p-2 border rounded text-sm" />
        </div>
        {/* Vertical scroll list (Quick Guide) */}
        <div className="flex-1 overflow-y-auto" ref={listRef}>
          {chats.length === 0 && (
            <div className="p-4 text-sm text-[var(--muted)]">No saved guides yet. Click New to start.</div>
          )}
          {chats.map(c => {
            const last = c.preview || (c.messages && c.messages.length ? c.messages[c.messages.length -1].text : 'No messages yet');
            // normalize whitespace and limit length so the Delete button stays visible
            const normalized = (last || '').replace(/\s+/g, ' ').trim();
            const previewShort = normalized.length > 30 ? normalized.slice(0, 27) + '...' : normalized;
            return (
              <div key={c.id} className={`p-2 border-b hover:bg-[var(--palette-4)] cursor-pointer flex items-center gap-3 ${c.id===activeChatId? 'bg-[var(--palette-4)]' : ''}`} onClick={()=>openChat(c.id)}>
                <div className="flex-1">
                  <div className="font-semibold text-[var(--text)] truncate" title={c.title}>{c.title || 'Untitled'}</div>
                  <div className="text-sm text-[var(--muted)] truncate" title={normalized}>{previewShort}</div>
                </div>
                <div className="flex flex-col items-end" style={{width: 90}}>
                  <div className="text-xs text-[var(--muted)]">{new Date(c.updated || Date.now()).toLocaleDateString()}</div>
                  <button onClick={(e)=>{ e.stopPropagation(); deleteChat(c.id); }} className="mt-1 text-xs text-red-500">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden h-full">
        <div className="flex-none p-3 border-b flex items-center gap-3 bg-white" style={{borderColor:'var(--border)'}}>
          <div className="font-semibold">{activeChat ? (activeChat.title || 'Conversation') : 'Quick Guide'}</div>
          {/* <div className="text-xs text-[var(--muted)] ml-2">Ask general legal questions (answers come from the knowledge base)</div> */}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 bg-[var(--palette-4)]">
          {activeChat ? (
            (activeChat.messages || []).map((m, idx) => (
              <div key={idx} className={`mb-3 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`${m.role === 'user' ? 'bg-[var(--palette-1)] text-white rounded-tl-lg rounded-br-lg rounded-bl-lg' : 'bg-[var(--panel)] text-[var(--text)] rounded-tr-lg rounded-br-lg rounded-bl-lg'} max-w-[70%] px-3 py-2`}>
                  <div className="break-words whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatMessageToHtml(m.text) }} />
                </div>
              </div>
            ))
          ) : null}

          {/* anchor for autoscroll */}
          <div ref={chatEndRef} />

          {/* AI thinking indicator */}
          {activeChat && isAiThinking && (
            <div className="mb-3 flex justify-start">
              <div className="bg-[var(--panel)] text-[var(--text)] rounded-tr-lg rounded-br-lg rounded-bl-lg max-w-[60%] px-3 py-2">
                <div className="text-sm">Thinking<span className="animate-pulse">...</span></div>
              </div>
            </div>
          )}
        </div>
        {/* follow-up suggestions */}
        {followUps && followUps.length > 0 && (
          <div className="p-2 border-t bg-[var(--panel)]" style={{borderColor:'var(--border)'}}>
            <div className="text-sm text-[var(--muted)] mb-2">Follow-up suggestions:</div>
            <div className="flex gap-2 flex-wrap">
              {followUps.map((f, i) => (
                <button key={i} onClick={() => { setQuery(f); }} className="px-3 py-1 bg-white rounded text-sm border">{f}</button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-none p-2 border-t flex items-center gap-2 flex-shrink-0" style={{borderColor:'var(--border)', background: 'var(--panel)'}}>
          <input
            ref={inputRef}
            value={query}
            onChange={e=>setQuery(e.target.value)}
            placeholder="Ask a legal question..."
            className="flex-1 p-2 border rounded h-9 bg-white text-[var(--text)]"
            onKeyDown={(e) => {
              // Enter to send; Shift+Enter to keep a newline (if input becomes textarea)
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!loading) sendQuery();
              }
            }}
          />
          <button onClick={sendQuery} disabled={loading} className="px-3 py-1 btn-primary text-white rounded">{loading ? 'Asking...' : 'Ask'}</button>
        </div>
      </div>
    </div>
  );
};

export default GeneralAsk;
