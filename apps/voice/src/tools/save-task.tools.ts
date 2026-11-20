import { findContact } from '../services/contact.service.js';
import { saveTask } from '../services/task.service.js';
import type { IntakeTurn } from '../schemas/turn.schemas.js';
import type { CallState, ToolResult } from './index.js';

// Saves the task for a saved contact; calling it again in the same call updates that task.
export async function saveTaskTool(turn: IntakeTurn, call: CallState): Promise<ToolResult> {
  if (!turn.task.trim()) return { feedback: 'The task is empty. Ask what the task is.' };
  const contact = await findContact(turn.name);
  if (!contact) return { feedback: `There is no contact named ${turn.name}. Save the contact first.` };
  const task = await saveTask(call.taskId, turn.task.trim(), contact.id, contact.phone, turn.context.trim() || null);
  call.taskId = task.id;
  return { feedback: 'The task is saved.' };
}
