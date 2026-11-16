import { join } from 'node:path'
import type { BotConfig } from '../shared/runtime'

function splitList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function loadBotConfig(userDataDir: string, env: NodeJS.ProcessEnv = process.env): BotConfig {
  const appName = env.BOT_APP_NAME?.trim() || 'Sunday'
  const botName = env.BOT_NAME?.trim() || 'Sunday Bot'
  const botTag = env.BOT_TAG?.trim() || '@sunday'
  const timezone = env.BOT_TIMEZONE?.trim() || 'Asia/Kolkata'
  const baseDir = env.BOT_RUNTIME_DIR?.trim() || join(userDataDir, 'openclaw')

  return {
    appName,
    botName,
    botTag,
    timezone,
    whatsappSessionDir: env.WHATSAPP_SESSION_DIR?.trim() || join(baseDir, 'whatsapp'),
    googleCredentialsPath:
      env.GOOGLE_CREDENTIALS_PATH?.trim() || join(baseDir, 'google', 'credentials.json'),
    googleTokenPath: env.GOOGLE_TOKEN_PATH?.trim() || join(baseDir, 'google', 'token.json'),
    googleCalendarId: env.GOOGLE_CALENDAR_ID?.trim() || 'primary',
    allowedGroups: splitList(env.WHATSAPP_ALLOWED_GROUPS)
  }
}
