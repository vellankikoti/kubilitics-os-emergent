import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ListPaginationProps {
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  rangeLabel?: string;
  /** 1-based; when set with totalPages, page number buttons are shown between Prev and Next. */
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

/** Build page numbers to show: e.g. [1, 2, 3] or [1, '...', 4, 5, 6, '...', 11]. */
function getPageNumbers(current: number, total: number, maxVisible = 5): (number | 'ellipsis')[] {
  if (total <= maxVisible + 2) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const showLeft = current <= 3;
  const showRight = current >= total - 2;
  if (showLeft) {
    const pages: (number | 'ellipsis')[] = [];
    for (let i = 1; i <= Math.min(4, total); i++) pages.push(i);
    pages.push('ellipsis');
    pages.push(total);
    return pages;
  }
  if (showRight) {
    const pages: (number | 'ellipsis')[] = [1, 'ellipsis'];
    for (let i = Math.max(1, total - 3); i <= total; i++) pages.push(i);
    return pages;
  }
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
}

/**
 * Pagination bar: range label, Previous, optional page numbers, Next.
 * Use for list pages so users can see and jump to a specific page (world-class UX).
 */
export function ListPagination({
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  rangeLabel,
  currentPage,
  totalPages,
  onPageChange,
  className,
}: ListPaginationProps) {
  const showPageNumbers =
    currentPage != null && totalPages != null && totalPages > 0 && onPageChange;
  const pages = showPageNumbers ? getPageNumbers(currentPage, totalPages) : [];

  return (
    <div className={cn('flex items-center justify-between pt-2 flex-wrap gap-2', className)}>
      {rangeLabel && (
        <span className="text-sm text-muted-foreground">{rangeLabel}</span>
      )}
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" className="gap-1" onClick={onPrev} disabled={!hasPrev}>
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        {showPageNumbers &&
          pages.map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`e-${i}`} className="px-2 text-muted-foreground" aria-hidden>
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === currentPage ? 'default' : 'outline'}
                size="sm"
                className="min-w-8 h-8 p-0 tabular-nums"
                onClick={() => onPageChange(p)}
                aria-label={`Page ${p}`}
                aria-current={p === currentPage ? 'page' : undefined}
              >
                {p}
              </Button>
            )
          )}
        <Button variant="outline" size="sm" className="gap-1" onClick={onNext} disabled={!hasNext}>
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
