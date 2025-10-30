import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
        type: String,
        enum: ["user", "response", "lawyer", "ai", "system"], // preserve old values and allow explicit lawyer/ai/system
        required: true,
    },
    content: {
      type: String,
      required: true,
    },
      // channel indicates which subsystem the message belongs to.
      // 'private' = user <-> lawyer chat, 'legal_desk' = AI/legal document assistant, others possible
      channel: {
        type: String,
        default: 'private',
      },
  },
  { timestamps: true }
);

export const Message = mongoose.model("Message", MessageSchema);
