# Voice bot

One-line description: an outbound phone-call bot that talks from a single prompt, over Vobiz and LiveKit.

## Scope
- `apps/voice` in this turborepo: an Express server plus a LiveKit agent worker.
- Outbound only. No database, queue or webhooks.

## Design
- One system prompt (`prompt.ts`) drives the whole call; the LLM answers in plain text.
- LiveKit's agent pipeline handles turns: Silero VAD, Sarvam STT, an LLM through Sarvam's OpenAI-compatible API, Sarvam TTS.
- The dial uses LiveKit SIP with a Vobiz outbound trunk (TCP, wait until answered, 60 s ring limit).

## Later
- Inbound calls, a saved transcript, Vobiz webhooks for call events.
