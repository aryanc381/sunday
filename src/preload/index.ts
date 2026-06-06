import { contextBridge, ipcRenderer } from 'electron'
import type { LeadGenApi } from '../shared/ipc'

const api: LeadGenApi = {
  listLeads: (opts) => ipcRenderer.invoke('leads:list', opts),
  runHn: () => ipcRenderer.invoke('channels:runHn'),
  updateStatus: (id, status) => ipcRenderer.invoke('leads:updateStatus', id, status),
  getFilters: () => ipcRenderer.invoke('filters:get')
}

contextBridge.exposeInMainWorld('leadgen', api)
