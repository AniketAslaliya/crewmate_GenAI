import mongoose from "mongoose";

const ChatSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId, // 👈 reference to User schema
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      default: "Untitled notebook",
    },
    // channel indicates whether this chat is a legal-desk dossier or a private user-lawyer chat
    // 'legal_desk' = uploaded document / notebook, 'private' = one-to-one chat between users
    channel: {
      type: String,
      enum: ['legal_desk', 'private'],
      default: 'legal_desk',
    },
  },
  { timestamps: true }
);

export const Chat = mongoose.model("Chat", ChatSchema);
