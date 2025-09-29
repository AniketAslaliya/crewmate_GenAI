import { Message } from "../models/Message.js";
import crypto from "crypto";

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
    const [ivHex, encrypted] = encryptedText.split(":");
    if (!ivHex || !encrypted) {
      throw new Error("Invalid encrypted text format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    console.error("Decryption failed:", err.message);
    throw new Error("Failed to decrypt message");
  }
};

// 📩 Send a message
export const sendMessage = async (req, res) => {
  try {
    const { chatId, content, role } = req.body;

    if (!chatId || !content || !role) {
      return res
        .status(400)
        .json({ error: "chatId, content, and role are required" });
    }

    // Encrypt the message content
    const encryptedContent = encrypt(content);

    const message = new Message({
      chat: chatId,
      user: req.user.id,
      role,
      content: encryptedContent, // Save encrypted content
    });

    await message.save();

    // Decrypt the content before sending it back to the frontend
    const decryptedMessage = {
      ...message.toObject(),
      content: decrypt(message.content),
    };

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

    const messages = await Message.find({ chat: chatId })
      .sort({ createdAt: 1 }) // oldest first
      .populate("user", "name email");

    // Decrypt the content of each message
    const decryptedMessages = messages.map((message) => ({
      ...message.toObject(),
      content: decrypt(message.content), // Decrypt content
    }));

    res.json({ messages: decryptedMessages });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to fetch messages", details: err.message });
  }
};
