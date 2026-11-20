import { findContact } from '../services/contact.service.js';
import type { IntakeTurn } from '../schemas/turn.schemas.js';
import type { ToolResult } from './index.js';

// Looks the name up and tells the agent the number, or that there is none.
export async function lookupContact(turn: IntakeTurn): Promise<ToolResult> {
  const contact = await findContact(turn.name);
  return { feedback: contact ? `${contact.name} is saved with the number ${contact.phone}.` : `There is no contact named ${turn.name}.` };
}
