import React, { useEffect, useState } from 'react'
import type { Lead, LeadStatus, Verdict } from '../shared/types'
import type { LeadGenApi } from '../shared/ipc'

const api: LeadGenApi = window.leadgen

const STATUSES: LeadStatus[] = [
  'new',
  'applied',
  'skipped',
  'pending',
  'interview',
  'offer',
  'rejected'
]

const TABS: { key: Verdict; label: string }[] = [
  { key: 'pass', label: 'New' },
  { key: 'maybe', label: 'Review' }
]

export function App(): React.JSX.Element {
  const [tab, setTab] = useState<Verdict>('pass')
  const [leads, setLeads] = useState<Lead[]>([])
  const [running, setRunning] = useState(false)
  const [note, setNote] = useState<string>('')

  async function load(v: Verdict = tab): Promise<void> {
    setLeads(await api.listLeads({ verdict: v }))
  }

  useEffect(() => {
    load(tab)
  }, [tab])

  async function runHn(): Promise<void> {
    setRunning(true)
    setNote('Fetching HN “Who is hiring?”…')
    try {
      const r = await api.runHn()
      setNote(
        `HN: ${r.found} found · ${r.added} new · ${r.review} review · ${r.rejected} rejected` +
          (r.errors.length ? ` · ${r.errors.length} errors` : '')
      )
      await load()
    } catch (e) {
      setNote(`Run failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setRunning(false)
    }
  }

  async function setStatus(id: string, status: LeadStatus): Promise<void> {
    await api.updateStatus(id, status)
    await load()
  }

  return (
    <div className="app">
      <header>
        <h1>Lead-Gen</h1>
        <button onClick={runHn} disabled={running}>
          {running ? 'Running…' : 'Run HN'}
        </button>
        <span className="note">{note}</span>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={t.key === tab ? 'tab active' : 'tab'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <table>
        <thead>
          <tr>
            <th>Fit</th>
            <th>Role</th>
            <th>Company</th>
            <th>Location</th>
            <th>Mode</th>
            <th>Source</th>
            <th>Status</th>
            <th>Link</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} title={l.verdictReason}>
              <td className="fit">{l.fitScore}</td>
              <td>{l.role ?? '—'}</td>
              <td>{l.company ?? '—'}</td>
              <td>{l.location ?? '—'}</td>
              <td>{l.workMode}</td>
              <td>{l.sourceChannel}</td>
              <td>
                <select
                  value={l.status}
                  onChange={(e) => setStatus(l.id, e.target.value as LeadStatus)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                {l.applyLink ? (
                  <a href={l.applyLink} target="_blank" rel="noreferrer">
                    open
                  </a>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
          {leads.length === 0 && (
            <tr>
              <td colSpan={8} className="empty">
                No leads yet — hit “Run HN”.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
