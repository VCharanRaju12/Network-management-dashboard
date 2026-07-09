import { useEffect, useState } from "react";
import { api, type DeviceEvent } from "../api/client";
import type { LiveUpdate } from "../hooks/useDashboardSocket";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function ActivityFeed({ liveEvents }: { liveEvents: LiveUpdate[] }) {
  const [history, setHistory] = useState<DeviceEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getRecentEvents(30)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  // Merge: live WebSocket events appear instantly; on refresh we fall back
  // to the backend's persisted history so the feed isn't empty on load.
  const liveIds = new Set(liveEvents.map((e) => `${e.device_id}-${e.previous_status}-${e.status}`));
  const filteredHistory = history.filter(
    (h) => !liveIds.has(`${h.device_id}-${h.from_status}-${h.to_status}`)
  );

  return (
    <aside className="bg-surface border border-border rounded-xl p-4 h-fit sticky top-6">
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
        Activity
        <span className="w-1.5 h-1.5 rounded-full bg-signal status-dot-online" />
      </h2>

      <div className="space-y-3 max-h-[520px] overflow-y-auto">
        {liveEvents.map((event, i) => (
          <FeedRow
            key={`live-${i}`}
            name={event.device_name ?? "Device"}
            from={event.previous_status ?? "unknown"}
            to={event.status}
            when="just now"
          />
        ))}

        {loading && liveEvents.length === 0 && (
          <p className="text-xs text-muted">Loading activity…</p>
        )}

        {!loading && liveEvents.length === 0 && filteredHistory.length === 0 && (
          <p className="text-xs text-muted">
            No status changes recorded yet — this fills in as devices go on/offline.
          </p>
        )}

        {filteredHistory.map((event) => (
          <FeedRow
            key={event.id}
            name={event.device_name ?? "Device"}
            from={event.from_status ?? "unknown"}
            to={event.to_status ?? "unknown"}
            when={timeAgo(event.created_at)}
          />
        ))}
      </div>
    </aside>
  );
}

function FeedRow({ name, from, to, when }: { name: string; from: string; to: string; when: string }) {
  const wentUp = to === "online";
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <span
        className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          wentUp ? "bg-online" : "bg-offline"
        }`}
      />
      <div className="min-w-0">
        <p className="leading-tight">
          <span className="font-medium">{name}</span>{" "}
          <span className="text-muted">
            went {wentUp ? "online" : "offline"}
            {from !== "unknown" ? ` (was ${from})` : ""}
          </span>
        </p>
        <p className="text-xs text-muted mt-0.5">{when}</p>
      </div>
    </div>
  );
}
