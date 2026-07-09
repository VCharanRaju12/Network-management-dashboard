import { useEffect, useState } from "react";

export interface Toast {
  id: string;
  message: string;
  variant: "online" | "offline";
}

let idCounter = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function pushToast(message: string, variant: "online" | "offline") {
    const id = `toast-${idCounter++}`;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }

  return { toasts, pushToast };
}

export function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // trigger enter animation on next frame
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const isOffline = toast.variant === "offline";

  return (
    <div
      className={`bg-surface border rounded-xl px-4 py-3 shadow-lg flex items-start gap-3
                  transition-all duration-300 ${
                    visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                  } ${isOffline ? "border-offline/40" : "border-online/40"}`}
    >
      <span
        className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
          isOffline ? "bg-offline" : "bg-online status-dot-online"
        }`}
      />
      <p className="text-sm">{toast.message}</p>
    </div>
  );
}
