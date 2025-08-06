const express = require('express')
const cors = require('cors')
const axios = require('axios').default
const net = require('node:net')
const dgram = require('node:dgram')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const app = express()

app.use(cors())
app.use(express.json({ limit: '1mb' }))

// ---------- Helpers ----------
const safeParse = (s, fb = undefined) => { try { return s ? JSON.parse(s) : fb } catch { return fb } }

function msFromEveryUnit(every = 1, unit = 'minutes') {
  const n = Number(every) || 1
  if (unit === 'seconds') return n * 1000
  if (unit === 'hours')   return n * 60 * 60 * 1000
  return n * 60 * 1000
}

function pickColorByMatchers(matchers, text) {
  if (!Array.isArray(matchers) || matchers.length === 0) return { matched:false }
  const low = String(text || '').toLowerCase()
  for (const m of matchers) {
    const pat = String(m?.pattern || '').toLowerCase()
    if (pat && low.includes(pat)) return { matched:true, color:m?.color }
  }
  return { matched:false }
}

async function runProbe({ requestType, method, urlOrHost, port, headers, body, payload, matchers }) {
  const started = process.hrtime.bigint()

  if (requestType === 'HTTP') {
    const m = (method || 'GET').toUpperCase()
    const cfg = { method: m, url: urlOrHost, validateStatus: () => true }
    if (headers && typeof headers === 'object') cfg.headers = headers
    if (['POST','PUT','PATCH','DELETE'].includes(m)) cfg.data = body ?? null

    const r = await axios(cfg)
    const ms = Number(process.hrtime.bigint() - started) / 1e6
    const text = typeof r.data === 'string' ? r.data : JSON.stringify(r.data)
    const sample = text.slice(0, 512)
    const { matched, color } = pickColorByMatchers(matchers, `${r.status} ${r.statusText} ${sample}`)
    const ok = matched || (r.status >= 200 && r.status < 400)
    return { ok, color: color ?? (ok ? '#22c55e' : '#ef4444'), message: `${r.status} ${r.statusText} in ${ms.toFixed(0)}ms; body: ${sample}` }
  }

  if (requestType === 'TCP') {
    const timeoutMs = 4000
    const socket = new net.Socket()
    const p = port || 80
    const host = urlOrHost
    await new Promise((resolve, reject) => {
      let done = false
      const onError = (e) => { if (!done) { done = true; reject(e) } }
      socket.setTimeout(timeoutMs, () => onError(new Error('timeout')))
      socket.once('error', onError)
      socket.connect(p, host, () => { if (!done) { done = true; resolve() } })
    }).finally(() => socket.destroy())
    const ms = Number(process.hrtime.bigint() - started) / 1e6
    const { matched, color } = pickColorByMatchers(matchers, 'tcp-ok')
    const ok = matched || true
    return { ok, color: color ?? '#22c55e', message: `TCP ${urlOrHost}:${port||80} connected in ${ms.toFixed(0)}ms` }
  }

  if (requestType === 'UDP') {
    const timeoutMs = 3000
    const client = dgram.createSocket('udp4')
    const buf = Buffer.from(typeof payload === 'string' ? payload : '')
    const p = port || 53
    const host = urlOrHost
    const got = await new Promise((resolve) => {
      let received = false
      setTimeout(() => { client.close(); resolve(received) }, timeoutMs)
      client.on('message', () => { received = true })
      client.send(buf, p, host, () => {})
    })
    const ms = Number(process.hrtime.bigint() - started) / 1e6
    const { matched, color } = pickColorByMatchers(matchers, got ? 'udp-reply' : 'udp-no-reply')
    const ok = matched || got
    return { ok, color: color ?? (ok ? '#22c55e' : '#ef4444'), message: `UDP ${host}:${p} ${got ? 'reply' : 'no reply'} in ${ms.toFixed(0)}ms` }
  }

  throw new Error('Unsupported requestType')
}

// ---------- Mappers DB <-> API ----------
function toApiTemplate(rec) {
  return {
    id: rec.id,
    name: rec.name,
    description: rec.description || undefined,
    requestType: rec.requestType,
    method: rec.method || undefined,
    urlOrHost: rec.urlOrHost,
    port: rec.port || undefined,
    headers: safeParse(rec.headersJson),
    body: rec.bodyJson || undefined,   // строка JSON
    payload: rec.payload || undefined,
    every: rec.every,
    unit: rec.unit,
    matchers: safeParse(rec.matchersJson, [])
  }
}

function fromApiTemplate(t) {
  return {
    name: t.name,
    description: t.description ?? null,
    requestType: t.requestType,                      // "HTTP" | "TCP" | "UDP"
    method: t.requestType === 'HTTP' ? (t.method || 'GET') : null,
    urlOrHost: t.urlOrHost,
    port: t.port ?? null,
    headersJson: t.headers ? JSON.stringify(t.headers) : null,
    bodyJson: t.body ? t.body : null,                // строка JSON
    payload: t.payload ?? null,
    every: t.every ?? 1,
    unit: t.unit ?? 'minutes',                       // "seconds" | "minutes" | "hours"
    matchersJson: JSON.stringify(t.matchers ?? [])
  }
}

function toApiDevice(rec) {
  return {
    id: rec.id,
    name: rec.name,
    description: rec.description || undefined,
    imageUrl: rec.imageUrl || undefined,
    enabled: rec.enabled,
    template: {
      id: rec.templateId || 'snapshot',
      requestType: rec.requestType,
      method: rec.method || undefined,
      urlOrHost: rec.urlOrHost,
      port: rec.port || undefined,
      headers: safeParse(rec.headersJson),
      body: rec.bodyJson || undefined,               // строка JSON
      payload: rec.payload || undefined,
      every: rec.every,
      unit: rec.unit,
      matchers: safeParse(rec.matchersJson, [])
    },
    lastMessage: rec.lastMessage || undefined,
    lastColor: rec.lastColor || undefined,
    lastCheckedAt: rec.lastCheckedAt ? rec.lastCheckedAt.toISOString() : undefined,
    createdAt: rec.createdAt.toISOString()
  }
}

function fromApiDevice(dev) {
  const t = dev.template || {}
  return {
    id: dev.id,
    name: dev.name,
    description: dev.description ?? null,
    imageUrl: dev.imageUrl ?? null,
    enabled: !!dev.enabled,
    requestType: t.requestType,
    method: t.requestType === 'HTTP' ? (t.method || 'GET') : null,
    urlOrHost: t.urlOrHost,
    port: t.port ?? null,
    headersJson: t.headers ? JSON.stringify(t.headers) : null,
    bodyJson: t.body ? t.body : null,                // строка JSON
    payload: t.payload ?? null,
    every: t.every ?? 1,
    unit: t.unit ?? 'minutes',
    matchersJson: JSON.stringify(t.matchers ?? []),
    templateId: dev.templateId ?? null,
    lastMessage: dev.lastMessage ?? null,
    lastColor: dev.lastColor ?? null,
    lastCheckedAt: dev.lastCheckedAt ? new Date(dev.lastCheckedAt) : null
  }
}

// ---------- Routes ----------
app.get('/api/health', (_req, res) => res.json({ ok: true }))

// Templates
app.get('/api/templates', async (_req, res) => {
  try {
    const rows = await prisma.template.findMany({ orderBy: { createdAt: 'desc' } })
    res.json(rows.map(toApiTemplate))
  } catch (e) {
    console.error('GET /api/templates error:', e)
    res.status(500).json({ ok:false, message: e?.message || String(e) })
  }
})

app.post('/api/templates', async (req, res) => {
  try {
    const data = fromApiTemplate(req.body)
    const created = await prisma.template.create({ data })
    res.json({ ok: true, id: created.id })
  } catch (e) {
    console.error('POST /api/templates error:', e)
    res.status(400).json({ ok:false, message: e?.message || String(e) })
  }
})

// Devices
app.get('/api/devices', async (_req, res) => {
  const rows = await prisma.device.findMany({ orderBy: { createdAt: 'desc' } })
  res.json(rows.map(toApiDevice))
})

app.post('/api/devices', async (req, res) => {
  const d = fromApiDevice(req.body)
  try {
    let saved
    if (d.id) {
      saved = await prisma.device.upsert({
        where: { id: d.id },
        update: d,
        create: d
      })
    } else {
      saved = await prisma.device.create({ data: d })
    }
    res.json({ ok: true, id: saved.id })
  } catch (e) {
    console.error('POST /api/devices error:', e)
    res.status(400).json({ ok:false, message: e?.message || String(e) })
  }
})

app.delete('/api/devices/:id', async (req, res) => {
  try {
    await prisma.log.deleteMany({ where: { deviceId: req.params.id } })
    await prisma.device.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/devices/:id error:', e)
    res.status(400).json({ ok:false, message: e?.message || String(e) })
  }
})

app.get('/api/devices/:id/logs', async (req, res) => {
  const limit = Number(req.query.limit || 200)
  const rows = await prisma.log.findMany({
    where: { deviceId: req.params.id },
    orderBy: { timestamp: 'desc' },
    take: limit
  })
  res.json(rows.reverse())
})

// run-now (тест из модалки)
app.post('/api/run-now', async (req, res) => {
  const { requestType, method, urlOrHost, port, headers, body, payload, matchers } = req.body || {}
  if (!requestType || !urlOrHost) return res.status(400).json({ ok:false, message:'requestType/urlOrHost required' })
  try {
    const out = await runProbe({ requestType, method, urlOrHost, port, headers, body, payload, matchers })
    return res.json(out)
  } catch (e) {
    const msg = e?.response ? `${e.response.status} ${e.response.statusText}` : (e?.message || String(e))
    return res.status(200).json({ ok:false, color:'#ef4444', message: msg })
  }
})

// ---------- Планировщик ----------
setInterval(async () => {
  const devices = await prisma.device.findMany({ where: { enabled: true } })
  const now = Date.now()
  for (const d of devices) {
    const interval = msFromEveryUnit(d.every, d.unit)
    const last = d.lastCheckedAt ? d.lastCheckedAt.getTime() : 0
    if (now - last < interval) continue

    try {
      const out = await runProbe({
        requestType: d.requestType,
        method: d.method || undefined,
        urlOrHost: d.urlOrHost,
        port: d.port || undefined,
        headers: safeParse(d.headersJson),
        body: safeParse(d.bodyJson),
        payload: d.payload || undefined,
        matchers: safeParse(d.matchersJson, [])
      })
      const ts = new Date()
      await prisma.$transaction([
        prisma.device.update({ where: { id: d.id }, data: { lastCheckedAt: ts, lastMessage: out.message, lastColor: out.color } }),
        prisma.log.create({ data: { deviceId: d.id, timestamp: ts, ok: out.ok, message: out.message, color: out.color } })
      ])
    } catch (e) {
      const ts = new Date()
      const msg = e?.message || String(e)
      await prisma.$transaction([
        prisma.device.update({ where: { id: d.id }, data: { lastCheckedAt: ts, lastMessage: msg, lastColor: '#ef4444' } }),
        prisma.log.create({ data: { deviceId: d.id, timestamp: ts, ok: false, message: msg, color: '#ef4444' } })
      ])
    }
  }
}, 1000)

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`))
