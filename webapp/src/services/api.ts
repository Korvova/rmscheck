import axios from 'axios'
import type { Matcher, RequestType } from '../types'

export async function runNow(params: {
  requestType: RequestType
  method?: string
  urlOrHost: string
  port?: number
  headers?: Record<string,string>
  body?: unknown
  payload?: string
  matchers?: Matcher[]
}): Promise<{ ok: boolean; color?: string; message: string }> {
  const res = await axios.post('/api/run-now', params)
  return res.data
}
