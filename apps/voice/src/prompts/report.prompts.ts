import type { Outcome } from '../models/task.model.js';

// The line spoken to the owner when the task call is over; plain text, no LLM.
export function reportLine(contactName: string, task: string, outcome: Outcome, summary: string) {
  const result: Record<Outcome, string> = {
    acknowledged: `${contactName} acknowledged it.`,
    confused: `${contactName} did not acknowledge it.`,
    no_pickup: `I could not reach ${contactName}.`,
  };
  return `Hi, this is Sunday with an update on your task: ${task}. ${result[outcome]} ${summary}`;
}
