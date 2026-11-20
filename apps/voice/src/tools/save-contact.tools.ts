import { saveContact } from '../services/contact.service.js';
import { toE164 } from '../schemas/phone.schemas.js';
import type { IntakeTurn } from '../schemas/turn.schemas.js';
import type { ToolResult } from './index.js';

// Saves a new contact once the number is valid; a 10-digit number gets +91.
export async function saveContactTool(turn: IntakeTurn): Promise<ToolResult> {
  if (!turn.name.trim()) return { feedback: 'The name is empty. Ask who to call.' };
  const phone = toE164(turn.phone);
  if (!phone.success) return { feedback: 'That is not a valid number. Ask for it again, with the country code.' };
  await saveContact(turn.name, phone.data);
  return { feedback: `Saved ${turn.name.trim()} with ${phone.data}.` };
}
