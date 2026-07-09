import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Device, type Metric } from "../api/client";
import { MetricChart } from "../components/MetricChart";

const METRIC_LABELS: Record<string, string> = {
  reachability: "Reachability",
  cpu: "CPU",
  memory: "Memory",
  uptime_ticks: "Uptime (ticks)",
  interfaces_up: "Interfaces up",
  interfaces_total: "Interfaces total",
};

function formatValue(metricType: string, value: number): string {
  if (metricType === "reachability") return value === 1 ? "Up" : "Down";
  if (metricType === "cpu" || metricType === "memory") return `${value.toFixed(1)}%`;
  return value.toLocaleString();
}

export function DeviceDetail() {
  const { id } = useParams<{ id: string }>();
  const [device, setDevice] = useState<Device | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getDevice(id), api.getDeviceMetrics(id)])
      .then(([deviceData, metricsData]) => {
        setDevice(deviceData);
        setMetrics(metricsData);
      })
      .catch(() => setError("Couldn't load this device."))
      .finally(() => setLoading(false));
  }, [id]);

  const latestByType = metrics.reduce<Record<string, Metric>>((acc, m) => {
    if (!acc[m.metric_type] || new Date(m.recorded_at) > new Date(acc[m.metric_type].recorded_at)) {
      acc[m.metric_type] = m;
    }
    return acc;
  }, {});

  const availableTypes = new Set(metrics.map((m) => m.metric_type));

  if (loading) return <div className="max-w-4xl mx-auto px-6 py-8 text-sm text-muted">Loading…</div>;
  if (error || !device)
    return <div className="max-w-4xl mx-auto px-6 py-8 text-sm text-offline">{error ?? "Device not found."}</div>;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link to="/" className="text-sm text-muted hover:text-ink transition-colors">
            ← Back to devices
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-lg font-semibold">{device.name}</h1>
        <p className="text-sm text-muted font-mono mt-0.5 mb-6">{device.ip_address}</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {Object.entries(latestByType).map(([type, metric]) => (
            <div key={type} className="bg-surface border border-border rounded-xl p-4">
              <p className="text-xs text-muted mb-1">{METRIC_LABELS[type] ?? type}</p>
              <p className="text-lg font-semibold font-mono">
                {formatValue(type, metric.value)}
              </p>
            </div>
          ))}
        </div>

        <h2 className="text-sm font-semibold mb-3">Trends</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {availableTypes.has("cpu") && (
            <MetricChart metrics={metrics} metricType="cpu" label="CPU usage" color="#22D3EE" unit="%" />
          )}
          {availableTypes.has("memory") && (
            <MetricChart metrics={metrics} metricType="memory" label="Memory usage" color="#34D399" unit="%" />
          )}
          {availableTypes.has("reachability") && (
            <MetricChart
              metrics={metrics}
              metricType="reachability"
              label="Reachability (1 = up, 0 = down)"
              color="#FBBF24"
            />
          )}
          {!availableTypes.has("cpu") && !availableTypes.has("memory") && (
            <div className="bg-surface border border-border rounded-xl p-4 sm:col-span-2">
              <p className="text-xs text-muted">
                No CPU/memory data — this device either doesn't have an SNMP community configured,
                or doesn't expose HOST-RESOURCES-MIB. Reachability is still tracked above.
              </p>
            </div>
          )}
        </div>

        <h2 className="text-sm font-semibold mb-3">Recent readings</h2>
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted text-left">
                <th className="px-4 py-2 font-medium">Metric</th>
                <th className="px-4 py-2 font-medium">Value</th>
                <th className="px-4 py-2 font-medium">Recorded at</th>
              </tr>
            </thead>
            <tbody>
              {metrics.slice(0, 30).map((m, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">{METRIC_LABELS[m.metric_type] ?? m.metric_type}</td>
                  <td className="px-4 py-2 font-mono">{formatValue(m.metric_type, m.value)}</td>
                  <td className="px-4 py-2 text-muted">
                    {new Date(m.recorded_at).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
              {metrics.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted">
                    No metrics recorded yet — check back in a poll cycle or two.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
