import { fileURLToPath } from 'node:url';
import { ServerOptions, cli, defineAgent, voice, waitForParticipantAttribute, type JobContext } from '@livekit/agents';
import { agentName, closeRoom } from './call.js';
import { greetingInstructions, systemPrompt } from './prompt.js';
import { createSession } from './session.js';

// Joins the call, waits until the phone is answered, speaks first, then the session handles the conversation until hangup.
async function runVoiceAgent(ctx: JobContext) {
  const room = ctx.job.room?.name;
  const { identity } = JSON.parse(ctx.job.metadata) as { identity?: string };
  if (!room || !identity) throw new Error('The dispatch is missing the room or phone identity.');

  const session = await createSession();
  // When the call ends or a provider fails, shut down and delete the room so the phone hangs up.
  session.on(voice.AgentSessionEventTypes.Close, () => ctx.shutdown('Call ended'));
  session.on(voice.AgentSessionEventTypes.Error, ({ error }) => {
    console.error('voice provider failed', error);
    ctx.shutdown('Voice provider failed');
  });
  ctx.addShutdownCallback(() => closeRoom(room));

  await session.start({ agent: new voice.Agent({ instructions: systemPrompt }), room: ctx.room, inputOptions: { participantIdentity: identity } });
  await ctx.waitForParticipant(identity);
  await waitForParticipantAttribute({ room: ctx.room, identity, attribute: 'sip.callStatus', value: 'active' });
  session.generateReply({ instructions: greetingInstructions });
}

export default defineAgent({ entry: runVoiceAgent });

// Starts the worker when this file is run directly: `npm run worker -w @sunday/voice`.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName }));
}
