import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Pencil, Trash2, ArrowLeft } from "lucide-react";
import { api, type Device, type Metric, type InterfaceDetail } from "../api/client";
import { MetricChart } from "../components/MetricChart";
import { EditDeviceForm } from "../components/EditDeviceForm";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useAuth } from "../context/AuthContext";

const METRIC_LABELS: Record<string, string> = {
  reachability: "Reachability",
  cpu: "CPU",
  memory: "Memory",
  uptime_ticks: "Uptime (ticks)",
  interfaces_up: "Interfaces up",
  interfaces_total: "Interfaces total",
  bandwidth_in_mbps: "Bandwidth in",
  bandwidth_out_mbps: "Bandwidth out",
};

function formatValue(metricType: string, value: number): string {
  if (metricType === "reachability") return value === 1 ? "Up" : "Down";
  if (metricType === "cpu" || metricType === "memory") return `${value.toFixed(1)}%`;
  if (metricType === "bandwidth_in_mbps" || metricType === "bandwidth_out_mbps") {
    return `${value.toFixed(2)} Mbps`;
  }
  return value.toLocaleString();
}

export function DeviceDetail() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const navigate = useNavigate();

  const [device, setDevice] = useState<Device | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [interfaces, setInterfaces] = useState<InterfaceDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function loadAll() {
    if (!id) return;
    Promise.all([api.getDevice(id), api.getDeviceMetrics(id), api.getDeviceInterfaces(id)])
      .then(([deviceData, metricsData, interfacesData]) => {
        setDevice(deviceData);
        setMetrics(metricsData);
        setInterfaces(interfacesData);
      })
      .catch(() => setError("Couldn't load this device."))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [id]);

  async function handleDelete() {
    if (!id) return;
    try {
      await api.deleteDevice(id);
      navigate("/");
    } catch {
      setError("Couldn't delete this device.");
    }
  }

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
      {confirmingDelete && (
        <ConfirmDialog
          title="Delete this device?"
          message={`This removes "${device.name}" and its history. This can't be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}

      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors">
            <ArrowLeft size={14} />
            Back to devices
          </Link>

          {isAdmin && !editing && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted hover:text-ink
                           border border-border rounded-lg transition-colors"
              >
                <Pencil size={13} />
                Edit
              </button>
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-offline hover:bg-offline/10
                           border border-offline/30 rounded-lg transition-colors"
              >
                <Trash2 size={13} />
                Delete
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {editing ? (
          <EditDeviceForm
            device={device}
            onSaved={() => {
              setEditing(false);
              loadAll();
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <h1 className="text-lg font-semibold">{device.name}</h1>
            <p className="text-sm text-muted font-mono mt-0.5 mb-6">{device.ip_address}</p>
          </>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {Object.entries(latestByType).map(([type, metric]) => (
            <div key={type} className="bg-surface border border-border rounded-xl p-4">
              <p className="text-xs text-muted mb-1">{METRIC_LABELS[type] ?? type}</p>
              <p className="text-lg font-semibold font-mono">{formatValue(type, metric.value)}</p>
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
          {availableTypes.has("bandwidth_in_mbps") && (
            <MetricChart
              metrics={metrics}
              metricType="bandwidth_in_mbps"
              label="Bandwidth in"
              color="#A78BFA"
              unit=" Mbps"
            />
          )}
          {availableTypes.has("bandwidth_out_mbps") && (
            <MetricChart
              metrics={metrics}
              metricType="bandwidth_out_mbps"
              label="Bandwidth out"
              color="#F472B6"
              unit=" Mbps"
            />
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
          {(availableTypes.has("bandwidth_in_mbps") || availableTypes.has("bandwidth_out_mbps")) &&
            interfaces.length > 1 && (
              <div className="bg-surface border border-border rounded-xl p-4 sm:col-span-2">
                <p className="text-xs text-muted">
                  This device has {interfaces.length} interfaces — the bandwidth chart above combines
                  readings from all of them into one series. Per-interface bandwidth breakdown isn't
                  built yet; the Interfaces table below still shows each port individually.
                </p>
              </div>
            )}
        </div>

        {interfaces.length > 0 && (
          <>
            <h2 className="text-sm font-semibold mb-3">Interfaces</h2>
            <div className="bg-surface border border-border rounded-xl overflow-hidden mb-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted text-left">
                    <th className="px-4 py-2 font-medium">Interface</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Speed</th>
                  </tr>
                </thead>
                <tbody>
                  {interfaces.map((iface) => (
                    <tr key={iface.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-mono">{iface.if_name}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            iface.is_up ? "text-online" : "text-offline"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              iface.is_up ? "bg-online status-dot-online" : "bg-offline"
                            }`}
                          />
                          {iface.is_up ? "Up" : "Down"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-muted font-mono">
                        {iface.speed_mbps ? `${iface.speed_mbps} Mbps` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

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
                  <td className="px-4 py-2 text-muted">{new Date(m.recorded_at).toLocaleTimeString()}</td>
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
