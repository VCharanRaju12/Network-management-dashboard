const STATUS_STYLES: Record<string, { dot: string; text: string; label: string }> = {
  online: { dot: "bg-online status-dot-online", text: "text-online", label: "Online" },
  offline: { dot: "bg-offline", text: "text-offline", label: "Offline" },
  degraded: { dot: "bg-degraded", text: "text-degraded", label: "Degraded" },
  unknown: { dot: "bg-unknown", text: "text-muted", label: "Unknown" },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${style.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}
