import { Message } from "../models/Message.js";
import crypto from "crypto";
import mongoose from 'mongoose';
import { uploadToGCS } from "../utils/gcs.js";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16; // AES requires 16-byte IV

// ✅ Always create a proper 32-byte key from SECRET_KEY
const SECRET_KEY = crypto
  .createHash("sha256")
  .update(process.env.SECRET_KEY || "default-secret-key")
  .digest();

// 🔒 Encrypt function
const encrypt = (text) => {
  const iv = crypto.randomBytes(IV_LENGTH); // random IV for each message
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`; // Store IV + ciphertext
};

// 🔓 Decrypt function
// 🔓 Decrypt function
const decrypt = (encryptedText) => {
  try {
    if (!encryptedText || typeof encryptedText !== 'string') return encryptedText;

    // find first colon to split IV and ciphertext; be defensive in case plaintext contains ':'
    const colonIndex = encryptedText.indexOf(':');
    if (colonIndex === -1) return encryptedText;

    const ivHex = encryptedText.slice(0, colonIndex);
    const encrypted = encryptedText.slice(colonIndex + 1);

    // validate IV hex (must be 16 bytes -> 32 hex chars)
    if (typeof ivHex !== 'string' || ivHex.length !== IV_LENGTH * 2 || !/^[0-9a-fA-F]+$/.test(ivHex)) {
      return encryptedText;
    }

    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // don't spam logs for expected decryption failures; use debug level
    console.debug('decrypt failed', err && err.message ? err.message : err);
    return encryptedText;
  }
};

// 📩 Send a message
export const sendMessage = async (req, res) => {
  try {
    // Guest users cannot send messages
    if (req.user.id === 'guest' || req.user.role === 'guest') {
      return res.status(403).json({ error: 'Guest users cannot send messages. Please sign up to continue.' });
    }
    
    const { chatId, content, role } = req.body;
    const file = req.file;

    // At least content or file must be provided
    if (!chatId || !role || (!content && !file)) {
      return res
        .status(400)
        .json({ error: "chatId, role, and (content or file) are required" });
    }

    // validate chatId is an ObjectId
    if (!mongoose.Types.ObjectId.isValid(String(chatId))) {
      return res.status(400).json({ error: 'invalid chatId' });
    }

    // Encrypt the message content if provided
    const encryptedContent = content ? encrypt(content) : '';

    // Handle file upload to GCS if file exists
    let attachmentData = null;
    if (file) {
      try {
        const uploadResult = await uploadToGCS(
          file.buffer,
          file.originalname,
          'chat-files',
          chatId
        );
        attachmentData = {
          url: uploadResult.url,
          filename: uploadResult.filename,
          fileType: file.mimetype,
          fileSize: file.size,
          uploadedAt: new Date()
        };
      } catch (uploadError) {
        console.error('File upload error:', uploadError);
        return res.status(500).json({ error: 'Failed to upload file' });
      }
    }

    const message = new Message({
      chat: chatId,
      user: req.user.id,
      role,
      content: encryptedContent, // Save encrypted content
      attachment: attachmentData
    });

    await message.save();

    // Decrypt the content before sending it back to the frontend
    const decryptedMessage = {
      ...message.toObject(),
      // ensure `user` is an id string (not a populated object) for frontend consistency
      user: message.user && message.user._id ? message.user._id : message.user,
      content: decrypt(message.content),
    };

    // emit via socket io so connected clients receive the message in realtime
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(chatId).emit('new_message', {
          ...decryptedMessage,
          content: decryptedMessage.content,
        });
      }
    } catch (emitErr) {
      console.error('Failed to emit socket message from REST send:', emitErr);
    }

    res.status(201).json({ message: decryptedMessage });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to send message", details: err.message });
  }
};

// 📜 Get all messages for a chat
export const getMessagesByChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    // validate chatId to avoid CastError when a client passes a non-ObjectId id
    if (!mongoose.Types.ObjectId.isValid(String(chatId))) {
      // return empty list rather than throwing
      return res.json({ messages: [] });
    }

    const messages = await Message.find({ chat: chatId })
      .sort({ createdAt: 1 }) // oldest first
      .populate("user", "name email");

    // Decrypt the content of each message and normalize `user` to the id string
    const decryptedMessages = messages.map((message) => {
      const obj = message.toObject();
      return {
        ...obj,
        user: obj.user && obj.user._id ? obj.user._id : obj.user,
        content: decrypt(message.content), // Decrypt content
      };
    });

    res.json({ messages: decryptedMessages });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to fetch messages", details: err.message });
  }
};
