import { describe, it, expect } from 'vitest'
import type { FilterConfig } from '../shared/types'
import { parseExtracted, OllamaProvider, AnthropicProvider, getLlm } from './llm'

const filters: FilterConfig = {
  roles: ['Software Engineer'],
  locations: ['Bangalore'],
  workModes: ['remote'],
  experienceMin: 0,
  experienceMax: 3,
  salaryMin: null,
  techInclude: ['TypeScript'],
  techExclude: [],
  jobTypes: ['fulltime'],
  companyStages: ['seed'],
  postedWithinDays: 30,
  excludeKeywords: [],
  includeKeywords: [],
  mutedChannels: [],
  unknownHandling: 'pass',
}

const fullJson = JSON.stringify({
  role: 'Backend Engineer',
  company: 'Acme',
  location: 'Remote',
  workMode: 'remote',
  experienceMin: 2,
  experienceMax: 5,
  salaryMin: 100000,
  salaryMax: 150000,
  salaryCurrency: 'USD',
  techStack: ['Go', 'Postgres'],
  jobType: 'fulltime',
  companyStage: 'series_a_b',
  contact: 'jobs@acme.com',
  applyLink: 'https://acme.com/apply',
  postedDate: '2026-06-01',
  verdict: 'pass',
  fitScore: 88,
  verdictReason: 'Strong match on role and tech.',
})

describe('parseExtracted', () => {
  it('parses a valid full JSON object', () => {
    const lead = parseExtracted(fullJson)
    expect(lead.role).toBe('Backend Engineer')
    expect(lead.workMode).toBe('remote')
    expect(lead.techStack).toEqual(['Go', 'Postgres'])
    expect(lead.companyStage).toBe('series_a_b')
    expect(lead.verdict).toBe('pass')
    expect(lead.fitScore).toBe(88)
    expect(lead.salaryMin).toBe(100000)
  })

  it('parses JSON wrapped in ```json code fences', () => {
    const lead = parseExtracted('Here you go:\n```json\n' + fullJson + '\n```\nDone.')
    expect(lead.role).toBe('Backend Engineer')
    expect(lead.verdict).toBe('pass')
    expect(lead.fitScore).toBe(88)
  })

  it('fills defaults when most fields are missing', () => {
    const lead = parseExtracted(JSON.stringify({ role: 'Intern', fitScore: 250 }))
    expect(lead.role).toBe('Intern')
    // defaults
    expect(lead.company).toBeNull()
    expect(lead.workMode).toBe('unknown')
    expect(lead.jobType).toBe('unknown')
    expect(lead.companyStage).toBe('unknown')
    expect(lead.techStack).toEqual([])
    expect(lead.verdict).toBe('maybe')
    // fitScore clamped to 100
    expect(lead.fitScore).toBe(100)
  })

  it('returns a safe maybe-lead on total garbage', () => {
    const lead = parseExtracted('this is not json at all !!!')
    expect(lead.verdict).toBe('maybe')
    expect(lead.fitScore).toBe(0)
    expect(lead.verdictReason).toBe('llm parse failed')
  })

  it('clamps an out-of-range (negative) fitScore', () => {
    const lead = parseExtracted(JSON.stringify({ fitScore: -42, verdict: 'reject' }))
    expect(lead.fitScore).toBe(0)
    expect(lead.verdict).toBe('reject')
  })

  it('defaults an invalid verdict to maybe', () => {
    const lead = parseExtracted(JSON.stringify({ verdict: 'banana', fitScore: 50 }))
    expect(lead.verdict).toBe('maybe')
  })
})

describe('OllamaProvider', () => {
  it('extractAndFilter parses an injected fake response', async () => {
    const fakeFetch = (async () =>
      ({ ok: true, json: async () => ({ response: fullJson }) }) as unknown as Response) as typeof fetch
    const provider = new OllamaProvider({ fetchImpl: fakeFetch })
    const lead = await provider.extractAndFilter('raw text', filters)
    expect(lead.role).toBe('Backend Engineer')
    expect(lead.verdict).toBe('pass')
    expect(lead.fitScore).toBe(88)
  })

  it('available() is false when fetch throws', async () => {
    const throwingFetch = (async () => {
      throw new Error('connection refused')
    }) as typeof fetch
    const provider = new OllamaProvider({ fetchImpl: throwingFetch })
    expect(await provider.available()).toBe(false)
  })
})

describe('getLlm', () => {
  it("local_only returns an ollama provider", () => {
    expect(getLlm('local_only').name).toBe('ollama')
  })

  it('hybrid falls back to anthropic when ollama is unavailable', async () => {
    const throwingFetch = (async () => {
      throw new Error('no ollama')
    }) as typeof fetch
    const createMessage = async () => ({ text: fullJson })

    const llm = getLlm('hybrid', { ollamaFetch: throwingFetch, createMessage })
    expect(llm.name).toBe('hybrid')

    const lead = await llm.extractAndFilter('raw text', filters)
    expect(lead.role).toBe('Backend Engineer')
    expect(lead.verdict).toBe('pass')
    expect(lead.fitScore).toBe(88)
  })
})

describe('AnthropicProvider', () => {
  it('available() is true when createMessage is injected', async () => {
    const provider = new AnthropicProvider({ createMessage: async () => ({ text: '{}' }) })
    expect(await provider.available()).toBe(true)
  })

  it('available() reflects apiKey presence without injection', async () => {
    expect(await new AnthropicProvider({}).available()).toBe(false)
    expect(await new AnthropicProvider({ apiKey: 'sk-test' }).available()).toBe(true)
  })
})
