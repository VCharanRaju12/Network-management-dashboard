import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  offset,
  limit,
  count,
  onPrev,
  onNext,
}: {
  offset: number;
  limit: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const hasPrev = offset > 0;
  // If we got a full page back, there's likely more — "likely" because we
  // don't have a total count from the API, just this page's size relative
  // to what was requested.
  const hasNext = count === limit;

  if (!hasPrev && !hasNext) return null;

  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <span className="text-xs text-muted">
        Showing {offset + 1}–{offset + count}
      </span>
      <div className="flex gap-2">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-lg
                     text-muted hover:text-ink hover:border-signal/40 transition-colors
                     disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronLeft size={13} />
          Previous
        </button>
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-lg
                     text-muted hover:text-ink hover:border-signal/40 transition-colors
                     disabled:opacity-40 disabled:pointer-events-none"
        >
          Next
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
