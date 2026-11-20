import type { Outcome } from '../models/task.model.js';

const result: Record<Outcome, string> = {
  acknowledged: 'got it and acknowledged',
  confused: 'was confused and did not acknowledge',
  no_pickup: 'did not pick up',
};

// The line spoken to the owner when the task call is over; plain text, no LLM.
export function reportLine(contactName: string, task: string, outcome: Outcome, summary: string) {
  return `Hi, this is Sunday with an update. You asked me to tell ${contactName}: ${task}. ${contactName} ${result[outcome]}. ${summary}`;
}
