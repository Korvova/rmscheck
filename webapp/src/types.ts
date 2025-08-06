export type RequestType = 'HTTP' | 'TCP' | 'UDP'
export type TimeUnit = 'seconds' | 'minutes' | 'hours'

export interface Matcher {
  id: string
  pattern: string // строка или regex-паттерн (пока строка)
  color: string   // hex или css
  label?: string  // подпись ("OK", "Partial", ...)
}

export interface CheckTemplate {
  id: string
  requestType: RequestType
  method?: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'|'HEAD'|'OPTIONS'
  urlOrHost: string
  port?: number
  headers?: Record<string, string>
  body?: string // JSON как строка
  payload?: string // для UDP (строка)
  every: number
  unit: TimeUnit
  matchers: Matcher[]
}

export interface Device {
  id: string
  name: string
  description?: string
  imageUrl?: string
  enabled: boolean
  template: CheckTemplate
  lastMessage?: string
  lastColor?: string // вычисляется по матчерам / статус
  createdAt: string
}

export interface ResultLog {
  id: string
  deviceId: string
  timestamp: string
  ok: boolean
  message: string
  color?: string
}