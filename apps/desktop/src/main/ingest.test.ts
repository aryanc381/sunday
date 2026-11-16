import { describe, expect, it } from 'vitest'
import type { ExtractedLead, LlmProvider, RawLead } from '../shared/types'
import { initDb, listLeads } from './db'
import { defaultFilters } from './filters'
import { ingestLeads } from './ingest'

// Minimal ExtractedLead factory with fields that survive refineVerdict as-is.
function ex(over: Partial<ExtractedLead> = {}): ExtractedLead {
  return {
    role: 'Backend Engineer',
    company: 'Acme',
    location: 'Remote',
    workMode: 'remote',
    experienceMin: 1,
    experienceMax: 2,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    techStack: ['Node'],
    jobType: 'fulltime',
    companyStage: 'seed',
    contact: null,
    applyLink: null,
    postedDate: null,
    verdict: 'pass',
    fitScore: 80,
    verdictReason: 'fits',
    ...over
  }
}

// Fake provider returns queued extractions in order (keyed by call count).
function fakeLlm(queue: ExtractedLead[]): LlmProvider {
  let i = 0
  return {
    name: 'fake',
    available: async () => true,
    extractAndFilter: async () => queue[i++]
  }
}

const raw = (rawText: string): RawLead => ({ sourceChannel: 'hn', rawText })

describe('ingestLeads', () => {
  it('routes pass/maybe/reject, dedupes, and tallies the run', async () => {
    const db = initDb(':memory:')
    const leads: RawLead[] = [
      raw('hiring backend engineer at acme, remote'), // pass
      raw('hiring data role, details unclear'), // maybe (role unknown)
      raw('we need a Senior Staff engineer'), // reject via excludeKeyword
      raw('hiring backend engineer at acme, remote') // duplicate of #1
    ]
    const llm = fakeLlm([
      ex({ company: 'Acme', role: 'Backend Engineer' }),
      ex({ verdict: 'maybe', role: null, company: 'Foo', verdictReason: 'unclear' }),
      ex({ role: 'Senior Staff Engineer', company: 'Big' }),
      ex({ company: 'Acme', role: 'Backend Engineer' }) // same hash as #1
    ])

    const result = await ingestLeads(db, 'hn', leads, llm, defaultFilters)

    expect(result.found).toBe(4)
    expect(result.added).toBe(1) // only the first pass (4th is a dup)
    expect(result.review).toBe(1) // the maybe
    expect(result.rejected).toBe(1) // the senior role
    expect(result.errors).toEqual([])

    expect(listLeads(db, { verdict: 'pass' })).toHaveLength(1)
    expect(listLeads(db, { verdict: 'maybe' })).toHaveLength(1)
    // dedupe: 2 inserted rows total (pass + maybe), not 3
    expect(listLeads(db)).toHaveLength(2)
  })

  it('records errors when the LLM throws, without aborting the run', async () => {
    const db = initDb(':memory:')
    const llm: LlmProvider = {
      name: 'boom',
      available: async () => true,
      extractAndFilter: async () => {
        throw new Error('ollama down')
      }
    }
    const result = await ingestLeads(db, 'hn', [raw('a'), raw('b')], llm, defaultFilters)
    expect(result.errors).toHaveLength(2)
    expect(result.added).toBe(0)
  })

  it('skips muted channels entirely', async () => {
    const db = initDb(':memory:')
    const llm = fakeLlm([ex()])
    const result = await ingestLeads(db, 'hn', [raw('x')], llm, {
      ...defaultFilters,
      mutedChannels: ['hn']
    })
    expect(result.found).toBe(1)
    expect(result.added).toBe(0)
    expect(listLeads(db)).toHaveLength(0)
  })
})
