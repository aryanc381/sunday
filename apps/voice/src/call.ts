import { randomUUID } from 'node:crypto';
import { SIPOutboundConfig, SIPTransport } from '@livekit/protocol';
import { LiveKitAPI } from 'livekit-server-sdk';
import { voiceConfig } from './config/voice.config.js';
import { env } from './env.js';
import { completeTask, markCalling, saveOutcome } from './services/task.service.js';

// The name the worker registers under; startCall asks LiveKit for this agent.
export const agentName = 'sunday-voice-agent';

// intake: the owner called in. task: we call the person. report: we call the owner with the result.
export type Mode = 'intake' | 'task' | 'report';

function livekit() {
  return new LiveKitAPI({ host: env.LIVEKIT_URL, apiKey: env.LIVEKIT_API_KEY, secret: env.LIVEKIT_API_SECRET });
}

// Deletes the room, which also hangs up the phone. A failure is logged, not thrown.
export async function closeRoom(room: string) {
  try {
    await livekit().room.deleteRoom(room);
  } catch (error) {
    console.error('closeRoom failed', error);
  }
}

// Asks LiveKit SIP to call the number through Vobiz and waits until it is answered.
async function dial(room: string, identity: string, phoneNumber: string) {
  const trunk = new SIPOutboundConfig({
    hostname: env.VOBIZ_SIP_DOMAIN,
    // TCP: the reply comes back on the same connection, so it works behind NAT.
    transport: SIPTransport.SIP_TRANSPORT_TCP,
    authUsername: env.VOBIZ_SIP_USERNAME,
    authPassword: env.VOBIZ_SIP_PASSWORD,
  });
  // The request timeout (seconds) is longer than the ring limit so the ring limit fires first.
  const options = { participantIdentity: identity, fromNumber: env.VOBIZ_CALLER_NUMBER, waitUntilAnswered: true, ringingTimeout: voiceConfig.dial.ringingTimeout, timeout: voiceConfig.dial.requestTimeout };
  await livekit().sip.createSipParticipant('', phoneNumber, room, options, trunk);
}

// Starts a task or report call: creates the room, sends the agent in, then dials in the background.
// If a task call is not answered, the task is closed as no_pickup and the owner is called with that result.
export async function startCall(phoneNumber: string, mode: 'task' | 'report', taskId: string) {
  const room = `${mode}-${randomUUID()}`;
  const identity = room.replace(`${mode}-`, 'phone-');
  if (mode === 'task') await markCalling(taskId);
  const lk = livekit();
  await lk.room.createRoom({ name: room });
  await lk.agentDispatch.createDispatch(room, agentName, { metadata: JSON.stringify({ mode, identity, taskId }) });
  void dial(room, identity, phoneNumber).catch(async (error: unknown) => {
    console.error('dial failed', error);
    await closeRoom(room);
    if (mode !== 'task') return;
    await saveOutcome(taskId, 'no_pickup', 'The call was not answered.');
    await completeTask(taskId, []);
    await startCall(env.ALLOWED_CALLER_NUMBER, 'report', taskId);
  });
  return { room };
}
