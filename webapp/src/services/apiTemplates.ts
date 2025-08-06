import axios from 'axios'
import type { Template } from '../types'

export async function listTemplates(): Promise<Template[]> {
  const res = await axios.get('/api/templates')
  return res.data
}

export async function createTemplate(t: Omit<Template, 'id'>): Promise<string> {
  const res = await axios.post('/api/templates', t)
  return res.data.id as string
}