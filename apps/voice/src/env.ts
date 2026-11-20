import 'dotenv/config';

const required = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'SARVAM_API_KEY', 'SARVAM_LLM_MODEL', 'SARVAM_TTS_SPEAKER', 'VOBIZ_SIP_DOMAIN', 'VOBIZ_CALLER_NUMBER', 'MONGODB_URI', 'ALLOWED_CALLER_NUMBER'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Missing env values: ${missing.join(', ')}`);

export const env = {
  PORT: Number(process.env.PORT ?? 4100),
  // The worker's own HTTP port; 8082 so it does not clash with another LiveKit worker on the default 8081.
  WORKER_PORT: Number(process.env.WORKER_PORT ?? 8082),
  LIVEKIT_URL: process.env.LIVEKIT_URL as string,
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY as string,
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET as string,
  SARVAM_API_KEY: process.env.SARVAM_API_KEY as string,
  SARVAM_LLM_MODEL: process.env.SARVAM_LLM_MODEL as string,
  SARVAM_TTS_SPEAKER: process.env.SARVAM_TTS_SPEAKER as string,
  VOBIZ_SIP_DOMAIN: process.env.VOBIZ_SIP_DOMAIN as string,
  VOBIZ_CALLER_NUMBER: process.env.VOBIZ_CALLER_NUMBER as string,
  VOBIZ_SIP_USERNAME: process.env.VOBIZ_SIP_USERNAME,
  VOBIZ_SIP_PASSWORD: process.env.VOBIZ_SIP_PASSWORD,
  MONGODB_URI: process.env.MONGODB_URI as string,
  // The only number allowed to call in; also the number the agent calls back with results.
  ALLOWED_CALLER_NUMBER: process.env.ALLOWED_CALLER_NUMBER as string,
};
