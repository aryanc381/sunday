import React, { useEffect, useState } from 'react'
import type { Lead, LeadStatus, Verdict } from '../shared/types'
import type { BotConfig, RuntimeEvent, RuntimeSnapshot } from '../shared/runtime'
import type { LeadGenApi } from '../shared/ipc'

const api: LeadGenApi = window.leadgen

const STATUSES: LeadStatus[] = ['new', 'applied', 'skipped', 'pending', 'interview', 'offer', 'rejected']
const TABS: { key: Verdict; label: string }[] = [
  { key: 'pass', label: 'New' },
  { key: 'maybe', label: 'Review' }
]

function cleanList(values: string[]): string {
  return values.length ? values.join(', ') : 'None'
}

export function App(): React.JSX.Element {
  const [tab, setTab] = useState<Verdict>('pass')
  const [leads, setLeads] = useState<Lead[]>([])
  const [running, setRunning] = useState(false)
  const [note, setNote] = useState<string>('')
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null)
  const [events, setEvents] = useState<RuntimeEvent[]>([])
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null)

  async function load(v: Verdict = tab): Promise<void> {
    const [leadRows, runtime, recentEvents, config] = await Promise.all([
      api.listLeads({ verdict: v }),
      api.getRuntimeSnapshot(),
      api.listRuntimeEvents(8),
      api.getBotConfig()
    ])
    setLeads(leadRows)
    setSnapshot(runtime)
    setEvents(recentEvents)
    setBotConfig(config)
  }

  useEffect(() => {
    load(tab)
    const timer = window.setInterval(() => {
      void load(tab)
    }, 4000)
    return () => window.clearInterval(timer)
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
      <section className="hero">
        <div>
          <p className="eyebrow">OpenClaw shell</p>
          <h1>{botConfig?.appName ?? 'OpenClaw'}</h1>
          <p className="subtle">
            Bot tag: <code>{botConfig?.botTag ?? '...'}</code> · Timezone: <code>{botConfig?.timezone ?? '...'}</code>
          </p>
        </div>
        <button onClick={runHn} disabled={running}>
          {running ? 'Running…' : 'Run HN'}
        </button>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Runtime</h2>
          <div className="row">
            <span>Status</span>
            <strong>{snapshot?.appMode ?? 'booting'}</strong>
          </div>
          <div className="row">
            <span>Events</span>
            <strong>{snapshot?.eventCount ?? 0}</strong>
          </div>
          <div className="row">
            <span>WhatsApp session</span>
            <strong>{botConfig?.whatsappSessionDir ?? '...'}</strong>
          </div>
          <div className="row">
            <span>Calendar</span>
            <strong>{botConfig?.googleCalendarId ?? 'primary'}</strong>
          </div>
        </article>

        <article className="card">
          <h2>Config</h2>
          <div className="row">
            <span>Allowed groups</span>
            <strong>{botConfig ? cleanList(botConfig.allowedGroups) : '...'}</strong>
          </div>
          <div className="row">
            <span>Google creds</span>
            <strong>{botConfig?.googleCredentialsPath ?? '...'}</strong>
          </div>
          <div className="row">
            <span>Token path</span>
            <strong>{botConfig?.googleTokenPath ?? '...'}</strong>
          </div>
          <div className="row">
            <span>Last event</span>
            <strong>{snapshot?.lastEvent?.message ?? 'None yet'}</strong>
          </div>
        </article>
      </section>

      <section className="card log-card">
        <h2>Recent Events</h2>
        <div className="log">
          {events.length === 0 ? (
            <p className="empty-text">No runtime events yet.</p>
          ) : (
            events.map((event) => (
              <div key={event.id} className="log-row">
                <span>{event.kind}</span>
                <strong>{event.message}</strong>
                <em>{event.createdAt}</em>
              </div>
            ))
          )}
        </div>
      </section>

      <p className="note">{note}</p>

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
                <select value={l.status} onChange={(e) => setStatus(l.id, e.target.value as LeadStatus)}>
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
                No leads yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
