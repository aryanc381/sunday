// LLM extract+filter layer. Lean, swappable providers (Ollama local / Anthropic).
import type {
  ExtractedLead,
  FilterConfig,
  LlmProvider,
  LlmMode,
  WorkMode,
  JobType,
  CompanyStage,
  Verdict,
} from '../shared/types'

const WORK_MODES: WorkMode[] = ['remote', 'hybrid', 'onsite', 'unknown']
const JOB_TYPES: JobType[] = ['fulltime', 'intern', 'contract', 'unknown']
const COMPANY_STAGES: CompanyStage[] = ['seed', 'series_a_b', 'bigtech', 'yc', 'unknown']
const VERDICTS: Verdict[] = ['pass', 'maybe', 'reject']

/** A safe, complete ExtractedLead. Used as the parse fallback and coercion base. */
function safeLead(overrides: Partial<ExtractedLead> = {}): ExtractedLead {
  return {
    role: null,
    company: null,
    location: null,
    workMode: 'unknown',
    experienceMin: null,
    experienceMax: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    techStack: [],
    jobType: 'unknown',
    companyStage: 'unknown',
    contact: null,
    applyLink: null,
    postedDate: null,
    verdict: 'maybe',
    fitScore: 0,
    verdictReason: '',
    ...overrides,
  }
}

export function buildPrompt(rawText: string, filters: FilterConfig): { system: string; user: string } {
  const system = [
    'You are a job-lead extraction and filtering engine.',
    'You do TWO things in one pass: (1) extract structured fields from a raw job posting, and (2) judge how well it fits the user\'s filters.',
    'Respond with ONLY a single valid JSON object matching this exact shape (no markdown, no prose, no code fences):',
    '{',
    '  "role": string|null,',
    '  "company": string|null,',
    '  "location": string|null,',
    '  "workMode": "remote"|"hybrid"|"onsite"|"unknown",',
    '  "experienceMin": number|null,',
    '  "experienceMax": number|null,',
    '  "salaryMin": number|null,',
    '  "salaryMax": number|null,',
    '  "salaryCurrency": string|null,',
    '  "techStack": string[],',
    '  "jobType": "fulltime"|"intern"|"contract"|"unknown",',
    '  "companyStage": "seed"|"series_a_b"|"bigtech"|"yc"|"unknown",',
    '  "contact": string|null,',
    '  "applyLink": string|null,',
    '  "postedDate": string|null,',
    '  "verdict": "pass"|"maybe"|"reject",',
    '  "fitScore": number,',
    '  "verdictReason": string',
    '}',
    'Rules:',
    '- Any field not present in the text MUST be null (or "unknown" for the enum fields, or [] for techStack). Never invent data.',
    '- salary is a SOFT signal: NEVER reject a lead just because salary is missing or below a target.',
    '- techInclude and companyStages filters are SOFT preferences, not hard gates.',
    '- When data is missing or you are unsure, prefer verdict "maybe". Reserve "reject" for clear, confident mismatches against HARD filters (e.g. excludeKeywords, mutually exclusive role/location/jobType). When in doubt, never "reject".',
    '- fitScore is an integer 0-100 reflecting overall fit vs the filters (higher = better fit).',
    '- verdictReason is one short sentence explaining the verdict.',
  ].join('\n')

  const user = [
    'FILTERS (JSON):',
    JSON.stringify(filters),
    '',
    'RAW LEAD TEXT:',
    rawText,
    '',
    'Return ONLY the JSON object.',
  ].join('\n')

  return { system, user }
}

function clampScore(n: unknown): number {
  const x = typeof n === 'number' && Number.isFinite(n) ? n : 0
  return Math.max(0, Math.min(100, Math.round(x)))
}

function asStringOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

function asNumberOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0)
}

function whitelist<T extends string>(v: unknown, allowed: T[], fallback: T): T {
  return typeof v === 'string' && (allowed as string[]).includes(v) ? (v as T) : fallback
}

/** Extract the first balanced {...} JSON object from arbitrary text. */
function firstJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

/** Robustly parse model output into a complete ExtractedLead. NEVER throws. */
export function parseExtracted(text: string): ExtractedLead {
  try {
    if (typeof text !== 'string') return safeLead({ verdictReason: 'llm parse failed' })
    // Strip markdown code fences if present.
    const cleaned = text.replace(/```(?:json)?/gi, '')
    const jsonStr = firstJsonObject(cleaned)
    if (!jsonStr) return safeLead({ verdictReason: 'llm parse failed' })

    const raw = JSON.parse(jsonStr) as Record<string, unknown>
    if (raw === null || typeof raw !== 'object') {
      return safeLead({ verdictReason: 'llm parse failed' })
    }

    return safeLead({
      role: asStringOrNull(raw.role),
      company: asStringOrNull(raw.company),
      location: asStringOrNull(raw.location),
      workMode: whitelist(raw.workMode, WORK_MODES, 'unknown'),
      experienceMin: asNumberOrNull(raw.experienceMin),
      experienceMax: asNumberOrNull(raw.experienceMax),
      salaryMin: asNumberOrNull(raw.salaryMin),
      salaryMax: asNumberOrNull(raw.salaryMax),
      salaryCurrency: asStringOrNull(raw.salaryCurrency),
      techStack: asStringArray(raw.techStack),
      jobType: whitelist(raw.jobType, JOB_TYPES, 'unknown'),
      companyStage: whitelist(raw.companyStage, COMPANY_STAGES, 'unknown'),
      contact: asStringOrNull(raw.contact),
      applyLink: asStringOrNull(raw.applyLink),
      postedDate: asStringOrNull(raw.postedDate),
      verdict: whitelist(raw.verdict, VERDICTS, 'maybe'),
      fitScore: clampScore(raw.fitScore),
      verdictReason: asStringOrNull(raw.verdictReason) ?? '',
    })
  } catch {
    return safeLead({ verdictReason: 'llm parse failed' })
  }
}

const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434'
const DEFAULT_OLLAMA_MODEL = 'llama3.1'
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'

export class OllamaProvider implements LlmProvider {
  readonly name = 'ollama'
  private host: string
  private model: string
  private fetchImpl: typeof fetch

  constructor(opts: { host?: string; model?: string; fetchImpl?: typeof fetch } = {}) {
    this.host = opts.host ?? DEFAULT_OLLAMA_HOST
    this.model = opts.model ?? DEFAULT_OLLAMA_MODEL
    this.fetchImpl = opts.fetchImpl ?? fetch
  }

  async available(): Promise<boolean> {
    try {
      const res = await this.fetchImpl(`${this.host}/api/tags`)
      return res.ok
    } catch {
      return false
    }
  }

  async extractAndFilter(rawText: string, filters: FilterConfig): Promise<ExtractedLead> {
    const { system, user } = buildPrompt(rawText, filters)
    const res = await this.fetchImpl(`${this.host}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        system,
        prompt: user,
        stream: false,
        format: 'json',
      }),
    })
    const data = (await res.json()) as { response?: string }
    return parseExtracted(data.response ?? '')
  }
}

type CreateMessageFn = (args: {
  model: string
  system: string
  user: string
}) => Promise<{ text: string }>

export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic'
  private apiKey: string | undefined
  private model: string
  private createMessage: CreateMessageFn | undefined

  constructor(opts: { apiKey?: string; model?: string; createMessage?: CreateMessageFn } = {}) {
    this.apiKey = opts.apiKey
    this.model = opts.model ?? ANTHROPIC_MODEL
    this.createMessage = opts.createMessage
  }

  async available(): Promise<boolean> {
    if (this.createMessage) return true
    return !!this.apiKey
  }

  private async defaultCreateMessage(args: { model: string; system: string; user: string }): Promise<{ text: string }> {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: this.apiKey })
    // cache_control on the system block is a prompt-caching feature; older SDK
    // type defs (0.27.x) don't include it yet though the API accepts it.
    const params = {
      model: args.model,
      max_tokens: 1024,
      system: [{ type: 'text', text: args.system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: args.user }],
    } as unknown as Parameters<typeof client.messages.create>[0]
    // Non-streaming body => a Message; cast to a minimal shape for the older SDK union.
    const resp = (await client.messages.create(params)) as unknown as {
      content: Array<{ type: string; text?: string }>
    }
    const block = resp.content[0]
    const text = block && block.type === 'text' && block.text ? block.text : ''
    return { text }
  }

  async extractAndFilter(rawText: string, filters: FilterConfig): Promise<ExtractedLead> {
    const { system, user } = buildPrompt(rawText, filters)
    const fn = this.createMessage ?? ((args) => this.defaultCreateMessage(args))
    const { text } = await fn({ model: this.model, system, user })
    return parseExtracted(text)
  }
}

export function getLlm(
  mode: LlmMode,
  opts: {
    anthropicApiKey?: string
    ollamaModel?: string
    ollamaHost?: string
    ollamaFetch?: typeof fetch
    createMessage?: CreateMessageFn
  } = {},
): LlmProvider {
  const ollama = new OllamaProvider({
    host: opts.ollamaHost,
    model: opts.ollamaModel,
    fetchImpl: opts.ollamaFetch,
  })

  if (mode === 'local_only') return ollama

  const anthropic = new AnthropicProvider({
    apiKey: opts.anthropicApiKey,
    createMessage: opts.createMessage,
  })

  return {
    name: 'hybrid',
    async available(): Promise<boolean> {
      return (await ollama.available()) || (await anthropic.available())
    },
    async extractAndFilter(rawText: string, filters: FilterConfig): Promise<ExtractedLead> {
      if (await ollama.available()) return ollama.extractAndFilter(rawText, filters)
      return anthropic.extractAndFilter(rawText, filters)
    },
  }
}
