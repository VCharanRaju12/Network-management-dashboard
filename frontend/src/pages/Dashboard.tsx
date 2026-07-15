import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Router, Network, LayoutGrid, Share2, Plus, LogOut, RadioTower, Users as UsersIcon, ScrollText } from "lucide-react";
import { api, type Device } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useDashboardSocket } from "../hooks/useDashboardSocket";
import { StatusBadge } from "../components/StatusBadge";
import { AddDeviceForm } from "../components/AddDeviceForm";
import { ActivityFeed } from "../components/ActivityFeed";
import { NetworkTopology } from "../components/NetworkTopology";
import { ToastContainer, useToasts } from "../components/Toast";
import { StatsBar } from "../components/StatsBar";

type ViewMode = "grid" | "topology";

const DEVICE_ICONS: Record<string, typeof Router> = {
  router: Router,
  switch: Share2,
  access_point: RadioTower,
};

export function Dashboard() {
  const { role, username, logout } = useAuth();
  const isAdmin = role === "admin";
  const { updates, liveEvents, connected } = useDashboardSocket();
  const { toasts, pushToast } = useToasts();

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [view, setView] = useState<ViewMode>("grid");

  const seenEventKeys = useRef(new Set<string>());

  async function loadDevices() {
    try {
      const data = await api.listDevices();
      setDevices(data);
      setError(null);
    } catch {
      setError("Couldn't load devices. Check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    for (const event of liveEvents) {
      const key = `${event.device_id}-${event.previous_status}-${event.status}`;
      if (seenEventKeys.current.has(key)) continue;
      seenEventKeys.current.add(key);

      const name = event.device_name ?? "A device";
      if (event.status === "offline") {
        pushToast(`${name} went offline`, "offline");
      } else if (event.status === "online" && event.previous_status === "offline") {
        pushToast(`${name} is back online`, "online");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveEvents]);

  const liveDevices = useMemo(
    () =>
      devices.map((device) => {
        const liveUpdate = updates[`${device.id}:reachability`];
        return liveUpdate ? { ...device, status: liveUpdate.status } : device;
      }),
    [devices, updates]
  );

  return (
    <div className="min-h-screen">
      <ToastContainer toasts={toasts} />

      <header className="border-b border-border backdrop-blur-sm bg-base/80 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-signal/10 border border-signal/30 flex items-center justify-center">
              <Network size={16} className="text-signal" strokeWidth={2} />
            </div>
            <div>
              <p className="font-semibold text-sm leading-none">Network Dashboard</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-online status-dot-online" : "bg-unknown"}`}
                />
                <span className="text-[11px] text-muted font-mono uppercase tracking-wider">
                  {connected ? "Live" : "Reconnecting…"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {isAdmin && (
              <Link
                to="/admin/users"
                className="flex items-center gap-1.5 text-muted hover:text-ink transition-colors"
              >
                <UsersIcon size={14} />
                Users
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/admin/audit-log"
                className="flex items-center gap-1.5 text-muted hover:text-ink transition-colors"
              >
                <ScrollText size={14} />
                Audit log
              </Link>
            )}
            <Link
              to="/account"
              className="text-muted hover:text-ink transition-colors"
              title="Account settings"
            >
              {username} <span className="text-border">·</span>{" "}
              <span className="capitalize text-ink">{role}</span>
            </Link>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-muted hover:text-ink transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <StatsBar devices={liveDevices} />

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold">Devices</h1>
            <p className="text-sm text-muted mt-0.5">
              {liveDevices.length} device{liveDevices.length !== 1 ? "s" : ""} monitored
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-surface border border-border rounded-lg p-0.5 text-sm">
              <button
                onClick={() => setView("grid")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                  view === "grid" ? "bg-signal text-base font-semibold" : "text-muted hover:text-ink"
                }`}
              >
                <LayoutGrid size={14} />
                Grid
              </button>
              <button
                onClick={() => setView("topology")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                  view === "topology" ? "bg-signal text-base font-semibold" : "text-muted hover:text-ink"
                }`}
              >
                <Share2 size={14} />
                Topology
              </button>
            </div>

            {isAdmin && !showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-signal text-base rounded-lg
                           hover:bg-signal/90 transition-colors"
              >
                <Plus size={16} />
                Add device
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          <div>
            {showAddForm && (
              <AddDeviceForm
                onCreated={() => {
                  setShowAddForm(false);
                  loadDevices();
                }}
                onCancel={() => setShowAddForm(false)}
              />
            )}

            {loading && <p className="text-sm text-muted">Loading devices…</p>}
            {error && <p className="text-sm text-offline">{error}</p>}

            {!loading && !error && liveDevices.length === 0 && (
              <div className="border border-dashed border-border rounded-xl p-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-signal/10 border border-signal/30 flex items-center justify-center mx-auto mb-3">
                  <Router size={20} className="text-signal" strokeWidth={1.5} />
                </div>
                <p className="text-sm text-muted">
                  No devices yet.{" "}
                  {isAdmin ? "Add one above to start monitoring." : "Ask an admin to add one."}
                </p>
              </div>
            )}

            {!loading && liveDevices.length > 0 && view === "topology" && (
              <NetworkTopology devices={liveDevices} />
            )}

            {!loading && liveDevices.length > 0 && view === "grid" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {liveDevices.map((device) => {
                  const Icon = DEVICE_ICONS[device.device_type] ?? Router;
                  return (
                    <Link
                      key={device.id}
                      to={`/devices/${device.id}`}
                      className="bg-surface border border-border rounded-xl p-5 hover:border-signal/50
                                 hover:bg-surface-hover hover:-translate-y-0.5 transition-all block group"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-9 h-9 rounded-lg bg-base border border-border flex items-center justify-center
                                        group-hover:border-signal/40 transition-colors">
                          <Icon size={16} className="text-muted group-hover:text-signal transition-colors" strokeWidth={1.75} />
                        </div>
                        <StatusBadge status={device.status} />
                      </div>
                      <h3 className="font-medium text-sm">{device.name}</h3>
                      <p className="text-xs text-muted font-mono mt-0.5 mb-3">{device.ip_address}</p>
                      <span className="capitalize text-[11px] text-muted bg-base border border-border rounded px-2 py-0.5">
                        {device.device_type.replace("_", " ")}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <ActivityFeed liveEvents={liveEvents} />
        </div>
      </main>
    </div>
  );
}
