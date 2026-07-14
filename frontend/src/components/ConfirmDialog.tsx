import { AlertTriangle } from "lucide-react";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
  danger = false,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-surface border border-border rounded-xl p-6 max-w-sm w-full">
        <div className="flex items-start gap-3 mb-4">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              danger ? "bg-offline/10" : "bg-signal/10"
            }`}
          >
            <AlertTriangle size={16} className={danger ? "text-offline" : "text-signal"} />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="text-sm text-muted mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-2 text-sm text-muted hover:text-ink transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              danger ? "bg-offline text-base hover:bg-offline/90" : "bg-signal text-base hover:bg-signal/90"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
