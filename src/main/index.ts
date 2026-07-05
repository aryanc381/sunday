import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import type { LeadStatus, LlmMode, Verdict } from '../shared/types'
import type { AppMode, BotConfig, RuntimeEvent, RuntimeSnapshot } from '../shared/runtime'
import {
  appendRuntimeEvent,
  getRuntimeSnapshot as readRuntimeSnapshot,
  initDb,
  listLeads,
  listRuntimeEvents,
  setRuntimeState,
  updateStatus,
  type DB
} from './db'
import { ingestLeads } from './ingest'
import { fetchHnLeads } from './channels/hn'
import { getLlm } from './llm'
import { defaultFilters } from './filters'
import { loadBotConfig } from './config'

const llmMode: LlmMode = process.env.LEADGEN_LLM_MODE === 'hybrid' ? 'hybrid' : 'local_only'

let db: DB
let botConfig: BotConfig
let appMode: AppMode = 'booting'
let mainWindow: BrowserWindow | null = null

function setMode(mode: AppMode): void {
  appMode = mode
  if (db) setRuntimeState(db, 'app_mode', mode)
}

function logEvent(kind: string, message: string, details?: string): RuntimeEvent {
  return appendRuntimeEvent(db, { kind, message, details: details ?? null })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1160,
    height: 800,
    title: botConfig.appName,
    webPreferences: {
      preload: join(app.getAppPath(), 'out', 'preload', 'index.mjs'),
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(app.getAppPath(), 'out', 'renderer', 'index.html'))
  }
}

function snapshot(): RuntimeSnapshot {
  const stats = readRuntimeSnapshot(db)
  return {
    appMode,
    botConfig,
    eventCount: stats.eventCount,
    lastEvent: stats.lastEvent
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
    logEvent('channel', `HN ingest started (${raw.length} raw leads)`)
    return ingestLeads(db, 'hn', raw, llm, defaultFilters)
  })

  ipcMain.handle('runtime:snapshot', () => snapshot())
  ipcMain.handle('runtime:events', (_e, limit?: number) => listRuntimeEvents(db, limit ?? 25))
  ipcMain.handle('bot:config', () => botConfig)
}

function bootstrap(): void {
  db = initDb(join(app.getPath('userData'), 'openclaw.db'))
  botConfig = loadBotConfig(app.getPath('userData'), process.env)
  setMode('booting')
  setRuntimeState(db, 'bot_tag', botConfig.botTag)
  setRuntimeState(db, 'app_name', botConfig.appName)
  setRuntimeState(db, 'timezone', botConfig.timezone)
  setRuntimeState(db, 'whatsapp_session_dir', botConfig.whatsappSessionDir)
  setRuntimeState(db, 'google_credentials_path', botConfig.googleCredentialsPath)
  setRuntimeState(db, 'google_token_path', botConfig.googleTokenPath)
  setRuntimeState(db, 'google_calendar_id', botConfig.googleCalendarId)
  setRuntimeState(db, 'allowed_groups', JSON.stringify(botConfig.allowedGroups))
  logEvent('startup', `${botConfig.appName} booted`, `tag=${botConfig.botTag}`)
  setMode('ready')
}

app.whenReady().then(() => {
  bootstrap()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

process.on('uncaughtException', (err) => {
  const message = err instanceof Error ? err.message : String(err)
  if (db) {
    setMode('error')
    logEvent('fatal', message)
  }
})

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason)
  if (db) {
    setMode('error')
    logEvent('fatal', message)
  }
})
