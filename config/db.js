import { connect } from "mongoose";
import dotenv from "dotenv";
dotenv.config({ silent: true });
const connectDB = async () => {
  try {
    await connect(process.env.MONGO_URI);
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  }
};

export default connectDB;
