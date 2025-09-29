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
  },
  { timestamps: true }
);

export const Chat = mongoose.model("Chat", ChatSchema);
