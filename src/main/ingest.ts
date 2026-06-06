// Orchestrator: raw leads -> LLM extract+filter -> deterministic refine -> dedupe -> store.
// Reused by every channel (HN now; Gmail/LinkedIn/WhatsApp later).
import type {
  FilterConfig,
  Lead,
  LlmProvider,
  RawLead,
  RunResult,
  SourceChannel,
  Verdict
} from '../shared/types'
import type { DB } from './db'
import { insertLead, insertReject, logRun } from './db'
import { refineVerdict } from './filters'

/** Optional per-lead hook — the feedback/toast layer (M5) plugs in here. */
export type OnLead = (e: { lead?: Lead; verdict: Verdict; error?: string }) => void

export async function ingestLeads(
  db: DB,
  channel: SourceChannel,
  rawLeads: RawLead[],
  llm: LlmProvider,
  filters: FilterConfig,
  onLead?: OnLead
): Promise<RunResult> {
  const result: RunResult = {
    channel,
    found: rawLeads.length,
    added: 0,
    review: 0,
    rejected: 0,
    errors: []
  }

  if (filters.mutedChannels.includes(channel)) {
    logRun(db, result)
    return result
  }

  for (const raw of rawLeads) {
    try {
      const extracted = await llm.extractAndFilter(raw.rawText, filters)
      const ex = refineVerdict(extracted, filters, raw.rawText)

      if (ex.verdict === 'reject') {
        insertReject(db, raw, ex)
        result.rejected++
        onLead?.({ verdict: 'reject' })
        continue
      }

      const lead = insertLead(db, raw, ex) // null when duplicate
      if (!lead) {
        onLead?.({ verdict: ex.verdict, error: 'duplicate' })
        continue
      }

      if (ex.verdict === 'pass') result.added++
      else result.review++
      onLead?.({ lead, verdict: ex.verdict })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      result.errors.push(msg)
      onLead?.({ verdict: 'maybe', error: msg })
    }
  }

  logRun(db, result)
  return result
}
