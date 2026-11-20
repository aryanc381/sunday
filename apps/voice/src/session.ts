import { voice } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import * as sarvam from '@livekit/agents-plugin-sarvam';
import * as silero from '@livekit/agents-plugin-silero';
import { env } from './env.js';

// Builds the ears, brain and mouth of the call: Silero VAD hears when the person speaks, Sarvam STT writes it down,
// the LLM (Sarvam's OpenAI-compatible API) decides the reply, and Sarvam TTS speaks it.
export async function createSession() {
  return new voice.AgentSession({
    vad: await silero.VAD.load({ forceCPU: true }),
    stt: new sarvam.STT({ apiKey: env.SARVAM_API_KEY, model: 'saaras:v3', languageCode: 'unknown', mode: 'codemix' }),
    llm: new openai.LLM({ apiKey: env.SARVAM_API_KEY, baseURL: 'https://api.sarvam.ai/v1', model: env.SARVAM_LLM_MODEL }),
    tts: new sarvam.TTS({ apiKey: env.SARVAM_API_KEY, model: 'bulbul:v3', speaker: env.SARVAM_TTS_SPEAKER, targetLanguageCode: 'en-IN' }),
  });
}
