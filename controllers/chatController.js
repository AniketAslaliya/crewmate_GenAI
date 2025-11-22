// Update summary for a chat (desk)
export const updateChatSummary = async (req, res) => {
  try {
    if (req.user.id === 'guest' || req.user.role === 'guest') {
      return res.status(403).json({ error: 'Guest users cannot update chats.' });
    }
    const { id } = req.params;
    const { summary } = req.body;
    const chat = await Chat.findOneAndUpdate(
      { _id: id, user: req.user.id },
      { summary },
      { new: true }
    );
    if (!chat) {
      return res.status(404).json({ error: "Chat not found or not authorized" });
    }
    res.json({ message: "Summary updated", chat });
  } catch (err) {
    res.status(500).json({ error: "Failed to update summary" });
  }
};
import { Chat } from "../models/Chat.js";
import { uploadToGCS, getSignedUrl, getReadStream } from "../utils/gcs.js";

// Upload & process ANY document → create chat
export const uploadDocument = async (req, res) => {
  try {
    // Guest users cannot upload documents
    if (req.user.id === 'guest' || req.user.role === 'guest') {
      return res.status(403).json({ error: 'Guest users cannot upload documents. Please sign up to continue.' });
    }
    
    const chat = new Chat({
      user: req.user.id,
      title: req.body.title || "Untitled notebook",
      channel: 'legal_desk',
      output_language: req.body.output_language || 'en',
    });

    // If a file is provided via multer (memory storage), upload it to GCS
    if (req.file && req.file.buffer) {
      try {
        const gcsResult = await uploadToGCS(req.file.buffer, req.file.originalname, 'legal_desks', req.user.id);
        chat.fileGcsPath = gcsResult.path;
        chat.originalFileName = req.file.originalname;
        chat.fileMimeType = req.file.mimetype || '';
      } catch (e) {
        console.error('Failed to upload to GCS in uploadDocument:', e);
        // continue without failing chat creation; client can retry storing file separately
      }
    }

    await chat.save();

    res.status(201).json({
      message: "Document processed & chat stored",
      chat,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to process document",
      error: error.message,
    });
  }
};

export const saveChatRisk = async (req, res) => {
  try {
    const { id } = req.params;
    const { result } = req.body; // expected to be JSON
    if (!result) return res.status(400).json({ error: 'Missing risk result' });

    const chat = await Chat.findOne({ _id: id, user: req.user.id });
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    chat.riskAnalyses = chat.riskAnalyses || [];
    chat.riskAnalyses.push({ createdAt: new Date(), result });
    await chat.save();

    res.json({ message: 'Risk saved', chat });
  } catch (err) {
    console.error('saveChatRisk error', err);
    res.status(500).json({ error: 'Failed to save risk' });
  }
};

export const getChatDownload = async (req, res) => {
  try {
    const { id } = req.params;
    const chat = await Chat.findOne({ _id: id, user: req.user.id });
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (!chat.fileGcsPath) return res.status(404).json({ error: 'No file available for this chat' });

    // If client requests proxy mode, stream the file through the backend to avoid CORS issues
    const proxy = req.query.proxy === '1' || req.query.proxy === 'true' || req.query.proxy === 'yes';
    if (proxy) {
      try {
        const stream = getReadStream(chat.fileGcsPath);
        // set headers to allow inline display in browser
        res.setHeader('Content-Type', chat.fileMimeType || 'application/octet-stream');
        const filename = chat.originalFileName || 'document';
        res.setHeader('Content-Disposition', `inline; filename="${filename.replace(/\"/g, '')}"`);
        stream.on('error', (err) => {
          console.error('Stream error in getChatDownload proxy:', err);
          if (!res.headersSent) res.status(500).end('Failed to stream file');
        });
        stream.pipe(res);
        return;
      } catch (err) {
        console.error('Failed to proxy file from GCS:', err);
        // fall through to return signed URL as a fallback
      }
    }

    const url = await getSignedUrl(chat.fileGcsPath, 1); // 1 hour
    res.json({ downloadUrl: url, originalFileName: chat.originalFileName, mimeType: chat.fileMimeType });
  } catch (err) {
    console.error('getChatDownload error', err);
    res.status(500).json({ error: 'Failed to get download link' });
  }
};

export const deleteChat = async (req, res) => {
  try {
    // Guest users cannot delete chats
    if (req.user.id === 'guest' || req.user.role === 'guest') {
      return res.status(403).json({ error: 'Guest users cannot delete chats.' });
    }
    
    const { id } = req.params;

    const chat = await Chat.findOneAndDelete({
      _id: id,
      user: req.user.id, // only allow deleting own chats
    });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found or not authorized" });
    }

    res.json({ message: "Chat deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete chat" });
  }
};

// Get all chats of logged-in user
export const getUserChats = async (req, res) => {
  try {
    // Guest users have no chats
    if (req.user.id === 'guest' || req.user.role === 'guest') {
      return res.json({ chats: [] });
    }
    
    // return only legal-desk chats (dossiers) for the user's notebook view
    const chats = await Chat.find({ user: req.user.id, channel: 'legal_desk' }).sort({ createdAt: -1 });

    res.json({ chats });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch chats" });
  }
};

export const getChatbyId = async (req, res) => {
  try {
    // Guest users cannot fetch chats
    if (req.user.id === 'guest' || req.user.role === 'guest') {
      return res.status(403).json({ error: 'Guest users cannot access chats.' });
    }
    
    const { id } = req.params;

    const chat = await Chat.findOne({
      _id: id,
      user: req.user.id, // only allow fetching own chats
    });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found or not authorized" });
    }

    res.json({ chat });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch chat" });
  }
};

// Update chat metadata (e.g., output_language)
export const updateChatMeta = async (req, res) => {
  try {
    if (req.user.id === 'guest' || req.user.role === 'guest') {
      return res.status(403).json({ error: 'Guest users cannot update chats.' });
    }
    const { id } = req.params;
    // Only allow certain updatable fields to avoid abuse
    const allowed = ['title', 'summary', 'output_language'];
    const updates = {};
    Object.keys(req.body).forEach(k => {
      if (allowed.includes(k)) updates[k] = req.body[k];
    });

    const chat = await Chat.findOneAndUpdate(
      { _id: id, user: req.user.id },
      updates,
      { new: true }
    );

    if (!chat) return res.status(404).json({ error: 'Chat not found or not authorized' });
    res.json({ message: 'Chat updated', chat });
  } catch (err) {
    console.error('updateChatMeta error', err);
    res.status(500).json({ error: 'Failed to update chat' });
  }
};