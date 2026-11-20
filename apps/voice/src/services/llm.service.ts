import OpenAI from 'openai';
import { env } from '../env.js';
import { turnFormats, turnSchemas, type TurnMode } from '../schemas/turn.schemas.js';

const client = new OpenAI({ apiKey: env.SARVAM_API_KEY, baseURL: 'https://api.sarvam.ai/v1' });

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

const maxAttempts = 2; // Sarvam now and then returns broken JSON, so a bad reply is asked for again once.

// Asks Sarvam for the agent's next turn; the reply must be JSON that matches the mode's schema.
export async function askAgent(mode: TurnMode, system: string, history: ChatMessage[]) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: env.SARVAM_LLM_MODEL,
        response_format: turnFormats[mode],
        max_tokens: 400, // A turn is short; the cap stops a runaway reply.
        messages: [{ role: 'system', content: system }, ...history],
      });
      const content = response.choices[0]?.message.content;
      if (!content) throw new Error('Sarvam returned an empty turn.');
      return turnSchemas[mode].parse(JSON.parse(content));
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      console.error('bad turn, asking again', error);
    }
  }
}
