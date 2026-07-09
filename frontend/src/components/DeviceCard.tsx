import { Link } from 'react-router-dom'
import { Device } from '../api/client'

const STATUS_STYLES: Record<Device['status'], { dot: string; label: string }> = {
  online: { dot: 'bg-up text-up', label: 'Online' },
  degraded: { dot: 'bg-warn text-warn', label: 'Degraded' },
  offline: { dot: 'bg-down text-down', label: 'Offline' },
}

const TYPE_LABEL: Record<Device['device_type'], string> = {
  router: 'Router',
  switch: 'Switch',
  access_point: 'Access Point',
}

function Metric({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div>
      <div className="text-[11px] text-faint uppercase tracking-wide mb-0.5">{label}</div>
      <div className="font-mono text-sm text-ink">
        {value === null ? '—' : `${value.toFixed(0)}${unit}`}
      </div>
    </div>
  )
}

export default function DeviceCard({ device }: { device: Device }) {
  const status = STATUS_STYLES[device.status]

  return (
    <Link
      to={`/devices/${device.id}`}
      className="block bg-panel border border-line rounded-lg p-4 hover:bg-panelhover
        hover:border-faint transition-colors"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="font-medium text-sm text-ink">{device.name}</div>
          <div className="text-xs text-mute font-mono mt-0.5">{device.ip_address}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`status-dot w-2 h-2 rounded-full ${status.dot}`} />
          <span className="text-xs text-mute">{status.label}</span>
        </div>
      </div>

      <div className="text-[11px] text-faint uppercase tracking-wide mb-3">
        {TYPE_LABEL[device.device_type]}
      </div>

      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-line">
        <Metric label="CPU" value={device.cpu_percent} unit="%" />
        <Metric label="Memory" value={device.memory_percent} unit="%" />
        <Metric label="Bandwidth" value={device.bandwidth_mbps} unit=" Mbps" />
      </div>
    </Link>
  )
}
