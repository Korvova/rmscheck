// Временный mock «backend» на localStorage, чтобы UI работал без API.
import type { Device, ResultLog } from '../types'

const DEVICES_KEY = 'rmscheck.devices.v1'
const LOGS_KEY = 'rmscheck.logs.v1'

function load<T>(key: string, fallback: T): T {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) as T : fallback } catch { return fallback }
}
function save<T>(key: string, value: T) { localStorage.setItem(key, JSON.stringify(value)) }

export async function listDevices(): Promise<Device[]> {
  return load<Device[]>(DEVICES_KEY, [])
}
export async function createOrUpdateDevice(d: Device): Promise<void> {
  const all = load<Device[]>(DEVICES_KEY, [])
  const idx = all.findIndex(x => x.id === d.id)
  if (idx >= 0) all[idx] = d; else all.push(d)
  save(DEVICES_KEY, all)
}
export async function deleteDevice(id: string): Promise<void> {
  const all = load<Device[]>(DEVICES_KEY, [])
  save(DEVICES_KEY, all.filter(x => x.id !== id))
  const logs = load<ResultLog[]>(LOGS_KEY, [])
  save(LOGS_KEY, logs.filter(l => l.deviceId !== id))
}
export async function listLogs(deviceId: string): Promise<ResultLog[]> {
  const logs = load<ResultLog[]>(LOGS_KEY, [])
  return logs.filter(l => l.deviceId === deviceId).sort((a,b)=>a.timestamp.localeCompare(b.timestamp))
}
export async function addLog(entry: ResultLog): Promise<void> {
  const logs = load<ResultLog[]>(LOGS_KEY, [])
  logs.push(entry)
  save(LOGS_KEY, logs)
}