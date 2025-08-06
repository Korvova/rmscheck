import axios from 'axios'
import type { Device, ResultLog } from '../types'

export async function listDevices(): Promise<Device[]> {
  const res = await axios.get('/api/devices')
  return res.data
}

export async function createOrUpdateDevice(d: Device): Promise<void> {
  await axios.post('/api/devices', d)
}

export async function deleteDevice(id: string): Promise<void> {
  await axios.delete(`/api/devices/${id}`)
}

export async function listLogs(deviceId: string): Promise<ResultLog[]> {
  const res = await axios.get(`/api/devices/${deviceId}/logs`, { params: { limit: 200 } })
  return res.data
}
