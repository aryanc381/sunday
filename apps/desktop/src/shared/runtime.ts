export type AppMode = 'booting' | 'ready' | 'degraded' | 'error'

export interface BotConfig {
  appName: string
  botName: string
  botTag: string
  timezone: string
  whatsappSessionDir: string
  googleCredentialsPath: string
  googleTokenPath: string
  googleCalendarId: string
  allowedGroups: string[]
}

export interface RuntimeEvent {
  id: string
  kind: string
  message: string
  details: string | null
  createdAt: string
}

export interface RuntimeSnapshot {
  appMode: AppMode
  botConfig: BotConfig
  eventCount: number
  lastEvent: RuntimeEvent | null
}
