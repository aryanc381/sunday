import { saveOutcome } from '../services/task.service.js';
import type { TaskTurn } from '../schemas/turn.schemas.js';
import type { CallState, ToolResult } from './index.js';

// Saves how the person took the task, then ends the call.
export async function reportOutcome(turn: TaskTurn, call: CallState): Promise<ToolResult> {
  if (turn.outcome === 'none') return { feedback: 'Choose acknowledged or confused as the outcome.' };
  if (!call.taskId) throw new Error('This call has no task.');
  await saveOutcome(call.taskId, turn.outcome, turn.summary.trim());
  return { end: true };
}
