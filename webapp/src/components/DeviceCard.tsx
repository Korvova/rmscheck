import type { Device } from '../types'

export interface DeviceCardProps {
  device: Device
  onStart: (id: string) => void
  onStop: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onHistory: (id: string) => void
}

function colorDotStyle(color?: string) {
  return { background: color ?? '#9ca3af' }
}

export default function DeviceCard({ device, onStart, onStop, onEdit, onDelete, onHistory }: DeviceCardProps) {
  const statusColor = device.enabled ? (device.lastColor ?? '#60a5fa') : '#9ca3af' // blue по умолчанию, gray если стоп

  return (
    <div className={['card', !device.enabled ? 'muted' : ''].join(' ')}>
      <div className="card-header">
        <div className="card-title">{device.name}</div>
        <div className="badge">
          <span className="dot" style={colorDotStyle(statusColor)} />
          <span>{device.enabled ? 'Активна' : 'Остановлена'}</span>
        </div>
      </div>
      <div className="card-body">
        {device.description && <div style={{ color:'#6b7280' }}>{device.description}</div>}
        <div>
          <div style={{ fontSize:12, color:'#6b7280' }}>Запрос</div>
          <div style={{ fontFamily:'ui-monospace, SFMono-Regular', fontSize:13 }}>
            {device.template.requestType === 'HTTP' ? `${device.template.method ?? 'GET'} ${device.template.urlOrHost}` :
             device.template.requestType === 'TCP' ? `TCP ${device.template.urlOrHost}:${device.template.port ?? 80}` :
             `UDP ${device.template.urlOrHost}:${device.template.port ?? 161}`}
          </div>
        </div>
        {device.lastMessage && <div style={{ fontSize:13 }}>Последний ответ: {device.lastMessage}</div>}
      </div>
      <div className="card-footer">
        {device.enabled ? (
          <button className="btn gray" onClick={() => onStop(device.id)}>Остановить</button>
        ) : (
          <button className="btn primary" onClick={() => onStart(device.id)}>Запустить</button>
        )}
        <button className="btn" onClick={() => onEdit(device.id)}>Изменить</button>
        <button className="btn" onClick={() => onHistory(device.id)}>История</button>
        <button className="btn danger" onClick={() => onDelete(device.id)}>Удалить</button>
      </div>
    </div>
  )
}