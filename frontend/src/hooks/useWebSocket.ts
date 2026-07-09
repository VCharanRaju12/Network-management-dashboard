import { useEffect, useRef, useState } from 'react'
import { getToken } from '../api/client'
import { Device } from '../api/client'

type ConnectionState = 'connecting' | 'open' | 'closed'

// Connects to the backend's dashboard socket and keeps a live map of
// device_id -> Device, merging incoming patches over the initial REST
// snapshot. Reconnects with backoff if the connection drops.
export function useDeviceSocket(initialDevices: Device[]) {
  const [devices, setDevices] = useState<Device[]>(initialDevices)
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const socketRef = useRef<WebSocket | null>(null)
  const retryDelay = useRef(1000)

  useEffect(() => {
    setDevices(initialDevices)
  }, [initialDevices])

  useEffect(() => {
    let cancelled = false

    function connect() {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const token = getToken()
      const ws = new WebSocket(
        `${proto}://${window.location.host}/ws/dashboard?token=${token ?? ''}`,
      )
      socketRef.current = ws
      setConnectionState('connecting')

      ws.onopen = () => {
        retryDelay.current = 1000
        setConnectionState('open')
      }

      ws.onmessage = (event) => {
        try {
          const update: Partial<Device> & { id: string } = JSON.parse(event.data)
          setDevices((prev) =>
            prev.map((d) => (d.id === update.id ? { ...d, ...update } : d)),
          )
        } catch {
          // ignore malformed frames
        }
      }

      ws.onclose = () => {
        setConnectionState('closed')
        if (cancelled) return
        setTimeout(connect, retryDelay.current)
        retryDelay.current = Math.min(retryDelay.current * 2, 15000)
      }

      ws.onerror = () => ws.close()
    }

    connect()
    return () => {
      cancelled = true
      socketRef.current?.close()
    }
  }, [])

  return { devices, connectionState }
}
