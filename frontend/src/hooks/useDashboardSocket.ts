import { useEffect, useRef, useState } from "react";

export interface LiveUpdate {
  device_id: string;
  status: string;
  metric_type: string;
  value: number;
  device_name?: string;
  previous_status?: string;
}

const MAX_LIVE_EVENTS = 50;

/**
 * Connects to the backend's WebSocket. Keeps two views of the stream:
 * - `updates`: latest value per device+metric_type (for status badges/charts)
 * - `liveEvents`: a rolling list of "status_change" messages specifically,
 *   in arrival order, for the activity feed and toast notifications.
 */
export function useDashboardSocket() {
  const [updates, setUpdates] = useState<Record<string, LiveUpdate>>({});
  const [liveEvents, setLiveEvents] = useState<LiveUpdate[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      // No point opening a connection the backend will just reject —
      // ProtectedRoute shouldn't render this without a token anyway, but
      // this guards against any edge case (e.g. token cleared mid-session).
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(
      `${protocol}//${window.location.host}/api/ws/dashboard?token=${encodeURIComponent(token)}`
    );
    socketRef.current = socket;

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);

    socket.onmessage = (event) => {
      try {
        const data: LiveUpdate = JSON.parse(event.data);
        setUpdates((prev) => ({
          ...prev,
          [`${data.device_id}:${data.metric_type}`]: data,
        }));

        if (data.metric_type === "status_change") {
          setLiveEvents((prev) => [data, ...prev].slice(0, MAX_LIVE_EVENTS));
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => socket.close();
  }, []);

  return { updates, liveEvents, connected };
}
