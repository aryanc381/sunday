# Voice agent

One-line description: a phone agent you call to give a task; it calls the person, does the task, and calls you back with the result.

The full plan is in `plans/outbound-task-agent.md`.

## Scope
- `apps/voice` in this turborepo: an Express server plus a LiveKit agent worker.
- Inbound from one allowed number (intake), outbound to the person (task), outbound to the owner (report).
- MongoDB with two collections: `contacts` and `tasks`.

## Design
- Each turn the LLM returns one JSON object that Sarvam must match; the code runs its `action`.
- LiveKit's pipeline handles speech: Silero VAD, Sarvam STT, Sarvam TTS (`bulbul:v4-flash`). The LLM runs outside it, in `call-agent.ts`.
- Dials use LiveKit SIP with a Vobiz outbound trunk; inbound uses an inbound trunk that accepts only the owner's number.

## Later
- Retry on `no_pickup`, a passphrase for inbound, Vobiz webhooks for call events.
