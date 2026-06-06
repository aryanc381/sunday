import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import type { LeadStatus, LlmMode, Verdict } from '../shared/types'
import { initDb, listLeads, updateStatus, type DB } from './db'
import { ingestLeads } from './ingest'
import { fetchHnLeads } from './channels/hn'
import { getLlm } from './llm'
import { defaultFilters } from './filters'

const llmMode: LlmMode = process.env.LEADGEN_LLM_MODE === 'hybrid' ? 'hybrid' : 'local_only'

let db: DB

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    title: 'Lead-Gen',
    webPreferences: {
      preload: join(app.getAppPath(), 'out', 'preload', 'index.mjs'),
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(app.getAppPath(), 'out', 'renderer', 'index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('filters:get', () => defaultFilters)

  ipcMain.handle('leads:list', (_e, opts?: { verdict?: Verdict; status?: LeadStatus }) =>
    listLeads(db, opts ?? {})
  )

  ipcMain.handle('leads:updateStatus', (_e, id: string, status: LeadStatus) =>
    updateStatus(db, id, status)
  )

  ipcMain.handle('channels:runHn', async () => {
    const llm = getLlm(llmMode, { anthropicApiKey: process.env.ANTHROPIC_API_KEY })
    const raw = await fetchHnLeads({ limit: 40 })
    return ingestLeads(db, 'hn', raw, llm, defaultFilters)
  })
}

app.whenReady().then(() => {
  db = initDb(join(app.getPath('userData'), 'leadgen.db'))
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
