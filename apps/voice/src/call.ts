import { randomUUID } from 'node:crypto';
import { SIPOutboundConfig, SIPTransport } from '@livekit/protocol';
import { LiveKitAPI } from 'livekit-server-sdk';
import { env } from './env.js';

// The name the worker registers under; startCall asks LiveKit for this agent.
export const agentName = 'sunday-voice-agent';

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
  // Ring for at most 60 s; the request timeout (seconds) is longer so the ring limit fires first.
  const options = { participantIdentity: identity, fromNumber: env.VOBIZ_CALLER_NUMBER, waitUntilAnswered: true, ringingTimeout: 60, timeout: 65 };
  await livekit().sip.createSipParticipant('', phoneNumber, room, options, trunk);
}

// Starts a call: creates the room, sends the agent in, then dials in the background. A failed dial deletes the room.
export async function startCall(phoneNumber: string) {
  const room = `call-${randomUUID()}`;
  const identity = room.replace('call-', 'phone-');
  const lk = livekit();
  await lk.room.createRoom({ name: room });
  await lk.agentDispatch.createDispatch(room, agentName, { metadata: JSON.stringify({ identity }) });
  void dial(room, identity, phoneNumber).catch(async (error: unknown) => {
    console.error('dial failed', error);
    await closeRoom(room);
  });
  return { room };
}
