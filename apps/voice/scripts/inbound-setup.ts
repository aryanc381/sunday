import { RoomAgentDispatch, RoomConfiguration } from '@livekit/protocol';
import { SipClient } from 'livekit-server-sdk';
import { agentName } from '../src/call.js';
import { env } from '../src/env.js';
import { digitsOf } from '../src/schemas/phone.schemas.js';

// Run once on the server: `npm run inbound-setup -w @sunday/voice`. Makes the Vobiz number answer, but only for the owner's number.
const sip = new SipClient(env.LIVEKIT_URL, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);

// LiveKit and Vobiz both write numbers as +country-code digits. Vobiz's guide sets allowed addresses to 0.0.0.0/0; restrict it in production.
const e164 = (phone: string) => `+${digitsOf(phone)}`;
const trunk = await sip.createSipInboundTrunk('sunday-inbound', [e164(env.VOBIZ_CALLER_NUMBER)], {
  allowedNumbers: [e164(env.ALLOWED_CALLER_NUMBER)],
  allowedAddresses: ['0.0.0.0/0'],
});

// Every accepted call gets its own room and the agent in intake mode.
const roomConfig = new RoomConfiguration({ agents: [new RoomAgentDispatch({ agentName, metadata: JSON.stringify({ mode: 'intake' }) })] });
await sip.createSipDispatchRule({ type: 'individual', roomPrefix: 'intake-' }, { name: 'sunday-intake', trunkIds: [trunk.sipTrunkId], roomConfig });

console.log(`Inbound trunk ${trunk.sipTrunkId} accepts calls to ${e164(env.VOBIZ_CALLER_NUMBER)} from ${e164(env.ALLOWED_CALLER_NUMBER)} only.`);
