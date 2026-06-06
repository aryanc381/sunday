import type { RawLead } from '../../shared/types'

const SEARCH_URL =
  'https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=who%20is%20hiring&hitsPerPage=5'
const ITEMS_URL = 'https://hn.algolia.com/api/v1/items/'

/** Convert HN comment HTML into readable plain text. */
export function stripHtml(html: string): string {
  let text = html
  // <p> (with optional attrs) -> paragraph break
  text = text.replace(/<p[^>]*>/gi, '\n\n')
  // drop every other tag
  text = text.replace(/<[^>]+>/g, '')
  // decode common entities
  const entities: Record<string, string> = {
    '&#x2f;': '/',
    '&#x2F;': '/',
    '&#47;': '/',
    '&#x27;': "'",
    '&#39;': "'",
    '&quot;': '"',
    '&#34;': '"',
    '&amp;': '&',
    '&#38;': '&',
    '&gt;': '>',
    '&#62;': '>',
    '&#x3e;': '>',
    '&#x3E;': '>',
    '&lt;': '<',
    '&#60;': '<',
    '&#x3c;': '<',
    '&#x3C;': '<',
    '&nbsp;': ' '
  }
  for (const [entity, char] of Object.entries(entities)) {
    text = text.split(entity).join(char)
  }
  // collapse excess whitespace: trim trailing spaces per line, cap blank lines, trim ends
  text = text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
  return text
}

/** First http(s) URL in the text, or null. */
export function firstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"')\]]+/i)
  return match ? match[0] : null
}

interface HnChild {
  id: number
  text?: string | null
  created_at?: string | null
}

interface HnHit {
  objectID: string
  title?: string | null
  created_at?: string | null
}

export async function fetchHnLeads(opts?: {
  fetchImpl?: typeof fetch
  limit?: number
}): Promise<RawLead[]> {
  const doFetch = opts?.fetchImpl ?? fetch

  let objectID: string | null = null
  try {
    const searchRes = await doFetch(SEARCH_URL)
    if (!searchRes.ok) {
      throw new Error(`HN search failed: ${searchRes.status}`)
    }
    const search = (await searchRes.json()) as { hits?: HnHit[] }
    const hits = search.hits ?? []
    // hits come newest-first (search_by_date); pick first matching title
    const thread = hits.find((h) => /who is hiring/i.test(h.title ?? ''))
    if (!thread) {
      return []
    }
    objectID = thread.objectID
  } catch (err) {
    throw new Error(
      `Failed to fetch HN hiring thread: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  try {
    const itemsRes = await doFetch(`${ITEMS_URL}${objectID}`)
    if (!itemsRes.ok) {
      throw new Error(`HN items failed: ${itemsRes.status}`)
    }
    const story = (await itemsRes.json()) as { children?: HnChild[] }
    const children = story.children ?? []

    const leads: RawLead[] = []
    for (const child of children) {
      if (!child || typeof child.text !== 'string' || child.text.trim() === '') {
        continue
      }
      const rawText = stripHtml(child.text)
      if (rawText === '') continue
      leads.push({
        sourceChannel: 'hn',
        rawText,
        externalId: String(child.id),
        postedDate: child.created_at ?? null,
        applyLink: firstUrl(rawText)
      })
    }

    return typeof opts?.limit === 'number' ? leads.slice(0, opts.limit) : leads
  } catch (err) {
    throw new Error(
      `Failed to fetch HN thread comments: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}
