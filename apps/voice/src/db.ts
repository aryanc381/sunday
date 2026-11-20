import mongoose from 'mongoose';
import { env } from './env.js';

// Connects to MongoDB once; later calls reuse the open connection.
export async function connectDB() {
  if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGODB_URI);
}
