// Deterministic safety net applied AFTER the LLM verdict.
// Invariants: HARD filters exclude on clear failure; SOFT filters never exclude
// (salary, techInclude, companyStage). Unknown data never causes a 'reject' —
// at worst it downgrades 'pass' -> 'maybe'. We never silently drop a lead.

import type { ExtractedLead, FilterConfig } from '../shared/types'

export const defaultFilters: FilterConfig = {
  roles: ['SDE', 'Software Engineer', 'Backend Engineer', 'Full Stack Engineer'],
  locations: ['Bangalore', 'Mumbai', 'Delhi', 'Remote'],
  workModes: ['remote', 'hybrid'],
  experienceMin: 0,
  experienceMax: 2,
  salaryMin: null,
  techInclude: ['Node', 'Python', 'React', 'TypeScript'],
  techExclude: [],
  jobTypes: ['fulltime', 'intern'],
  companyStages: ['seed', 'series_a_b', 'yc'],
  postedWithinDays: 21,
  excludeKeywords: [
    'senior',
    'staff',
    'principal',
    'lead',
    '10+ years',
    'unpaid',
    'commission only',
  ],
  includeKeywords: ['AI', 'founding', '0 to 1'],
  mutedChannels: [],
  unknownHandling: 'pass',
}

const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo))

/** Days between `date` and `now` (positive when date is in the past). */
const ageInDays = (date: Date, now: Date): number =>
  (now.getTime() - date.getTime()) / 86_400_000

/** Returns a copy of `ex` with `verdict`/`verdictReason` overridden. */
const reject = (ex: ExtractedLead, reason: string): ExtractedLead => ({
  ...ex,
  verdict: 'reject',
  verdictReason: reason,
})

export function refineVerdict(
  ex: ExtractedLead,
  filters: FilterConfig,
  rawText: string,
  now: Date = new Date(),
): ExtractedLead {
  const out: ExtractedLead = { ...ex, fitScore: clamp(ex.fitScore, 0, 100) }

  // HARD: exclude keywords in raw text or role.
  const haystack = `${rawText} ${out.role ?? ''}`.toLowerCase()
  for (const kw of filters.excludeKeywords) {
    if (kw && haystack.includes(kw.toLowerCase())) {
      return reject(out, `excluded keyword: "${kw}"`)
    }
  }

  // HARD: clearly over-qualified — both numbers known.
  if (
    filters.experienceMax != null &&
    out.experienceMin != null &&
    out.experienceMin > filters.experienceMax
  ) {
    return reject(out, `requires ${out.experienceMin}+ yrs`)
  }

  // HARD: stale posting (only when date is valid).
  if (filters.postedWithinDays != null && out.postedDate) {
    const posted = new Date(out.postedDate)
    if (!Number.isNaN(posted.getTime()) && ageInDays(posted, now) > filters.postedWithinDays) {
      return reject(out, 'stale posting')
    }
  }

  // HARD: excluded tech present.
  for (const tech of filters.techExclude) {
    if (out.techStack.some((t) => t.toLowerCase() === tech.toLowerCase())) {
      return reject(out, `excluded tech: ${tech}`)
    }
  }

  // No hard rule fired — keep the LLM verdict, but never let a 'pass' through
  // when a HARD field is unknown. Downgrade to 'maybe' (never reject).
  if (out.verdict === 'pass') {
    const missing =
      out.role == null ||
      (out.location == null && filters.locations.length > 0) ||
      (out.workMode === 'unknown' && filters.workModes.length > 0)
    if (missing) {
      out.verdict = 'maybe'
      out.verdictReason = 'missing data — needs review'
    }
  }

  return out
}
