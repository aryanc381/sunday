// IPC contract shared by preload + renderer. The single source of truth for window.leadgen.
import type { FilterConfig, Lead, LeadStatus, RunResult, Verdict } from './types'

export interface LeadGenApi {
  listLeads(opts?: { verdict?: Verdict; status?: LeadStatus }): Promise<Lead[]>
  runHn(): Promise<RunResult>
  updateStatus(id: string, status: LeadStatus): Promise<void>
  getFilters(): Promise<FilterConfig>
}

declare global {
  interface Window {
    leadgen: LeadGenApi
  }
}
