import { useState, type FormEvent } from "react";
import { api } from "../api/client";

export function AddDeviceForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [deviceType, setDeviceType] = useState("router");
  const [snmpCommunity, setSnmpCommunity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createDevice({
        name,
        ip_address: ipAddress,
        device_type: deviceType,
        snmp_community: snmpCommunity || undefined,
        poll_interval_seconds: 30,
      });
      onCreated();
    } catch {
      setError("Couldn't add device — check the fields and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface border border-border rounded-xl p-5 mb-6 space-y-4"
    >
      <h2 className="text-sm font-semibold">Add device</h2>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Core switch"
            className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-signal/60"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">IP address or hostname</label>
          <input
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
            required
            placeholder="192.168.1.1"
            className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm font-mono
                       focus:outline-none focus:ring-2 focus:ring-signal/60"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Type</label>
          <select
            value={deviceType}
            onChange={(e) => setDeviceType(e.target.value)}
            className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-signal/60"
          >
            <option value="router">Router</option>
            <option value="switch">Switch</option>
            <option value="access_point">Access point</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">SNMP community (optional)</label>
          <input
            value={snmpCommunity}
            onChange={(e) => setSnmpCommunity(e.target.value)}
            placeholder="public"
            className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm font-mono
                       focus:outline-none focus:ring-2 focus:ring-signal/60"
          />
        </div>
      </div>

      {error && <p className="text-sm text-offline">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 text-sm text-muted hover:text-ink transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-semibold bg-signal text-base rounded-lg
                     hover:bg-signal/90 transition-colors disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add device"}
        </button>
      </div>
    </form>
  );
}
