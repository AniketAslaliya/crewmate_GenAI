import { Message } from "../models/Message.js";

// Send a message
export const sendMessage = async (req, res) => {
  try {
    const { chatId, content, role } = req.body;

    if (!chatId || !content || !role) {
      return res.status(400).json({ error: "chatId, content, and role are required" });
    }

    const message = new Message({
      chat: chatId,
      user: req.user.id,
      role,
      content,
    });

    await message.save();

    res.status(201).json({ message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send message", details: err.message });
  }
};

// Get all messages for a chat
export const getMessagesByChat = async (req, res) => {
  try {
    const { chatId } = req.params;

    const messages = await Message.find({ chat: chatId })
      .sort({ createdAt: 1 }) // oldest first
      .populate("user", "name email");

    res.json({ messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch messages", details: err.message });
  }
};
