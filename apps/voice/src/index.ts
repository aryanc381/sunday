import express from 'express';
import { z } from 'zod';
import { startCall } from './call.js';
import { env } from './env.js';

const app = express();
app.use(express.json());

// E.164 phone number, for example +919876543210.
const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/);

/*
  purpose: Report whether the voice server is running.
  res: { status, msg }
*/
app.get('/health', (_req, res) => res.json({ status: 200, msg: 'ok' }));

/*
  purpose: Start an outbound phone call and reply at once; the call keeps dialing in the background.
  req: { phone_number: string }
  res: { status, msg, room }; 202 started, 400 invalid number, 500 error.
*/
app.post('/calls', async (req, res) => {
  const parsed = phoneSchema.safeParse(req.body?.phone_number);
  if (!parsed.success) return res.json({ status: 400, msg: 'Invalid phone number. Use +<country code><number>.' });
  try {
    const { room } = await startCall(parsed.data);
    return res.json({ status: 202, msg: 'Call started', room });
  } catch (error) {
    console.error('startCall failed', error);
    return res.json({ status: 500, msg: 'Could not place the call.' });
  }
});

app.listen(env.PORT, () => console.log(`Sunday voice server on :${env.PORT}`));
