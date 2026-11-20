import { StopResponse, voice, type JobContext, type llm } from '@livekit/agents';
import { voiceConfig } from './config/voice.config.js';
import type { TranscriptLine } from './models/task.model.js';
import type { TurnMode } from './schemas/turn.schemas.js';
import { askAgent, type ChatMessage } from './services/llm.service.js';
import { runTool, type CallState } from './tools/index.js';

const maxSteps = 5; // Most lookups and saves the agent may chain before it must speak.

// Plays text through Sarvam TTS and waits until it has finished, throwing if the speech failed.
export async function speak(session: voice.AgentSession, text: string) {
  const speech = session.say(text);
  await speech.waitForPlayout();
  const error = speech.exception();
  if (error !== undefined) throw error;
}

// The agent on an intake or task call: each turn it asks Sarvam for one JSON action, speaks, and runs the action.
export class CallAgent extends voice.Agent {
  // What was actually said, kept for the task's transcript.
  readonly transcript: TranscriptLine[] = [];
  private messages: ChatMessage[] = [];

  constructor(
    private ctx: JobContext,
    private mode: TurnMode,
    private system: string,
    readonly call: CallState
  ) {
    super({ instructions: system });
  }

  // Runs one turn; an action that gives feedback (a lookup, a save) makes the agent think again before it speaks on.
  // If the LLM or an action fails, the agent asks the person to repeat.
  async turn(userText: string) {
    this.messages.push({ role: 'user', content: userText });
    try {
      for (let step = 0; step < maxSteps; step++) {
        const turn = await askAgent(this.mode, this.system, this.messages.slice(-voiceConfig.llm.historyLimit));
        this.messages.push({ role: 'assistant', content: JSON.stringify(turn) });
        if (turn.say) {
          this.transcript.push({ role: 'assistant', text: turn.say, at: new Date() });
          await speak(this.session, turn.say);
        }
        const result = await runTool(turn, this.call);
        if (result.end) return this.ctx.shutdown('Call finished');
        if (!result.feedback) return;
        this.messages.push({ role: 'user', content: `[system] ${result.feedback}` });
      }
    } catch (error) {
      console.error('turn failed', error);
      await speak(this.session, 'Sorry, could you say that again?');
    }
  }

  override async onUserTurnCompleted(_chatCtx: llm.ChatContext, message: llm.ChatMessage) {
    const userText = message.textContent?.trim();
    if (userText) {
      this.transcript.push({ role: 'user', text: userText, at: new Date() });
      await this.turn(userText);
    }
    throw new StopResponse();
  }
}
