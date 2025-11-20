import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    email: {
      type: String,
        required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    picture: {
      type: String,
    },
    role: {
        type: String,
        enum: ["helpseeker", "lawyer", "admin"],
        default: null,
    },
      // Local auth password (bcrypt hash). If user signs in with Google this can be empty/null
      password: {
        type: String,
      },
    bio: { type: String },
    phone: { type: String },
  specialties: { type: [String], default: [] },
  location: { type: String },
  city: { type: String },
  // years of professional experience
  yearsExperience: { type: Number, default: 0 },
  // consultation fee per session in local currency
  fee: { type: Number, default: 0 },
  // supported consultation modes: in-person, video, chat, phone
  modes: { type: [String], default: [] },
  // languages spoken
  languages: { type: [String], default: [] },
  // courts the lawyer practices in
  courts: { type: [String], default: [] },
  // verified/licensed flag
  verified: { type: Boolean, default: false },
  // verification status: pending, approved, rejected
  verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  // admin notes for verification
  verificationNotes: { type: String },
  // date when verification was processed
  verificationDate: { type: Date },
  // average rating from clients
  rating: { type: Number, default: 0 },
  // whether offers a free first consultation
  freeFirst: { type: Boolean, default: false },
  // firm type: independent or firm
  firmType: { type: String, enum: ['independent','firm'], default: 'independent' },
  // education history
  education: { type: [String], default: [] },
  // success rate or cases handled percent
  successRate: { type: Number, default: 0 },
  // average response time in hours
  responseTimeHours: { type: Number, default: 24 },
  // affiliated organization or law firm
  organization: { type: String },
  // indicates lawyer completed onboarding (filled required profile fields)
  isOnboarded: { type: Boolean, default: false },
  // proof documents (Bar Council ID, License, etc.)
  proofDocument: { 
    url: { type: String },
    filename: { type: String },
    uploadedAt: { type: Date }
  },
  // degree certificate
  degreeCertificate: { 
    url: { type: String },
    filename: { type: String },
    uploadedAt: { type: Date }
  },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", UserSchema);
