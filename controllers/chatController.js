import { Chat } from "../models/Chat.js";

// Upload & process ANY document → create chat
export const uploadDocument = async (req, res) => {
  try {
    const chat = new Chat({
      user: req.user.id,
      title: req.body.title || "Untitled notebook",
      channel: 'legal_desk',
    });

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

export const deleteChat = async (req, res) => {
  try {
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
    // return only legal-desk chats (dossiers) for the user's notebook view
    const chats = await Chat.find({ user: req.user.id, channel: 'legal_desk' }).sort({ createdAt: -1 });

    res.json({ chats });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch chats" });
  }
};

export const getChatbyId = async (req, res) => {
  try {
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