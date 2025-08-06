import { useEffect, useMemo, useState, useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import DeviceCard from '../components/DeviceCard'
import type { Device, Matcher, RequestType, Template, TimeUnit } from '../types'
import { listDevices, createOrUpdateDevice, deleteDevice, listLogs } from '../services/apiDevices'
import { runNow } from '../services/api'
import { listTemplates, createTemplate } from '../services/apiTemplates'




export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [openForm, setOpenForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [historyFor, setHistoryFor] = useState<string | null>(null)



  useEffect(() => { (async () => setDevices(await listDevices()))() }, [])

useEffect(() => {
  const t = setInterval(async () => {
    setDevices(await listDevices())
  }, 5000)
  return () => clearInterval(t)
}, [])




  const editing = useMemo(() => devices.find(d => d.id === editId) || null, [devices, editId])

  function handleAddNew() {
    setEditId(null)
    setOpenForm(true)
  }
  function handleEdit(id: string) {
    setEditId(id)
    setOpenForm(true)
  }
  async function handleSave(d: Device) {
    await createOrUpdateDevice(d)
    setDevices(await listDevices())
    setOpenForm(false)
    setEditId(null)
  }
  async function handleDelete(id: string) {
    await deleteDevice(id)
    setDevices(await listDevices())
  }
  async function handleStart(id: string) {
    const d = devices.find(x=>x.id===id); if (!d) return
    const updated = { ...d, enabled: true }
    await createOrUpdateDevice(updated)
    setDevices(await listDevices())
  }
  async function handleStop(id: string) {
    const d = devices.find(x=>x.id===id); if (!d) return
    const updated = { ...d, enabled: false, lastMessage: d.lastMessage, lastColor: d.lastColor }
    await createOrUpdateDevice(updated)
    setDevices(await listDevices())
  }

  return (
    <div className="container">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h1 style={{ margin:0 }}>RMSCheck</h1>
        <button className="btn primary" onClick={handleAddNew}>Добавить устройство</button>
      </div>

      <div className="grid cards">
        {devices.map(d => (
          <DeviceCard key={d.id} device={d}
            onStart={handleStart}
            onStop={handleStop}
            onEdit={handleEdit}
            onHistory={(id)=> setHistoryFor(id)}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {openForm && (
        <DeviceFormModal
          initial={editing || null}
          onClose={()=>{ setOpenForm(false); setEditId(null) }}
          onSave={handleSave}
        />
      )}

      {historyFor && (
        <HistoryModal deviceId={historyFor} onClose={()=> setHistoryFor(null)} />
      )}
    </div>
  )
}

// -------- Modal: История (заглушка на mock-логах) --------
function HistoryModal({ deviceId, onClose }: { deviceId: string, onClose: ()=>void }) {
  const [rows, setRows] = useState<{t:string; msg:string; color?:string}[]>([])
  const [busy, setBusy] = useState(false)

  // загрузка + повторная загрузка
  const fetchLogs = useCallback(async () => {
    setBusy(true)
    try {
      const logs = await listLogs(deviceId)
      setRows(
        logs
          .slice(-200)
          .map(l => ({ t: new Date(l.timestamp).toLocaleString(), msg: l.message, color: l.color }))
      )
    } finally {
      setBusy(false)
    }
  }, [deviceId])

  // при открытии и автообновление каждые 3 сек
  useEffect(() => {
    fetchLogs()
    const t = setInterval(fetchLogs, 3000)
    return () => clearInterval(t)
  }, [fetchLogs])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="card-title">История</div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn" onClick={fetchLogs} disabled={busy}>
              {busy ? 'Обновляю…' : 'Обновить'}
            </button>
            <button className="btn" onClick={onClose}>Закрыть</button>
          </div>
        </div>
        <div className="modal-body" style={{ maxHeight: '60vh', overflow:'auto' }}>
          {rows.length === 0 ? (
            <div>Нет записей</div>
          ) : rows.map((r,i)=> (
            <div key={i} style={{ display:'flex', gap:8, alignItems:'center' }}>
              <span className="dot" style={{ background: r.color ?? '#9ca3af' }} />
              <div style={{ fontSize:12, color:'#6b7280', width:180 }}>{r.t}</div>
              <div style={{ fontFamily:'ui-monospace, SFMono-Regular', fontSize:13 }}>{r.msg}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// -------- Modal: Форма устройства --------
function DeviceFormModal({ initial, onClose, onSave }: { initial: Device | null, onClose: ()=>void, onSave: (d: Device)=>void }) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  useEffect(()=>{ (async()=> setTemplates(await listTemplates()))() }, [])

  const [useTemplate, setUseTemplate] = useState(false)
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')

  const [requestType, setRequestType] = useState<RequestType>(initial?.template.requestType ?? 'HTTP')
  const [method, setMethod] = useState(initial?.template.method ?? 'GET')
  const [urlOrHost, setUrlOrHost] = useState(initial?.template.urlOrHost ?? '')
  const [port, setPort] = useState<number | undefined>(initial?.template.port)
  const [payload, setPayload] = useState(initial?.template.payload ?? '')
  const [headersText, setHeadersText] = useState<string>(initial?.template.headers ? JSON.stringify(initial.template.headers, null, 2) : '')
  const [bodyText, setBodyText] = useState<string>(initial?.template.body ?? '')

  const [every, setEvery] = useState<number>(initial?.template.every ?? 1)
  const [unit, setUnit] = useState<TimeUnit>(initial?.template.unit ?? 'minutes')

  const [matchers, setMatchers] = useState<Matcher[]>(initial?.template.matchers ?? [{ id: uuid(), pattern: 'ok', color: '#22c55e', label: 'OK' }])

  const [testBusy, setTestBusy] = useState(false)
  const [testMsg, setTestMsg] = useState<string>('')
  const [testColor, setTestColor] = useState<string | undefined>(undefined)

  useEffect(()=>{ if (initial) setUseTemplate(false) }, [initial])

  function applyTemplate(t: Template) {
    setRequestType(t.requestType)
    setMethod(t.method ?? 'GET')
    setUrlOrHost(t.urlOrHost)
    setPort(t.port)
    setPayload(t.payload ?? '')
    setHeadersText(t.headers ? JSON.stringify(t.headers, null, 2) : '')
    setBodyText(t.body ?? '')
    setEvery(t.every)
    setUnit(t.unit)
    setMatchers((t.matchers || []).map(m => ({ ...m, id: uuid() })))
    if (!name) setName(t.name) // если имя пустое — подсунем из шаблона
  }

  async function handleTemplateSelect(id: string) {
    setSelectedTemplateId(id); setUseTemplate(true)
    const t = templates.find(x => x.id === id); if (t) applyTemplate(t)
  }

  async function handleSaveTemplate() {
    const title = prompt('Название шаблона:', name || 'New Template')
    if (!title) return
    let headers: Record<string,string> | undefined = undefined
    if (headersText.trim()) { try { headers = JSON.parse(headersText) } catch { alert('Неверный JSON в заголовках'); return } }
    if (bodyText.trim()) { try { JSON.parse(bodyText) } catch { alert('Неверный JSON в теле'); return } }

    const payloadT = {
      name: title,
      description,
      requestType,
      method: requestType==='HTTP' ? method as any : undefined,
      urlOrHost,
      port,
      headers,
      body: bodyText || undefined,
      payload,
      every,
      unit,
      matchers
    }
    const id = await createTemplate(payloadT as any)
    setTemplates(await listTemplates())
    setSelectedTemplateId(id)
    setUseTemplate(true)
    alert('Шаблон сохранён')
  }

  async function handleTest() {
    setTestBusy(true)
    try {
      let headers: Record<string,string> | undefined = undefined
      if (headersText.trim()) headers = JSON.parse(headersText)
      let bodyObj: unknown = undefined
      if (bodyText.trim()) bodyObj = JSON.parse(bodyText)
      const resp = await runNow({ requestType, method, urlOrHost, port, headers, body: bodyObj, payload, matchers })
      setTestMsg(resp.message)
      setTestColor(resp.color ?? (resp.ok ? '#22c55e' : '#ef4444'))
    } catch (e: any) {
      setTestMsg(e?.message || 'Ошибка запроса')
      setTestColor('#ef4444')
    } finally { setTestBusy(false) }
  }

  function handleSave() {
    let headers: Record<string,string> | undefined = undefined
    if (headersText.trim()) { try { headers = JSON.parse(headersText) } catch { alert('Неверный JSON в заголовках'); return } }
    if (bodyText.trim()) { try { JSON.parse(bodyText) } catch { alert('Неверный JSON в теле'); return } }

    const id = initial?.id || uuid()
    const device: Device = {
      id,
      name: name || `Device ${id.slice(0,4)}`,
      description,
      enabled: initial?.enabled ?? false,
      template: {
        id: uuid(), requestType, method: requestType==='HTTP' ? method as any : undefined,
        urlOrHost, port, payload, every, unit, matchers, headers, body: bodyText || undefined
      },
      lastMessage: testMsg || initial?.lastMessage,
      lastColor: testColor || initial?.lastColor,
      lastCheckedAt: testMsg ? new Date().toISOString() : initial?.lastCheckedAt,
      createdAt: initial?.createdAt || new Date().toISOString(),
    }
    onSave(device)
  }

  const showBody = requestType==='HTTP' && ['POST','PUT','PATCH'].includes(method)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="card-title">{initial ? 'Изменить устройство' : 'Добавить устройство'}</div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn" onClick={handleSaveTemplate}>Сохранить как шаблон</button>
            <button className="btn" onClick={onClose}>Закрыть</button>
          </div>
        </div>
        <div className="modal-body">
          {/* Выбор шаблона */}
          <div className="row">
            <div>
              <label className="label">Выбрать шаблон</label>
              <select className="select" value={selectedTemplateId} onChange={e=> handleTemplateSelect(e.currentTarget.value)}>
                <option value="">—</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <div className="help">Выберите шаблон чтобы заполнить поля ниже.</div>
            </div>
            <div>
              <label className="label">Название устройства</label>
              <input className="input" value={name} onChange={e=> setName(e.currentTarget.value)} placeholder="Например, API Gateway" />
            </div>
          </div>

          <div>
            <label className="label">Описание</label>
            <textarea className="textarea" rows={2} value={description} onChange={e=>setDescription(e.currentTarget.value)} />
          </div>

          {/* Тип запроса */}
          <div className="row">
            <div>
              <label className="label">Тип запроса</label>
              <select className="select" value={requestType} onChange={e=> setRequestType(e.currentTarget.value as any)}>
                <option value="HTTP">HTTP</option>
                <option value="TCP">TCP</option>
                <option value="UDP">UDP</option>
              </select>
              <div className="help">Для «пинга домена» используй TCP: host=домен, порт=443 или 80.</div>
            </div>
            {requestType === 'HTTP' && (
              <div>
                <label className="label">HTTP-метод</label>
                <select className="select" value={method} onChange={e=> setMethod(e.currentTarget.value)}>
                  {['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Адрес/порт/URL */}
          <div className="row">
            <div>
              <label className="label">{requestType === 'HTTP' ? 'URL' : 'Host / IP'}</label>
              <input className="input" value={urlOrHost} onChange={e=> setUrlOrHost(e.currentTarget.value)} placeholder={requestType==='HTTP' ? 'https://example.com/health' : 'google.com / 10.0.0.5'} />
              {requestType!=='HTTP' && <div className="help">TCP: укажи порт 80 или 443. UDP: укажи порт сервиса (напр., 53 для DNS).</div>}
            </div>
            {(requestType === 'TCP' || requestType === 'UDP') && (
              <div>
                <label className="label">Порт</label>
                <input className="input" type="number" value={port ?? ''} onChange={e=> setPort(Number(e.currentTarget.value)||undefined)} placeholder={requestType==='TCP' ? '80 или 443' : '53 / 161 / ...'} />
              </div>
            )}
          </div>

          {requestType === 'UDP' && (
            <div>
              <label className="label">Payload (опционально, строка)</label>
              <input className="input" value={payload} onChange={e=> setPayload(e.currentTarget.value)} placeholder="например, ping" />
              <div className="help">Многие UDP-сервисы не отвечают на произвольный payload — лучше использовать конкретный протокол (DNS:53, SNMP:161).</div>
            </div>
          )}

          {/* HTTP-заголовки и тело (JSON) */}
          {requestType === 'HTTP' && (
            <div className="row">
              <div>
                <label className="label">Заголовки (JSON)</label>
                <textarea className="textarea" rows={6} value={headersText} onChange={e=> setHeadersText(e.currentTarget.value)} placeholder='{"Accept":"*/*"}' />
              </div>
              {['POST','PUT','PATCH'].includes(method) && (
                <div>
                  <label className="label">Тело запроса (JSON)</label>
                  <textarea className="textarea" rows={6} value={bodyText} onChange={e=> setBodyText(e.currentTarget.value)} placeholder='{"ping":"test"}' />
                  <div className="help">Для POST/PUT/PATCH. Содержимое должно быть валидным JSON.</div>
                </div>
              )}
            </div>
          )}

          {/* Кнопка «Сделать запрос» + результат */}
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button className="btn" onClick={handleTest} disabled={testBusy || !urlOrHost}>
              {testBusy ? 'Выполняю…' : 'Сделать запрос'}
            </button>
            {testMsg && (
              <div className="badge">
                <span className="dot" style={{ background: testColor ?? '#9ca3af' }} />
                <span style={{ fontFamily:'ui-monospace, SFMono-Regular', fontSize:13 }}>{testMsg}</span>
              </div>
            )}
          </div>

          <hr />

          {/* Эталоны */}
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div className="card-title">Эталон успешного ответа</div>
              <button className="btn" onClick={()=> setMatchers(ms => [...ms, { id: uuid(), pattern:'', color:'#60a5fa', label:'Custom' }])}>+ Эталон</button>
            </div>
            <div style={{ marginTop:8, display:'grid', gap:8 }}>
              {matchers.map(m => (
                <div key={m.id} className="matcher">
                  <div>
                    <label className="label">Поля успешного ответа / паттерн</label>
                    <input className="input" value={m.pattern} onChange={e=> setMatchers(ms => ms.map(x => x.id===m.id ? { ...x, pattern: e.currentTarget.value } : x))} placeholder="например: ok" />
                  </div>
                  <div>
                    <label className="label">Цвет</label>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div className="colorbox" style={{ background:m.color }} />
                      <input className="input" value={m.color} onChange={e=> setMatchers(ms => ms.map(x => x.id===m.id ? { ...x, color: e.currentTarget.value } : x))} placeholder="#22c55e" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Описание</label>
                    <input className="input" value={m.label ?? ''} onChange={e=> setMatchers(ms => ms.map(x => x.id===m.id ? { ...x, label: e.currentTarget.value } : x))} placeholder="OK" />
                  </div>
                  <div>
                    <button className="btn danger" onClick={()=> setMatchers(ms => ms.filter(x => x.id !== m.id))}>Удалить</button>
                  </div>
                </div>
              ))}
              {matchers.length === 0 && <div style={{ color:'#6b7280' }}>Эталоны не заданы — по умолчанию будет красный (ошибка)</div>}
            </div>
          </div>

          <hr />

          {/* Периодичность */}
          <div className="row">
            <div>
              <label className="label">Проверка (каждые)</label>
              <input className="input" type="number" min={1} value={every} onChange={e=> setEvery(Math.max(1, Number(e.currentTarget.value)||1))} />
            </div>
            <div>
              <label className="label">Единицы</label>
              <select className="select" value={unit} onChange={e=> setUnit(e.currentTarget.value as any)}>
                <option value="seconds">секунды</option>
                <option value="minutes">минуты</option>
                <option value="hours">часы</option>
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Отмена</button>
          <button className="btn primary" onClick={handleSave}>Сохранить</button>
        </div>
      </div>
    </div>
  )
}

// -------- Утилита: простая симуляция ответа --------
function simulateResponse(args: { requestType: RequestType, method?: string, urlOrHost: string, port?: number, payload?: string, body?: string }) {
  const { requestType, method, urlOrHost, port, body } = args
  // Немного правдоподобия: если содержит "ok" или google — считаем OK
  const lower = (urlOrHost || '').toLowerCase()
  const ok = lower.includes('ok') || lower.includes('google') || lower.includes('health')
  const proto = requestType === 'HTTP' ? (method ?? 'GET') : requestType
  const target = requestType === 'HTTP' ? urlOrHost : `${urlOrHost}:${port ?? (requestType==='TCP'?80:161)}`
  const bodyNote = body && body.trim() ? ' + JSON body' : ''
  return { ok, message: `${proto} ${target}${bodyNote} → ${ok ? '200 OK (simulated)' : 'timeout/error (simulated)'}` }
}