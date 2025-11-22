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
    // channel indicates which subsystem the chat belongs to.
    // 'legal_desk' = uploaded document / notebook, 'private' = one-to-one chat between users,
    // 'general_ask' = quick-guide / AI notebook conversations
    channel: {
      type: String,
      enum: ['legal_desk', 'private', 'general_ask'],
      default: 'legal_desk',
    },
    summary: {
      type: String,
      default: '',
    },
    riskAnalyses: {
      type: Array,
      default: []
    },
    // persisted file storage info (GCS)
    fileGcsPath: {
      type: String,
      default: ''
    },
    originalFileName: {
      type: String,
      default: ''
    },
    fileMimeType: {
      type: String,
      default: ''
    },
    // Preferred output language for AI-generated content for this chat/desk
    output_language: {
      type: String,
      default: 'en'
    },
  },
  { timestamps: true }
);

export const Chat = mongoose.model("Chat", ChatSchema);
