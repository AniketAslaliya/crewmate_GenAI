import { Chat } from "../models/Chat.js";
import { Message } from "../models/Message.js";
import crypto from "crypto";
import mongoose from 'mongoose';

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;
const SECRET_KEY = crypto.createHash("sha256").update(process.env.SECRET_KEY || "default-secret-key").digest();

const decrypt = (encryptedText) => {
  try {
    if (!encryptedText || typeof encryptedText !== 'string') return encryptedText;
    const colonIndex = encryptedText.indexOf(':');
    if (colonIndex === -1) return encryptedText;
    const ivHex = encryptedText.slice(0, colonIndex);
    const encrypted = encryptedText.slice(colonIndex + 1);
    if (typeof ivHex !== 'string' || ivHex.length !== IV_LENGTH * 2 || !/^[0-9a-fA-F]+$/.test(ivHex)) return encryptedText;
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // decrypt failed - suppressed in production
    return encryptedText;
  }
};

// Encrypt helper (same scheme as messageController)
const encrypt = (text) => {
  try {
    if (text === null || text === undefined) return '';
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (err) {
    // encrypt failed - suppressed in production
    return String(text);
  }
};

// Create a new chat container for General Ask (channel: 'general_ask')
export const createGeneralChat = async (req, res) => {
  try {
    // Guest users cannot create chats
    if (req.user.id === 'guest' || req.user.role === 'guest') {
      return res.status(403).json({ error: 'Guest users cannot create chats. Please sign up to continue.' });
    }
    
    const title = req.body.title || 'General Ask';
    // Use an allowed channel value from Chat schema ('private' or 'legal_desk')
    // Mark these chats as 'general_ask' so they don't mix with private lawyer chats
    const chat = new Chat({ user: req.user.id, title, channel: 'general_ask' });
    await chat.save();
    return res.status(201).json({ chat });
  } catch (err) {
    // createGeneralChat failed - suppressed in production
    return res.status(500).json({ error: 'Failed to create chat' });
  }
};

// Ask the general knowledge base. This implementation returns a best-effort placeholder
// answer and persists both user and assistant messages to the Messages collection.
export const askGeneral = async (req, res) => {
  try {
    // Guest users cannot ask questions
    if (req.user.id === 'guest' || req.user.role === 'guest') {
      return res.status(403).json({ error: 'Guest users cannot ask questions. Please sign up to continue.' });
    }
    
    const { query, output_language = 'en', chatId } = req.body || {};
    if (!query || String(query).trim().length === 0) return res.status(422).json({ detail: [{ loc: ['body','query'], msg: 'query is required', type: 'value_error.missing' }] });

    // If client provided a chatId, verify ownership (must be a valid ObjectId); otherwise create a new chat
    let chat = null;
    if (chatId && mongoose.Types.ObjectId.isValid(String(chatId))) {
      chat = await Chat.findOne({ _id: chatId, user: req.user.id });
    }
    if (!chat) {
      // create a server-side canonical chat for general ask
      chat = new Chat({ user: req.user.id, title: 'General Ask', channel: 'general_ask' });
      await chat.save();
    }

    // Persist the user's question as a Message (encrypt content) and mark channel as general_ask
  const userMsg = new Message({ chat: chat._id, user: req.user.id, role: 'user', content: encrypt(String(query)), channel: 'general_ask' });
    await userMsg.save();

    // TODO: integrate with an actual legal KB/LLM. For now produce a placeholder response.
    const answerText = `(Placeholder) Answer to: ${String(query).slice(0, 1000)}`;

  const assistantMsg = new Message({ chat: chat._id, user: req.user.id, role: 'ai', content: encrypt(answerText), channel: 'general_ask' });
    await assistantMsg.save();
    // emit via socket so connected clients receive the assistant message in realtime
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(String(chat._id)).emit('new_message', {
          _id: assistantMsg._id,
          chat: String(chat._id),
          user: req.user.id,
          role: 'ai',
          content: answerText,
          createdAt: assistantMsg.createdAt,
        });
      }
    } catch (emitErr) {
      // emit assistant message failed - suppressed in production
    }

    // fetch canonical messages for this chat (decrypted) so the client can reconcile immediately
    try {
      const msgs = await Message.find({ chat: chat._id }).sort({ createdAt: 1 }).lean();
      const decrypted = msgs.map(m => ({
        _id: m._id,
        chat: m.chat,
        user: m.user,
        role: m.role,
        content: decrypt(m.content),
        createdAt: m.createdAt,
      }));
      return res.json({ answer: answerText, chatId: chat._id, messages: decrypted });
    } catch (e) {
      // if fetching messages fails for any reason, still return answer + chatId
      return res.json({ answer: answerText, chatId: chat._id });
    }
  } catch (err) {
    // askGeneral failed - suppressed in production
    return res.status(500).json({ error: 'Failed to process query' });
  }
};

// Optional endpoint: save an array of messages for an existing chat (best-effort)
export const saveGeneralChat = async (req, res) => {
  try {
    // Guest users cannot save chats
    if (req.user.id === 'guest' || req.user.role === 'guest') {
      return res.status(403).json({ error: 'Guest users cannot save chats.' });
    }
    
    const { chatId, messages } = req.body || {};
    if (!chatId) return res.status(400).json({ error: 'chatId required' });
    // ensure provided chatId is valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(String(chatId))) return res.status(400).json({ error: 'invalid chatId' });
    const chat = await Chat.findOne({ _id: chatId, user: req.user.id });
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    if (Array.isArray(messages)) {
      // Ensure message contents are stored encrypted using the same scheme
      const docs = messages.map(m => ({
        chat: chat._id,
        user: req.user.id,
        role: m.role === 'assistant' ? 'ai' : 'user',
        content: encrypt(String(m.text || m.content || '')),
        channel: 'general_ask'
      }));
      await Message.insertMany(docs);
    }
    return res.json({ ok: true });
  } catch (err) {
    // saveGeneralChat failed - suppressed in production
    return res.status(500).json({ error: 'Failed to save messages' });
  }
};

export const listGeneralChats = async (req, res) => {
  try {
    // Guest users have no chats
    if (req.user.id === 'guest' || req.user.role === 'guest') {
      return res.json({ chats: [] });
    }
    
    // only return chats belonging to the General Ask channel so private/ lawyer chats are excluded
    const chats = await Chat.find({ user: req.user.id, channel: 'general_ask' }).sort({ updatedAt: -1, createdAt: -1 });
    // for each chat, retrieve the last message (decrypted) as a preview
    const enriched = await Promise.all(chats.map(async (c) => {
      const last = await Message.findOne({ chat: c._id }).sort({ createdAt: -1 }).limit(1);
      const lastText = last ? decrypt(last.content) : null;
      return { _id: c._id, title: c.title, createdAt: c.createdAt, updatedAt: c.updatedAt, lastMessageText: lastText };
    }));
    return res.json({ chats: enriched });
  } catch (err) {
    // listGeneralChats failed - suppressed in production
    return res.status(500).json({ error: 'Failed to list chats' });
  }
};

// Rename a general chat's title (used when first question becomes the chat name)
export const renameGeneralChat = async (req, res) => {
  try {
    // Guest users cannot rename chats
    if (req.user.id === 'guest' || req.user.role === 'guest') {
      return res.status(403).json({ error: 'Guest users cannot rename chats.' });
    }
    
    const { chatId, title } = req.body || {};
    if (!chatId || !title) return res.status(400).json({ error: 'chatId and title required' });
    if (!mongoose.Types.ObjectId.isValid(String(chatId))) return res.status(400).json({ error: 'invalid chatId' });
    const chat = await Chat.findOne({ _id: chatId, user: req.user.id });
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    chat.title = String(title).slice(0, 200);
    await chat.save();
    return res.json({ ok: true, chat });
  } catch (err) {
    // renameGeneralChat failed - suppressed in production
    return res.status(500).json({ error: 'Failed to rename chat' });
  }
};
