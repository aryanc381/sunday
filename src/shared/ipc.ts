// IPC contract shared by preload + renderer. The single source of truth for window.leadgen.
import type { FilterConfig, Lead, LeadStatus, RunResult, Verdict } from './types'
import type { BotConfig, RuntimeEvent, RuntimeSnapshot } from './runtime'

export interface LeadGenApi {
  listLeads(opts?: { verdict?: Verdict; status?: LeadStatus }): Promise<Lead[]>
  runHn(): Promise<RunResult>
  updateStatus(id: string, status: LeadStatus): Promise<void>
  getFilters(): Promise<FilterConfig>
  getRuntimeSnapshot(): Promise<RuntimeSnapshot>
  listRuntimeEvents(limit?: number): Promise<RuntimeEvent[]>
  getBotConfig(): Promise<BotConfig>
}

declare global {
  interface Window {
    leadgen: LeadGenApi
  }
}
