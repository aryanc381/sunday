import { Task, type Outcome, type TranscriptLine } from '../models/task.model.js';

// Creates the task, or updates it when the intake call already saved one.
export function saveTask(taskId: string | undefined, task: string, contactId: string, phone: string, context: string | null) {
  const fields = { task, contact_id: contactId, phone, context };
  return taskId ? Task.findByIdAndUpdate(taskId, fields, { new: true }).orFail() : Task.create(fields);
}

// Reads a task; null when the id is unknown.
export function getTask(taskId: string) {
  return Task.findById(taskId);
}

// Marks that the call to the person has started, and clears any earlier result.
export function markCalling(taskId: string) {
  return Task.findByIdAndUpdate(taskId, { status: 'calling', outcome: null, summary: '' }, { new: true }).orFail();
}

// Writes how the call went.
export function saveOutcome(taskId: string, outcome: Outcome, summary: string) {
  return Task.findByIdAndUpdate(taskId, { outcome, summary }, { new: true }).orFail();
}

// Closes the task with the call transcript.
export function completeTask(taskId: string, transcript: TranscriptLine[]) {
  return Task.findByIdAndUpdate(taskId, { status: 'done', transcript, completed_at: new Date() }, { new: true }).orFail();
}
