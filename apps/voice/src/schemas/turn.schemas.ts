import type OpenAI from 'openai';
import { z } from 'zod';

export type TurnMode = 'intake' | 'task';

// One agent turn while the owner gives a task: what to say, which action to run, and its arguments (empty text when unused).
export const intakeTurn = z.strictObject({
  say: z.string(),
  action: z.enum(['talk', 'lookup_contact', 'save_contact', 'save_task', 'end_call']),
  name: z.string(),
  phone: z.string(),
  task: z.string(),
  context: z.string(),
});

// One agent turn on the call to the person: what to say and, once they have answered, the outcome.
export const taskTurn = z.strictObject({
  say: z.string(),
  action: z.enum(['talk', 'report_outcome']),
  outcome: z.enum(['acknowledged', 'confused', 'none']),
  summary: z.string(),
});

export type IntakeTurn = z.infer<typeof intakeTurn>;
export type TaskTurn = z.infer<typeof taskTurn>;

// Turns the zod schema into the strict JSON schema Sarvam must follow for every reply.
function format(name: string, schema: z.ZodType): OpenAI.ResponseFormatJSONSchema {
  const json: Record<string, unknown> = z.toJSONSchema(schema);
  delete json.$schema;
  return { type: 'json_schema', json_schema: { name, strict: true, schema: json } };
}

export const turnSchemas = { intake: intakeTurn, task: taskTurn };
export const turnFormats = { intake: format('intake_turn', intakeTurn), task: format('task_turn', taskTurn) };
