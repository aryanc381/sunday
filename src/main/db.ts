// SQLite storage. Electron-free (path injected) so it's unit-testable under node.
import Database from 'better-sqlite3'
import { createHash, randomUUID } from 'node:crypto'
import type {
  ExtractedLead,
  Lead,
  LeadStatus,
  RawLead,
  RunResult,
  Verdict
} from '../shared/types'

export type DB = Database.Database

const SCHEMA = `
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  source_channel TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  role TEXT, company TEXT, location TEXT,
  work_mode TEXT, job_type TEXT, company_stage TEXT,
  experience_min INTEGER, experience_max INTEGER,
  salary_min INTEGER, salary_max INTEGER, salary_currency TEXT,
  tech_stack TEXT, contact TEXT, apply_link TEXT, posted_date TEXT,
  fit_score INTEGER, verdict TEXT, verdict_reason TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  dedupe_hash TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_dedupe ON leads(dedupe_hash);
CREATE INDEX IF NOT EXISTS idx_leads_verdict ON leads(verdict);

CREATE TABLE IF NOT EXISTS run_log (
  id TEXT PRIMARY KEY, run_at TEXT NOT NULL, channel TEXT NOT NULL,
  found INTEGER, added INTEGER, review INTEGER, rejected INTEGER, errors TEXT
);

CREATE TABLE IF NOT EXISTS reject_log (
  id TEXT PRIMARY KEY, source_channel TEXT, raw_text TEXT,
  role TEXT, company TEXT, reason TEXT, created_at TEXT NOT NULL
);
`

export function initDb(dbPath: string): DB {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(SCHEMA)
  return db
}

const norm = (s: string | null | undefined): string =>
  (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Stable hash for de-duplication: company|role|(link or first 80 chars of text). */
export function dedupeHash(raw: RawLead, ex: ExtractedLead): string {
  const link = ex.applyLink || raw.applyLink
  const tail = link ? norm(link) : norm(raw.rawText).slice(0, 80)
  return createHash('sha1')
    .update(`${norm(ex.company)}|${norm(ex.role)}|${tail}`)
    .digest('hex')
}

function rowToLead(r: any): Lead {
  return {
    id: r.id,
    sourceChannel: r.source_channel,
    rawText: r.raw_text,
    role: r.role,
    company: r.company,
    location: r.location,
    workMode: r.work_mode,
    jobType: r.job_type,
    companyStage: r.company_stage,
    experienceMin: r.experience_min,
    experienceMax: r.experience_max,
    salaryMin: r.salary_min,
    salaryMax: r.salary_max,
    salaryCurrency: r.salary_currency,
    techStack: r.tech_stack ? JSON.parse(r.tech_stack) : [],
    contact: r.contact,
    applyLink: r.apply_link,
    postedDate: r.posted_date,
    fitScore: r.fit_score,
    verdict: r.verdict,
    verdictReason: r.verdict_reason,
    status: r.status,
    dedupeHash: r.dedupe_hash,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

export function leadExists(db: DB, hash: string): boolean {
  return !!db.prepare('SELECT 1 FROM leads WHERE dedupe_hash = ?').get(hash)
}

/** Insert a processed lead. Returns the Lead, or null if it's a duplicate. */
export function insertLead(db: DB, raw: RawLead, ex: ExtractedLead): Lead | null {
  const hash = dedupeHash(raw, ex)
  if (leadExists(db, hash)) return null
  const now = new Date().toISOString()
  const lead: Lead = {
    ...ex,
    id: randomUUID(),
    sourceChannel: raw.sourceChannel,
    rawText: raw.rawText,
    status: 'new',
    dedupeHash: hash,
    createdAt: now,
    updatedAt: now
  }
  db.prepare(
    `INSERT INTO leads (
      id, source_channel, raw_text, role, company, location,
      work_mode, job_type, company_stage, experience_min, experience_max,
      salary_min, salary_max, salary_currency, tech_stack, contact, apply_link,
      posted_date, fit_score, verdict, verdict_reason, status, dedupe_hash,
      created_at, updated_at
    ) VALUES (
      @id, @sourceChannel, @rawText, @role, @company, @location,
      @workMode, @jobType, @companyStage, @experienceMin, @experienceMax,
      @salaryMin, @salaryMax, @salaryCurrency, @techStack, @contact, @applyLink,
      @postedDate, @fitScore, @verdict, @verdictReason, @status, @dedupeHash,
      @createdAt, @updatedAt
    )`
  ).run({ ...lead, techStack: JSON.stringify(lead.techStack) })
  return lead
}

export function listLeads(
  db: DB,
  opts: { verdict?: Verdict; status?: LeadStatus } = {}
): Lead[] {
  const where: string[] = []
  const params: any[] = []
  if (opts.verdict) (where.push('verdict = ?'), params.push(opts.verdict))
  if (opts.status) (where.push('status = ?'), params.push(opts.status))
  const sql =
    `SELECT * FROM leads` +
    (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ` ORDER BY fit_score DESC, created_at DESC`
  return db.prepare(sql).all(...params).map(rowToLead)
}

export function updateStatus(db: DB, id: string, status: LeadStatus): void {
  db.prepare('UPDATE leads SET status = ?, updated_at = ? WHERE id = ?').run(
    status,
    new Date().toISOString(),
    id
  )
}

export function insertReject(db: DB, raw: RawLead, ex: ExtractedLead): void {
  db.prepare(
    `INSERT INTO reject_log (id, source_channel, raw_text, role, company, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    raw.sourceChannel,
    raw.rawText,
    ex.role,
    ex.company,
    ex.verdictReason,
    new Date().toISOString()
  )
}

export function logRun(db: DB, r: RunResult): void {
  db.prepare(
    `INSERT INTO run_log (id, run_at, channel, found, added, review, rejected, errors)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    new Date().toISOString(),
    r.channel,
    r.found,
    r.added,
    r.review,
    r.rejected,
    JSON.stringify(r.errors)
  )
}
