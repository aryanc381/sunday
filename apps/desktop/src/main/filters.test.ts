import { describe, it, expect } from 'vitest'
import type { ExtractedLead } from '../shared/types'
import { defaultFilters, refineVerdict } from './filters'

const lead = (over: Partial<ExtractedLead> = {}): ExtractedLead => ({
  role: 'Software Engineer',
  company: 'Acme',
  location: 'Bangalore',
  workMode: 'remote',
  experienceMin: 1,
  experienceMax: 2,
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: null,
  techStack: ['Node', 'TypeScript'],
  jobType: 'fulltime',
  companyStage: 'seed',
  contact: null,
  applyLink: null,
  postedDate: '2026-06-05',
  verdict: 'pass',
  fitScore: 80,
  verdictReason: 'looks good',
  ...over,
})

const NOW = new Date('2026-06-06T00:00:00Z')

describe('defaultFilters', () => {
  it('has the expected shape', () => {
    expect(defaultFilters.roles).toContain('SDE')
    expect(defaultFilters.workModes).toEqual(['remote', 'hybrid'])
    expect(defaultFilters.experienceMax).toBe(2)
    expect(defaultFilters.salaryMin).toBeNull()
    expect(defaultFilters.postedWithinDays).toBe(21)
    expect(defaultFilters.unknownHandling).toBe('pass')
    expect(defaultFilters.excludeKeywords).toContain('senior')
  })
})

describe('refineVerdict — hard filters', () => {
  it('rejects when an excludeKeyword appears in rawText', () => {
    const r = refineVerdict(lead({ role: 'Backend Engineer' }), defaultFilters, 'Senior Backend Engineer wanted', NOW)
    expect(r.verdict).toBe('reject')
    expect(r.verdictReason.toLowerCase()).toContain('senior')
  })

  it('rejects when an excludeKeyword appears in the role', () => {
    const r = refineVerdict(lead({ role: 'Staff Software Engineer' }), defaultFilters, 'great team', NOW)
    expect(r.verdict).toBe('reject')
    expect(r.verdictReason.toLowerCase()).toContain('staff')
  })

  it('rejects when experienceMin clearly exceeds filters.experienceMax', () => {
    const r = refineVerdict(lead({ experienceMin: 5 }), defaultFilters, 'apply now', NOW)
    expect(r.verdict).toBe('reject')
    expect(r.verdictReason).toContain('5+')
  })

  it('rejects a stale posting older than postedWithinDays', () => {
    const stale = new Date(NOW.getTime() - 60 * 86_400_000).toISOString()
    const r = refineVerdict(lead({ postedDate: stale }), defaultFilters, 'apply now', NOW)
    expect(r.verdict).toBe('reject')
    expect(r.verdictReason).toContain('stale')
  })

  it('does not reject when postedDate is unknown/invalid', () => {
    const r = refineVerdict(lead({ postedDate: null }), defaultFilters, 'apply now', NOW)
    expect(r.verdict).not.toBe('reject')
    const r2 = refineVerdict(lead({ postedDate: 'not-a-date' }), defaultFilters, 'apply now', NOW)
    expect(r2.verdict).not.toBe('reject')
  })

  it('rejects when an excluded tech is in the stack', () => {
    const filters = { ...defaultFilters, techExclude: ['PHP'] }
    const r = refineVerdict(lead({ techStack: ['PHP', 'Laravel'] }), filters, 'apply now', NOW)
    expect(r.verdict).toBe('reject')
    expect(r.verdictReason).toContain('PHP')
  })
})

describe('refineVerdict — soft / never-drop invariants', () => {
  it('never rejects for missing salary (salary is soft)', () => {
    const filters = { ...defaultFilters, salaryMin: 2_000_000 }
    const r = refineVerdict(lead({ salaryMin: null }), filters, 'apply now', NOW)
    expect(r.verdict).toBe('pass')
  })

  it('never rejects for below-target salary (salary is soft)', () => {
    const filters = { ...defaultFilters, salaryMin: 2_000_000 }
    const r = refineVerdict(lead({ salaryMin: 500_000 }), filters, 'apply now', NOW)
    expect(r.verdict).toBe('pass')
  })

  it('downgrades pass -> maybe when role is unknown (unknownHandling pass)', () => {
    const r = refineVerdict(lead({ role: null }), { ...defaultFilters, unknownHandling: 'pass' }, 'apply now', NOW)
    expect(r.verdict).toBe('maybe')
    expect(r.verdictReason).toContain('needs review')
  })

  it('still only downgrades to maybe (never reject) when unknownHandling is reject', () => {
    const r = refineVerdict(lead({ role: null }), { ...defaultFilters, unknownHandling: 'reject' }, 'apply now', NOW)
    expect(r.verdict).toBe('maybe')
  })

  it('clamps fitScore to 0-100', () => {
    const r = refineVerdict(lead({ fitScore: 150 }), defaultFilters, 'apply now', NOW)
    expect(r.fitScore).toBe(100)
  })
})
