import { env } from '../env.js';

// The voice pipeline settings, copied from Circuit's Niva defaults; change them here.
export const voiceConfig = {
  vad: { activationThreshold: 0.58, minSpeechDuration: 130, minSilenceDuration: 700 },
  stt: { model: 'saaras:v3', languageCode: 'unknown', mode: 'codemix', highVadSensitivity: false },
  tts: { model: 'bulbul:v4-flash', speaker: env.SARVAM_TTS_SPEAKER, targetLanguageCode: 'en-IN', pace: 1 },
  turn: { endpointingMinDelay: 1000, detectorVersion: 'v1-mini' },
  interruption: { enabled: true, minDuration: 750, resumeFalseInterruption: false },
  llm: { historyLimit: 12 },
  dial: { ringingTimeout: 60, requestTimeout: 65 },
} as const;
