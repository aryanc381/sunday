# Autopilot

Autonomous job-lead aggregator — Electron, local-first. Full design: [`docs/PLAN.md`](docs/PLAN.md).

**Status:** M0–M2 built (Electron shell + SQLite + LLM extract/filter + HN channel). Other channels per the plan are not built yet.

## Run

```bash
npm install
npm run dev        # launches the Electron app
```

In the app, click **Run HN** to pull the latest HN "Who is hiring?" thread → extract → filter → table.

### LLM (required for leads to be processed)

The extract+filter step needs a model. Two options:

```bash
# Option A — local (default, free, private)
#   install Ollama (https://ollama.com), then:
ollama pull llama3.1

# Option B — cloud fallback (hybrid mode)
export LEADGEN_LLM_MODE=hybrid
export ANTHROPIC_API_KEY=sk-...
```

Without either, **Run HN** still fetches postings but every lead errors at the LLM step (nothing gets added) — by design, no silent failures.

## Develop

```bash
npm test           # vitest (unit + ingest pipeline)
npm run typecheck   # tsc --noEmit
npm run build       # electron-vite production build
npm run rebuild     # rebuild better-sqlite3 against Electron's ABI (run if the app errors on the native module)
```

## Layout

```
src/
  shared/   types.ts, ipc.ts        — contracts shared across processes
  main/     index.ts                — Electron entry + IPC
            db.ts                   — SQLite (leads, run_log, reject_log)
            llm.ts                  — Ollama + Anthropic providers (swappable)
            filters.ts              — default config + deterministic safety net
            ingest.ts               — raw → LLM → refine → dedupe → store
            channels/hn.ts          — HN "Who is hiring?" fetcher
  renderer/ App.tsx, main.tsx       — leads table UI
```
