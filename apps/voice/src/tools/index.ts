import type { IntakeTurn, TaskTurn } from '../schemas/turn.schemas.js';
import { endCall } from './end-call.tools.js';
import { lookupContact } from './lookup-contact.tools.js';
import { reportOutcome } from './report-outcome.tools.js';
import { saveContactTool } from './save-contact.tools.js';
import { saveTaskTool } from './save-task.tools.js';

// What a call remembers between turns: the task it is working on.
export type CallState = { taskId?: string };
// What an action gives back: a note for the LLM to read next turn, or a request to end the call.
export type ToolResult = { feedback?: string; end?: boolean };

// Runs the action the LLM chose; 'talk' has nothing to run.
export async function runTool(turn: IntakeTurn | TaskTurn, call: CallState): Promise<ToolResult> {
  switch (turn.action) {
    case 'lookup_contact':
      return lookupContact(turn);
    case 'save_contact':
      return saveContactTool(turn);
    case 'save_task':
      return saveTaskTool(turn, call);
    case 'report_outcome':
      return reportOutcome(turn, call);
    case 'end_call':
      return endCall();
    default:
      return {};
  }
}
