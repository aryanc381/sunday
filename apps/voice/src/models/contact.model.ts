import { Schema, model } from 'mongoose';

// The phone book: a lowercase name and its E.164 number, both unique.
const contactSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const Contact = model('Contact', contactSchema);
