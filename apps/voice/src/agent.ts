import { fileURLToPath } from 'node:url';
import { ServerOptions, cli, defineAgent, voice, waitForParticipantAttribute, type JobContext } from '@livekit/agents';
import { CallAgent, speak } from './call-agent.js';
import { agentName, closeRoom, startCall, type Mode } from './call.js';
import { connectDB } from './db.js';
import { env } from './env.js';
import { digitsOf } from './schemas/phone.schemas.js';
import { intakePrompt } from './prompts/intake.prompts.js';
import { reportLine } from './prompts/report.prompts.js';
import { taskPrompt } from './prompts/task.prompts.js';
import { findContactById } from './services/contact.service.js';
import { completeTask, getTask, saveOutcome } from './services/task.service.js';
import { createSession } from './session.js';

// Said to the LLM when the call connects, so it speaks first.
const connected = '[The call is connected. Speak first.]';

// Joins the call, checks who is on the line, runs the mode's conversation, and starts the next call when it ends.
async function runVoiceAgent(ctx: JobContext) {
  const room = ctx.job.room?.name;
  const { mode, identity, taskId } = JSON.parse(ctx.job.metadata) as { mode?: Mode; identity?: string; taskId?: string };
  if (!room || !mode) throw new Error('The dispatch is missing the room or mode.');
  if (mode !== 'intake' && (!identity || !taskId)) throw new Error('The dispatch is missing the phone identity or task.');

  // Delete the room on any exit, even a crash, so the phone is never left connected to nobody.
  ctx.addShutdownCallback(() => closeRoom(room));
  await connectDB();
  await ctx.connect();
  // Inbound calls have no known identity: the first phone participant in the room is the caller.
  const phone = await ctx.waitForParticipant(identity);
  // sip.phoneNumber is the number the inbound call comes from; compare digits only, as the carrier may leave off the +.
  if (mode === 'intake' && digitsOf(phone.attributes['sip.phoneNumber']) !== digitsOf(env.ALLOWED_CALLER_NUMBER)) {
    console.error('rejected a call from', phone.attributes['sip.phoneNumber']);
    await closeRoom(room);
    return;
  }

  const session = await createSession();
  // When the call ends or a provider fails, shut down and delete the room so the phone hangs up.
  session.on(voice.AgentSessionEventTypes.Close, () => ctx.shutdown('Call ended'));
  session.on(voice.AgentSessionEventTypes.Error, ({ error }) => {
    console.error('voice provider failed', error);
    ctx.shutdown('Voice provider failed');
  });

  const task = taskId ? await getTask(taskId) : null;
  const contact = task ? await findContactById(task.contact_id.toString()) : null;

  if (mode === 'report') {
    if (!task?.outcome || !contact) throw new Error('The task has no result to report.');
    await session.start({ agent: new voice.Agent({ instructions: 'You report a result.' }), room: ctx.room, inputOptions: { participantIdentity: phone.identity } });
    await waitForParticipantAttribute({ room: ctx.room, identity: phone.identity, attribute: 'sip.callStatus', value: 'active' });
    await speak(session, reportLine(contact.name, task.task, task.outcome, task.summary));
    ctx.shutdown('Result told');
    return;
  }

  let system = intakePrompt;
  if (mode === 'task') {
    if (!task || !contact) throw new Error('The task or its contact is missing.');
    system = taskPrompt(contact.name, task.task, task.context);
  }
  const agent = new CallAgent(ctx, mode, system, { taskId });
  ctx.addShutdownCallback(async () => {
    try {
      await finish(mode, agent);
    } catch (error) {
      console.error('finishing the call failed', error);
    }
  });

  await session.start({ agent, room: ctx.room, inputOptions: { participantIdentity: phone.identity } });
  await waitForParticipantAttribute({ room: ctx.room, identity: phone.identity, attribute: 'sip.callStatus', value: 'active' });
  await agent.turn(connected);
}

// After intake: call the person if a task was saved. After the person's call: save the result, then call the owner.
async function finish(mode: Mode, agent: CallAgent) {
  const { taskId } = agent.call;
  if (!taskId) return;
  const task = await getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} is missing.`);
  if (mode === 'intake') {
    await startCall(task.phone, 'task', taskId);
    return;
  }
  // The person hung up before an outcome was saved.
  if (!task.outcome) await saveOutcome(taskId, 'confused', 'The call ended before they confirmed.');
  await completeTask(taskId, agent.transcript);
  await startCall(env.ALLOWED_CALLER_NUMBER, 'report', taskId);
}

export default defineAgent({ entry: runVoiceAgent });

// Starts the worker when this file is run directly: `npm run worker -w @sunday/voice`.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName, port: env.WORKER_PORT }));
}
