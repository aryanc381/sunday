// Shared contracts — every module builds against these. Keep lean; no duplication.

export type SourceChannel =
  | 'linkedin_feed'
  | 'linkedin_alert'
  | 'weekday'
  | 'wellfound'
  | 'naukri'
  | 'hn'
  | 'whatsapp'

export type WorkMode = 'remote' | 'hybrid' | 'onsite' | 'unknown'
export type JobType = 'fulltime' | 'intern' | 'contract' | 'unknown'
export type CompanyStage = 'seed' | 'series_a_b' | 'bigtech' | 'yc' | 'unknown'
export type Verdict = 'pass' | 'maybe' | 'reject'
export type LeadStatus =
  | 'new'
  | 'applied'
  | 'skipped'
  | 'pending'
  | 'interview'
  | 'offer'
  | 'rejected'

/** A lead as captured from a channel, before LLM processing. */
export interface RawLead {
  sourceChannel: SourceChannel
  rawText: string
  applyLink?: string | null
  postedDate?: string | null // ISO
  /** channel-native id for idempotency (e.g. HN comment id) */
  externalId?: string | null
}

/** Structured fields + verdict produced by the LLM extract+filter step. */
export interface ExtractedLead {
  role: string | null
  company: string | null
  location: string | null
  workMode: WorkMode
  experienceMin: number | null
  experienceMax: number | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  techStack: string[]
  jobType: JobType
  companyStage: CompanyStage
  contact: string | null
  applyLink: string | null
  postedDate: string | null
  verdict: Verdict
  fitScore: number // 0-100
  verdictReason: string
}

/** A fully persisted lead. */
export interface Lead extends ExtractedLead {
  id: string
  sourceChannel: SourceChannel
  rawText: string
  status: LeadStatus
  dedupeHash: string
  createdAt: string
  updatedAt: string
}

export interface FilterConfig {
  roles: string[]
  locations: string[]
  workModes: WorkMode[]
  experienceMin: number | null
  experienceMax: number | null
  salaryMin: number | null // SOFT — never excludes
  techInclude: string[] // SOFT
  techExclude: string[]
  jobTypes: JobType[]
  companyStages: CompanyStage[] // SOFT
  postedWithinDays: number | null
  excludeKeywords: string[]
  includeKeywords: string[]
  mutedChannels: SourceChannel[]
  /** missing field handling — default 'pass' (route to maybe, never silently drop) */
  unknownHandling: 'pass' | 'reject'
}

export type LlmMode = 'local_only' | 'hybrid'

/** Swappable LLM provider contract. */
export interface LlmProvider {
  readonly name: string
  available(): Promise<boolean>
  extractAndFilter(rawText: string, filters: FilterConfig): Promise<ExtractedLead>
}

/** Summary of one channel ingest run (also persisted to run_log). */
export interface RunResult {
  channel: SourceChannel
  found: number
  added: number
  review: number
  rejected: number
  errors: string[]
}
