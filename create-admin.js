// Script to create an admin user with password
// Run this with: node create-admin.js

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/legal-ai';

const UserSchema = new mongoose.Schema({
  googleId: { type: String, unique: true, sparse: true, index: true },
  email: { type: String, required: true, index: true },
  name: { type: String, required: true },
  picture: { type: String },
  role: { type: String, enum: ["helpseeker", "lawyer", "admin"], default: null },
  password: { type: String },
  // ... other fields
}, { timestamps: true });

const User = mongoose.model("User", UserSchema);

async function createAdminUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Admin credentials
    const adminEmail = 'admin@legalai.com';
    const adminPassword = 'admin123';  // Change this to a secure password
    const adminName = 'Admin User';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists with email:', adminEmail);
      
      // Update role if needed
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        await existingAdmin.save();
        console.log('✅ Updated existing user to admin role');
      }
      
      process.exit(0);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Create admin user
    const admin = await User.create({
      email: adminEmail,
      name: adminName,
      password: hashedPassword,
      role: 'admin',
      picture: null,
      googleId: null
    });

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email:', adminEmail);
    console.log('🔑 Password:', adminPassword);
    console.log('⚠️  IMPORTANT: Change the password after first login!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  }
}

createAdminUser();
