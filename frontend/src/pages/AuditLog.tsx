import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ScrollText } from "lucide-react";
import { api, type AuditLogEntry } from "../api/client";
import { Pagination } from "../components/Pagination";

const PAGE_SIZE = 25;

function describeEntry(entry: AuditLogEntry): string {
  const details = entry.details ?? {};
  switch (entry.action) {
    case "device.created":
      return `Device "${details.name ?? "unknown"}" was created`;
    case "device.updated":
      return `Device was updated (${Object.keys(details).join(", ") || "no fields recorded"})`;
    case "device.deleted":
      return "Device was deleted";
    case "device.status_changed":
      return `Device "${details.device_name ?? "unknown"}" went ${details.to ?? "?"} (was ${details.from ?? "?"})`;
    case "user.created":
      return `User "${details.username ?? "unknown"}" was created`;
    case "user.updated":
      return `User was updated (${Object.keys(details).join(", ") || "no fields recorded"})`;
    case "user.deleted":
      return "User was deleted";
    case "user.password_changed":
      return "User changed their password";
    default:
      return entry.action;
  }
}

export function AuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .getAuditLog(offset, PAGE_SIZE)
      .then(setEntries)
      .catch(() => setError("Couldn't load the audit log."))
      .finally(() => setLoading(false));
  }, [offset]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link to="/" className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors">
            <ArrowLeft size={14} />
            Back to dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-lg bg-signal/10 border border-signal/30 flex items-center justify-center">
            <ScrollText size={16} className="text-signal" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Audit log</h1>
            <p className="text-sm text-muted">Every recorded action, most recent first</p>
          </div>
        </div>

        {error && <p className="text-sm text-offline mb-4">{error}</p>}
        {loading && <p className="text-sm text-muted">Loading…</p>}

        {!loading && (
          <>
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted text-left">
                    <th className="px-4 py-2 font-medium">Event</th>
                    <th className="px-4 py-2 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">{describeEntry(entry)}</td>
                      <td className="px-4 py-2 text-muted whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-muted">
                        Nothing recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              offset={offset}
              limit={PAGE_SIZE}
              count={entries.length}
              onPrev={() => setOffset((o) => Math.max(o - PAGE_SIZE, 0))}
              onNext={() => setOffset((o) => o + PAGE_SIZE)}
            />
          </>
        )}
      </main>
    </div>
  );
}
