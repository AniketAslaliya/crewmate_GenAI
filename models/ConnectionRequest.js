import mongoose from "mongoose";

const ConnectionRequestSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // helpseeker
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // lawyer
    message: { type: String },
    status: { type: String, enum: ["requested", "accepted", "rejected"], default: "requested" },
    chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat" },
  },
  { timestamps: true }
);

export const ConnectionRequest = mongoose.model("ConnectionRequest", ConnectionRequestSchema);
