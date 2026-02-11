import { cn } from '@/lib/utils';

export interface ResourceCommandBarProps {
  scope: React.ReactNode;
  search: React.ReactNode;
  /** Optional right zone (e.g. list view: Flat / By Namespace). When omitted, bar uses 2 columns. */
  structure?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Gold-standard command bar: 2 or 3 equal-weight sections with light dividers.
 * - 3 columns: scope | search | structure (grid-cols-[1fr_1fr_auto], third content-sized).
 * - 2 columns: scope | search when structure is omitted.
 */
export function ResourceCommandBar({
  scope,
  search,
  structure,
  footer,
  className,
}: ResourceCommandBarProps) {
  const hasStructure = structure != null;
  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'grid min-h-[52px] w-full items-center gap-0 rounded-xl border border-border bg-card py-3 shadow-sm ring-1 ring-black/[0.06]',
          hasStructure ? 'grid-cols-[1fr_1fr_auto]' : 'grid-cols-2'
        )}
      >
        <div className="min-w-0 flex items-center overflow-hidden pl-5 pr-4">{scope}</div>
        <div
          className={cn(
            'min-w-0 flex items-center overflow-hidden border-l border-border/40 pl-4',
            hasStructure ? 'pr-4' : 'pr-5'
          )}
        >
          {search}
        </div>
        {hasStructure && (
          <div className="flex shrink-0 items-center overflow-hidden border-l border-border/40 pl-4 pr-5">
            {structure}
          </div>
        )}
      </div>
      {footer != null && (
        <div className="mt-2 px-1">{footer}</div>
      )}
    </div>
  );
}
