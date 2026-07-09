import { Router, Wifi, WifiOff, AlertTriangle, HelpCircle } from "lucide-react";
import type { Device } from "../api/client";

export function StatsBar({ devices }: { devices: Device[] }) {
  const total = devices.length;
  const online = devices.filter((d) => d.status === "online").length;
  const offline = devices.filter((d) => d.status === "offline").length;
  const degraded = devices.filter((d) => d.status === "degraded").length;
  const unknown = total - online - offline - degraded;

  const stats = [
    { label: "Total devices", value: total, icon: Router, color: "text-signal", bg: "bg-signal/10" },
    { label: "Online", value: online, icon: Wifi, color: "text-online", bg: "bg-online/10" },
    { label: "Offline", value: offline, icon: WifiOff, color: "text-offline", bg: "bg-offline/10" },
    { label: "Degraded", value: degraded, icon: AlertTriangle, color: "text-degraded", bg: "bg-degraded/10" },
    { label: "Unknown", value: unknown, icon: HelpCircle, color: "text-muted", bg: "bg-unknown/10" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
      {stats.map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="bg-surface border border-border rounded-xl p-4">
          <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-3`}>
            <Icon size={16} className={color} strokeWidth={2} />
          </div>
          <p className="text-2xl font-semibold font-mono tabular-nums">{value}</p>
          <p className="text-xs text-muted mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  );
}
