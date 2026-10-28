import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';

export default function Pagination({ page, pageSize, total, onPageChange }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  const navButton = 'focus-ring flex h-7 w-7 items-center justify-center rounded-md border border-line text-muted transition-colors hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-40';

  return (
    <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-3 text-xs text-muted sm:px-5">
      <span className="tabular-nums">
        {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" className={navButton} onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPageChange(n)}
            aria-current={n === page ? 'page' : undefined}
            className={cn(
              'focus-ring hidden h-7 min-w-7 rounded-md px-2 tabular-nums transition-colors sm:inline-block',
              n === page ? 'bg-hover font-medium text-fg' : 'hover:bg-hover hover:text-fg',
            )}
          >
            {n}
          </button>
        ))}
        <button type="button" className={navButton} onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
