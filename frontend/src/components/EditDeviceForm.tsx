import { useState, type FormEvent } from "react";
import { api, type Device } from "../api/client";

export function EditDeviceForm({
  device,
  onSaved,
  onCancel,
}: {
  device: Device;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(device.name);
  const [vendor, setVendor] = useState(device.vendor ?? "");
  const [pollInterval, setPollInterval] = useState(device.poll_interval_seconds);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.updateDevice(device.id, {
        name,
        vendor: vendor || undefined,
        poll_interval_seconds: pollInterval,
      });
      onSaved();
    } catch {
      setError("Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-5 mb-6 space-y-4">
      <h2 className="text-sm font-semibold">Edit device</h2>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-signal/60"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Vendor (optional)</label>
          <input
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="Cisco, Ubiquiti, TP-Link…"
            className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-signal/60"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Poll interval (seconds)</label>
          <input
            type="number"
            min={5}
            value={pollInterval}
            onChange={(e) => setPollInterval(Number(e.target.value))}
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
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
