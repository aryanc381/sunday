import express from 'express';
import { z } from 'zod';
import { startCall } from './call.js';
import { connectDB } from './db.js';
import { env } from './env.js';
import { getTask } from './services/task.service.js';

const app = express();
app.use(express.json());

// A MongoDB id: 24 hex characters.
const taskIdSchema = z.string().regex(/^[a-f\d]{24}$/i);

/*
  purpose: Report whether the voice server is running.
  res: { status, msg }
*/
app.get('/health', (_req, res) => res.json({ status: 200, msg: 'ok' }));

/*
  purpose: Call the person of a saved task again (for example after no_pickup); the call keeps dialing in the background.
  req: { task_id: string }
  res: { status, msg, room }; 202 started, 400 invalid id or already calling, 404 no such task, 500 error.
*/
app.post('/calls', async (req, res) => {
  const taskId = taskIdSchema.safeParse(req.body?.task_id);
  if (!taskId.success) return res.json({ status: 400, msg: 'Invalid task_id.' });
  try {
    const task = await getTask(taskId.data);
    if (!task) return res.json({ status: 404, msg: 'No such task.' });
    if (task.status === 'calling') return res.json({ status: 400, msg: 'This task is already being called.' });
    const { room } = await startCall(task.phone, 'task', taskId.data);
    return res.json({ status: 202, msg: 'Call started', room });
  } catch (error) {
    console.error('startCall failed', error);
    return res.json({ status: 500, msg: 'Could not place the call.' });
  }
});

await connectDB();
app.listen(env.PORT, () => console.log(`Sunday voice server on :${env.PORT}`));
