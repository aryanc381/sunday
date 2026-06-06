import { describe, it, expect } from 'vitest'
import { stripHtml, firstUrl, fetchHnLeads } from './hn'

describe('stripHtml', () => {
  it('removes tags', () => {
    expect(stripHtml('<i>hello</i> <b>world</b>')).toBe('hello world')
  })

  it('decodes entities', () => {
    expect(stripHtml('a&#x2F;b')).toBe('a/b')
    expect(stripHtml('Tom &amp; Jerry')).toBe('Tom & Jerry')
    expect(stripHtml('&#x27;quote&#x27;')).toBe("'quote'")
    expect(stripHtml('&quot;hi&quot;')).toBe('"hi"')
    expect(stripHtml('5 &gt; 3 &lt; 4')).toBe('5 > 3 < 4')
    expect(stripHtml('5 &#62; 3')).toBe('5 > 3')
  })

  it('turns <p> into a paragraph break', () => {
    expect(stripHtml('one<p>two')).toBe('one\n\ntwo')
  })

  it('collapses excess whitespace', () => {
    expect(stripHtml('a<p>b<p>c')).toBe('a\n\nb\n\nc')
  })
})

describe('firstUrl', () => {
  it('finds the first url', () => {
    expect(firstUrl('apply at https://acme.com/jobs today')).toBe('https://acme.com/jobs')
  })

  it('returns null when none', () => {
    expect(firstUrl('email us at jobs@acme.com')).toBeNull()
  })
})

const SEARCH_URL =
  'https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=who%20is%20hiring&hitsPerPage=5'

function makeFetch(search: unknown, items: unknown): typeof fetch {
  return (async (url: string | URL | Request) => {
    const u = String(url)
    if (u === SEARCH_URL) {
      return { ok: true, json: async () => search }
    }
    if (u.startsWith('https://hn.algolia.com/api/v1/items/')) {
      return { ok: true, json: async () => items }
    }
    throw new Error(`unexpected url: ${u}`)
  }) as unknown as typeof fetch
}

const searchResponse = {
  hits: [
    { objectID: '12345', title: 'Ask HN: Who is hiring? (June 2026)', created_at: '2026-06-01T15:00:00Z' },
    { objectID: '99999', title: 'Ask HN: Freelancer? Seeking freelancer?', created_at: '2026-06-01T15:00:00Z' }
  ]
}

const itemsResponse = {
  id: 12345,
  children: [
    {
      id: 1,
      created_at: '2026-06-01T16:00:00Z',
      text: 'Acme Corp | Remote<p>Apply at https:&#x2F;&#x2F;acme.com&#x2F;jobs'
    },
    {
      id: 2,
      created_at: '2026-06-01T16:05:00Z',
      text: 'Beta Inc | Onsite<p>Email jobs&#x40;beta.com'
    },
    { id: 3, created_at: '2026-06-01T16:10:00Z', text: null },
    { id: 4, created_at: '2026-06-01T16:15:00Z', text: '' },
    { id: 5, created_at: '2026-06-01T16:20:00Z' }
  ]
}

describe('fetchHnLeads', () => {
  it('maps top-level comments into RawLeads', async () => {
    const leads = await fetchHnLeads({ fetchImpl: makeFetch(searchResponse, itemsResponse) })

    expect(leads).toHaveLength(2)

    const [first, second] = leads
    expect(first.sourceChannel).toBe('hn')
    expect(first.externalId).toBe('1')
    expect(typeof first.externalId).toBe('string')
    expect(first.postedDate).toBe('2026-06-01T16:00:00Z')
    expect(first.rawText).toBe('Acme Corp | Remote\n\nApply at https://acme.com/jobs')
    expect(first.applyLink).toBe('https://acme.com/jobs')

    expect(second.externalId).toBe('2')
    expect(second.applyLink).toBeNull()
    expect(second.rawText).toContain('Beta Inc')
  })

  it('skips deleted/empty/null-text children', async () => {
    const leads = await fetchHnLeads({ fetchImpl: makeFetch(searchResponse, itemsResponse) })
    const ids = leads.map((l) => l.externalId)
    expect(ids).toEqual(['1', '2'])
    expect(ids).not.toContain('3')
    expect(ids).not.toContain('4')
    expect(ids).not.toContain('5')
  })

  it('returns [] when search hits are empty', async () => {
    const leads = await fetchHnLeads({ fetchImpl: makeFetch({ hits: [] }, itemsResponse) })
    expect(leads).toEqual([])
  })

  it('returns [] when no hit title matches', async () => {
    const noMatch = { hits: [{ objectID: '1', title: 'Ask HN: Who wants to be hired?' }] }
    const leads = await fetchHnLeads({ fetchImpl: makeFetch(noMatch, itemsResponse) })
    expect(leads).toEqual([])
  })

  it('respects the limit option', async () => {
    const leads = await fetchHnLeads({
      fetchImpl: makeFetch(searchResponse, itemsResponse),
      limit: 1
    })
    expect(leads).toHaveLength(1)
    expect(leads[0].externalId).toBe('1')
  })

  it('throws a clear error on network failure', async () => {
    const failing = (async () => {
      throw new Error('boom')
    }) as unknown as typeof fetch
    await expect(fetchHnLeads({ fetchImpl: failing })).rejects.toThrow(/HN hiring thread/i)
  })
})
