import { Schema, model } from 'mongoose';

export const outcomes = ['acknowledged', 'confused', 'no_pickup'] as const;
export type Outcome = (typeof outcomes)[number];
export type TranscriptLine = { role: 'user' | 'assistant'; text: string; at: Date };

// One job from the owner: who to tell what, and how the call went. Kept as history, never deleted.
const taskSchema = new Schema(
  {
    task: { type: String, required: true },
    contact_id: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
    phone: { type: String, required: true },
    context: { type: String, default: null },
    status: { type: String, enum: ['pending', 'calling', 'done'], default: 'pending', index: true },
    outcome: { type: String, enum: [...outcomes, null], default: null },
    transcript: { type: [{ _id: false, role: String, text: String, at: Date }], default: [] },
    summary: { type: String, default: '' },
    completed_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

export const Task = model('Task', taskSchema);
