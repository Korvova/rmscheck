export type RequestType = 'HTTP' | 'TCP' | 'UDP'
export type TimeUnit = 'seconds' | 'minutes' | 'hours'

export interface Matcher { id: string; pattern: string; color: string; label?: string }

export interface CheckTemplate {
  id: string
  requestType: RequestType
  method?: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'|'HEAD'|'OPTIONS'
  urlOrHost: string
  port?: number
  headers?: Record<string, string>
  body?: string
  payload?: string
  every: number
  unit: TimeUnit
  matchers: Matcher[]
}

export interface Template { // library item
  id: string
  name: string
  description?: string
  requestType: RequestType
  method?: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'|'HEAD'|'OPTIONS'
  urlOrHost: string
  port?: number
  headers?: Record<string,string>
  body?: string
  payload?: string
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
  lastColor?: string
  lastCheckedAt?: string
  createdAt: string
}

export interface ResultLog { id: string; deviceId: string; timestamp: string; ok: boolean; message: string; color?: string }