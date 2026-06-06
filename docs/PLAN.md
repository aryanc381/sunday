# Lead-Gen — Autonomous Job Lead Aggregator

**Type:** Feature (personal project)
**Form factor:** Electron desktop app (all-local, local-first)
**Status:** Planned — not yet started

---

## 1. Overview

A single local desktop app that pulls job opportunities from many channels (email
alerts, Hacker News, WhatsApp groups, the LinkedIn feed), uses a local LLM to
extract structured fields and judge each lead against **your** configurable
filters, and logs only the relevant ones into a built-in tracker (table + kanban).

**The point:** stop spending time *hunting* for jobs. The app does the finding,
extracting, filtering, and de-duping. You only spend time *applying* and updating
status — freeing your hours for portfolio + work-ex.

### Non-goals (explicitly out of scope)
- ❌ Auto-applying to jobs (low quality, ToS bans, reputational risk)
- ❌ Headless LinkedIn scraper bots (gets your account banned)
- ❌ A mobile app (desktop app + optional Sheet sync covers phone access)

---

## 2. Lead Channels

| # | Channel | Mechanism | Autonomous? | Priority |
|---|---------|-----------|-------------|----------|
| 1 | LinkedIn job alerts | Gmail parse | ✅ | v1 |
| 2 | Weekday | Gmail parse | ✅ | v1 |
| 3 | Wellfound (AngelList) | Gmail parse | ✅ | v1 |
| 4 | Naukri / Instahyre / Cutshort | Gmail parse | ✅ | v1 |
| 5 | YC Work-at-a-Startup | Gmail parse | ✅ | v1 |
| 6 | HN "Who is Hiring" | Public API (Algolia) | ✅ fully | v1 |
| 7 | LinkedIn FEED "hiring posts" | In-app webview + data-intercept | ⚠️ you scroll | v1 |
| 8 | WhatsApp job group(s) | Baileys (WhatsApp Web protocol) | ⚠️ session linked | v1 |
| 9 | Twitter/X #hiring (optional) | API / intercept | ⚠️ | later |

**Channels 1–6 run without you. 7 needs your scroll. 8 needs a linked session.**

---

## 3. Architecture (Electron, all-local)

```
╔════════════════════ ELECTRON APP (one window, all local) ═══════════════════════╗
║                                                                                  ║
║  MAIN PROCESS (Node backend — no separate server to host)                        ║
║   ├── Ingesters:  Gmail parser · HN fetcher · WhatsApp (Baileys) · LinkedIn feed ║
║   ├── LLM service →  OLLAMA (local)  [+ optional cloud fallback for ambiguous]    ║
║   ├── Filter engine (reads your config)                                           ║
║   ├── Dedupe                                                                      ║
║   ├── Data store →  SQLite (local)   ← replaces Google Sheets being "elsewhere"   ║
║   └── Scheduler (cron for autonomous channels)                                    ║
║                                                                                  ║
║  RENDERER (the UI)                                                                ║
║   ├── 🌐 Embedded browser pane (webview) → log into LinkedIn & scroll HERE        ║
║   │        capture script injected directly (no Chrome extension needed)          ║
║   ├── 📋 Leads view (table + kanban: New → Applied → Pending → Interview → Offer)  ║
║   ├── ⚙️ Filters screen (config)                                                   ║
║   ├── 📊 Run log + health dashboard                                               ║
║   └── 🔔 live toasts / notifications                                              ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

### What each "old" piece becomes
```
Chrome extension   →  injected script on the in-app webview (no store, no separate ext)
Separate backend   →  Electron main process (Node)
Google Sheets      →  local SQLite + in-app table/kanban UI (+ optional Sheet sync)
Cloud LLM          →  Ollama locally (free, private), cloud fallback optional
```

---

## 4. Data Flow

```
[Email 1-5] ─┐
[HN API 6]  ─┤
[LinkedIn 7]─┼─► raw leads ─► [LLM: extract + match vs Filters] ─┬─► PASS  → SQLite (New)
[WhatsApp 8]─┘                        ▲                          ├─► MAYBE → Review
                                      │                          └─► REJECT→ reject_log
                              [Filters config]                          │
                                                                        ▼
                                                          🔔 feedback (toast / digest)
                                                                        │
                                                                        ▼
                                                   YOU: review → apply → set status
```

**One LLM call per lead does both extraction AND filter-matching** (see §7).

---

## 5. SQLite Schema

### `leads`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (uuid) | PK |
| source_channel | TEXT | linkedin_feed \| linkedin_alert \| weekday \| wellfound \| naukri \| hn \| whatsapp |
| raw_text | TEXT | original message/post |
| role | TEXT | extracted |
| company | TEXT | extracted |
| location | TEXT | extracted |
| work_mode | TEXT | remote \| hybrid \| onsite \| unknown |
| experience_min | INTEGER | nullable |
| experience_max | INTEGER | nullable |
| salary_min | INTEGER | nullable |
| salary_max | INTEGER | nullable |
| salary_currency | TEXT | nullable |
| tech_stack | TEXT (json) | array |
| job_type | TEXT | fulltime \| intern \| contract \| unknown |
| company_stage | TEXT | seed \| series_a_b \| bigtech \| yc \| unknown |
| contact | TEXT | email/phone/profile if present |
| apply_link | TEXT | nullable |
| posted_date | TEXT (iso) | nullable |
| fit_score | INTEGER | 0–100 |
| verdict | TEXT | pass \| maybe \| reject |
| verdict_reason | TEXT | LLM rationale |
| status | TEXT | new \| applied \| skipped \| pending \| interview \| offer \| rejected |
| dedupe_hash | TEXT | indexed, unique-ish |
| created_at | TEXT (iso) | |
| updated_at | TEXT (iso) | |

### `filters` (single-row config, or key-value)
Holds the user's filter config (see §6).

### `run_log`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | PK |
| run_at | TEXT (iso) | |
| channel | TEXT | |
| found | INTEGER | |
| added | INTEGER | |
| review | INTEGER | |
| rejected | INTEGER | |
| errors | TEXT (json) | |

### `reject_log`
Rejected leads kept (not silently dropped) so you can see if filters are too strict.

**Dedupe rule:** `dedupe_hash = sha1(normalize(company) + "|" + normalize(role) + "|" + (apply_link || first_80_chars(raw_text)))`.

---

## 6. Filter Config Schema

```jsonc
{
  "roles":            ["SDE", "Backend Engineer", "ML Engineer"],   // fuzzy/semantic match
  "locations":        ["Bangalore", "Mumbai", "Delhi", "Remote"],
  "work_modes":       ["remote", "hybrid"],                          // [] = any
  "experience_min":   0,
  "experience_max":   2,
  "salary_min":       null,                                          // SOFT (see below)
  "tech_include":     ["Node", "Python", "React"],                   // SOFT (boost)
  "tech_exclude":     ["PHP", ".NET"],
  "job_types":        ["fulltime", "intern"],
  "company_stages":   ["seed", "series_a_b", "yc"],                  // SOFT
  "posted_within_days": 14,
  "exclude_keywords": ["senior", "lead", "10+ yrs", "unpaid", "commission-only"],
  "include_keywords": ["AI", "founding", "0 to 1"],                  // boost
  "muted_channels":   [],                                            // e.g. silence a noisy group

  "hard_vs_soft": {
    "roles": "hard", "locations": "hard", "work_modes": "hard",
    "job_types": "hard", "posted_within_days": "hard", "exclude_keywords": "hard",
    "experience": "hard",                                            // only if clearly stated & over
    "salary_min": "soft", "tech_include": "soft", "company_stages": "soft"
  },

  "unknown_handling": "pass"   // missing field → don't reject → route to MAYBE
}
```

### Critical rules
- **Salary is SOFT.** ~80% of posts omit salary; a hard salary filter would drop almost everything.
- **Unknown → PASS → MAYBE bucket.** Never silently lose a lead for missing data.
- **HARD = exclude on fail. SOFT = rank/score, never exclude.**

---

## 7. LLM Extract + Filter (the core)

One call per lead. Cheap/local model (Ollama default). Cloud fallback for `maybe`/ambiguous.

**Input:** `raw_text` + `filters config`
**Output (structured JSON):**
```jsonc
{
  "role": "...", "company": "...", "location": "...", "work_mode": "...",
  "experience_min": 0, "experience_max": 2,
  "salary_min": null, "salary_max": null, "salary_currency": null,
  "tech_stack": ["..."], "job_type": "...", "company_stage": "...",
  "contact": "...", "apply_link": "...", "posted_date": "...",
  "verdict": "pass | maybe | reject",
  "fit_score": 0,
  "verdict_reason": "one line: why pass/maybe/reject"
}
```

**Prompt structure:**
- System: "You extract structured job data from messy text AND judge fit against the user's criteria. Output only valid JSON matching the schema. For missing fields use null and lean toward `maybe`, never `reject`, on missing data."
- User: filters config + the raw lead text.

**LLM provider design — SWAPPABLE (important):**
```
default: Ollama (local, free, private) — bulk extraction
fallback: cloud (cheap model) — for ambiguous "maybe" leads, if "hybrid" mode on
config toggle: "local_only" | "hybrid"
```
> ⚠️ **Validate the local model on ~20 real posts before committing.** Extraction +
> fit-judging on messy WhatsApp/LinkedIn text is where small local models get flaky.
> If quality is poor in `local_only`, use `hybrid`. (If cloud: cache the filter
> config + system prompt, vary only the post.)

---

## 8. Channel Internals

### 8.1 Gmail parser (channels 1–5)
- Auth via Gmail API (OAuth) or app-password IMAP.
- Set job alerts on each platform → they email you.
- Poll inbox on schedule → for new alert emails, extract job blocks → feed to LLM.
- Mark processed (label/flag) for idempotency.

### 8.2 HN fetcher (channel 6)
- Algolia HN API: find latest "Ask HN: Who is hiring?" thread, fetch all comments.
- Each top-level comment = one lead → LLM.
- Run monthly (thread posted 1st of month) + re-scan for late comments.

### 8.3 LinkedIn feed capture (channel 7)
- Embedded `<webview>` / `WebContentsView` loads linkedin.com; you log in once (session persisted).
- **Data-intercept, NOT DOM-scrape:** hook the feed's network/JSON responses (the
  batches LinkedIn fetches as you scroll) → read post data from the payload.
  → immune to virtualized-DOM recycling → **fast scroll = more coverage, no misses.**
- Filter to "hiring posts" (keywords: hiring, we're looking for, DM, #hiring) → LLM.
- Stays in YOUR real session (human-driven) → far lower ban risk than a headless bot.
- Each captured post → backend → returns verdict → 🔔 live toast (see §9).

### 8.4 WhatsApp listener (channel 8)
- Baileys / whatsapp-web.js — link your number via QR (shown in app UI).
- Listen to configured group(s); each new message → LLM.
- ⚠️ Unofficial → small ban risk; read-only/low-volume is generally fine.

---

## 9. Feedback & Observability (the trust layer)

### Live (LinkedIn scroll session — you're present)
```
1. In-page TOAST per job:  ✅ "Backend Eng @ Acme → added"
                           🟡 "ML Intern @ Foo → Review (salary unknown)"
                           ❌ "Failed: sheet write error — retrying"
2. BADGE COUNTER on app/icon: live count this session
3. POPUP/PANEL LOG: scrollable session feed + 🟢/🔴 health dot
```
> **Notify on the REAL outcome, not on detection.** Toast fires only AFTER the
> backend confirms the row was written/verdict reached (~1–2s round trip). True
> confidence, not theater.

### Autonomous channels (you're away)
```
1. RUN LOG (in-app table + SQLite): time | channel | found | added | review | rejected | errors
2. DAILY DIGEST notification: "🟢 18 added · 4 Review · ⚠️ WhatsApp disconnected — rescan QR"
```

### Failures are LOUDER than successes
```
Success → quiet toast
Failure → OS notification + 🔴 health dot
   triggers: LLM error · SQLite/quota error · backend unreachable ·
             WhatsApp session dropped · auth expired
```

---

## 10. Tech Stack

| Concern | Choice |
|---------|--------|
| Shell | Electron |
| UI | React + Vite (renderer) |
| Backend | Node (Electron main process) |
| DB | SQLite (better-sqlite3) |
| LLM | Ollama (local) + optional cloud fallback (swappable provider interface) |
| LinkedIn | embedded webview + network-intercept capture script |
| WhatsApp | Baileys / whatsapp-web.js |
| HN | Algolia HN API |
| Email | Gmail API (OAuth) or IMAP |
| Scheduler | node-cron (in main process) |
| Notifications | Electron Notification API + in-page toasts |
| Background run | system tray + auto-start on login |
| Optional sync | one-way SQLite → Google Sheets (for phone access) |

---

## 11. Build Order (ship a vertical slice first)

> Rule: get **one** channel fully through the pipe before adding more.

```
M0  Electron skeleton + SQLite + Leads table UI (manually add a lead, see it render)
M1  LLM service (Ollama + cloud fallback) — test extract+filter on pasted text
M2  Channel 6 (HN API) end-to-end: fetch → LLM → filter → SQLite → table   ← proves pipeline
M3  Filters config UI (§6) + Review tab + reject_log
M4  Channel 1–5 (Gmail parser) + scheduler + Run Log
M5  Channel 7 (LinkedIn webview + intercept capture + live toasts + health dot)
M6  Channel 8 (WhatsApp/Baileys listener)
M7  Tray + auto-start + daily digest notification
M8  (optional) Google Sheets one-way sync
M9  (optional) Channel 9 (Twitter/X)
```

**M0→M2 is the smallest thing that proves the whole idea works.** Stop and validate
LLM extraction quality there before building more.

---

## 12. Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Data source for LinkedIn feed | Network-intercept in webview (not DOM-scrape, not headless bot) | Fast-scroll-safe + protects your account |
| App shape | Electron (all-local) | One place; no hosting; strong portfolio piece |
| Data store | SQLite + in-app UI (+ optional Sheet sync) | Consolidated & private; sync keeps phone access |
| LLM | Ollama default, cloud fallback, swappable | Free/private, but don't risk lead quality on local-only |
| Filtering | One LLM call extracts + judges fit | Handles unstructured posts + unstated fields |
| Salary filter | SOFT | Most posts omit it |
| Unknown fields | Route to MAYBE, never reject | Never silently lose a good lead |
| Auto-apply | Excluded | ToS/ban/reputation risk |

---

## 13. Risks & Validations

| Risk | Mitigation / Validation |
|------|------------------------|
| Local LLM extraction quality poor | Validate on 20 real posts at M2; use `hybrid` if needed |
| LinkedIn flags embedded webview / login challenge | Real Chromium UA + persistent session; validate login at M5 |
| WhatsApp number ban (Baileys) | Read-only, low volume; consider secondary number in group |
| Filters too strict → miss good jobs | MAYBE bucket + reject_log to tune, not blind-trust |
| Electron must be open for autonomous channels | Tray + auto-start on login |
| Fast scroll misses posts | Solved by data-intercept (not DOM) capture |

---

## 14. Open Questions
- Which exact WhatsApp group(s) to listen to? (need group names at M6)
- Local model pick: Llama 3.1 8B vs Qwen2.5 7B vs Mistral — decide at M1 by testing on real posts.
- Cloud fallback provider/key — only if `hybrid` mode is needed.
