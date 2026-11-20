import { inference, voice } from '@livekit/agents';
import * as sarvam from '@livekit/agents-plugin-sarvam';
import * as silero from '@livekit/agents-plugin-silero';
import { voiceConfig as config } from './config/voice.config.js';
import { env } from './env.js';

// Builds the ears and mouth of the call: Silero VAD hears when the person speaks, Sarvam STT writes it down, Sarvam TTS talks back.
// There is no LLM here: CallAgent asks Sarvam for each turn itself, so the reply is always the JSON schema's.
export async function createSession() {
  return new voice.AgentSession({
    vad: await silero.VAD.load({
      forceCPU: true,
      activationThreshold: config.vad.activationThreshold, // How sure it must be that a sound is speech.
      minSpeechDuration: config.vad.minSpeechDuration, // ms a sound must last to count as speech.
      minSilenceDuration: config.vad.minSilenceDuration, // ms of silence that ends a speech segment.
    }),
    stt: new sarvam.STT({
      apiKey: env.SARVAM_API_KEY,
      model: config.stt.model,
      languageCode: config.stt.languageCode, // 'unknown' detects the language automatically.
      mode: config.stt.mode, // codemix handles Hindi and English mixed in one sentence.
      highVadSensitivity: config.stt.highVadSensitivity,
    }),
    // The plugin's types list only bulbul:v2 and v3, so the model is cast; the value sent is still bulbul:v4-flash.
    tts: new sarvam.TTS({
      apiKey: env.SARVAM_API_KEY,
      model: config.tts.model as 'bulbul:v3',
      speaker: config.tts.speaker, // A bulbul:v4-flash voice, e.g. shubh_enhi_ads.
      targetLanguageCode: config.tts.targetLanguageCode,
      pace: config.tts.pace,
    }),
    turnHandling: {
      endpointing: { minDelay: config.turn.endpointingMinDelay }, // ms to wait after the person stops speaking.
      turnDetection: new inference.TurnDetector({ version: config.turn.detectorVersion }),
      interruption: {
        enabled: config.interruption.enabled,
        mode: 'vad',
        minDuration: config.interruption.minDuration, // ms the person must speak before the agent stops.
        minWords: 0, // Sarvam sends no text while the person is speaking, so a word minimum would block interruptions.
        resumeFalseInterruption: config.interruption.resumeFalseInterruption,
      },
    },
  });
}
