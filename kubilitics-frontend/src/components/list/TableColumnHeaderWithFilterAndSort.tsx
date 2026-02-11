import * as React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface TableColumnHeaderWithFilterAndSortProps {
  columnId: string;
  label: string;
  sortable?: boolean;
  sortKey: string | null;
  sortOrder: 'asc' | 'desc';
  onSort: (key: string) => void;
  filterable: boolean;
  distinctValues: string[];
  selectedFilterValues: Set<string>;
  onFilterChange: (columnId: string, values: Set<string> | null) => void;
  className?: string;
  /** Optional: render extra content (e.g. resize handle is outside). */
  children?: React.ReactNode;
}

export function TableColumnHeaderWithFilterAndSort({
  columnId,
  label,
  sortable = true,
  sortKey,
  sortOrder,
  onSort,
  filterable,
  distinctValues,
  selectedFilterValues,
  onFilterChange,
  className,
  children,
}: TableColumnHeaderWithFilterAndSortProps) {
  const isSorted = sortKey === columnId;
  const hasFilter = selectedFilterValues.size > 0;

  const toggleFilterValue = (value: string) => {
    const next = new Set(selectedFilterValues);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onFilterChange(columnId, next.size === 0 ? null : next);
  };

  const selectAll = () => {
    onFilterChange(columnId, new Set(distinctValues));
  };

  const clearFilter = () => {
    onFilterChange(columnId, null);
  };

  const allSelected = distinctValues.length > 0 && selectedFilterValues.size === distinctValues.length;

  return (
    <div className={cn('flex items-center gap-1 min-w-0', className)}>
      {filterable ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'gap-1 -ml-2 h-auto py-1 px-1.5 max-w-full min-w-0 font-semibold',
                hasFilter && 'text-primary'
              )}
              aria-label={`Filter by ${label}`}
              title={label}
            >
              <span className="truncate">{label}</span>
              <Filter
                className={cn('h-3.5 w-3.5 flex-shrink-0', hasFilter && 'text-primary')}
                aria-hidden
              />
              {hasFilter && (
                <span className="flex-shrink-0 text-xs bg-primary/20 text-primary rounded px-1" aria-hidden>
                  {selectedFilterValues.size}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Filter by {label}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={selectAll}>
                  Select all
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={clearFilter}>
                  Clear
                </Button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {distinctValues.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No values in this column</p>
                ) : (
                  distinctValues.map((value) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded px-1.5 py-1"
                    >
                      <Checkbox
                        checked={selectedFilterValues.has(value)}
                        onCheckedChange={() => toggleFilterValue(value)}
                        aria-label={value}
                      />
                      <span className="truncate">{value}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <span className="truncate font-semibold" title={label}>{label}</span>
      )}

      {sortable && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 flex-shrink-0"
          onClick={() => onSort(columnId)}
          aria-label={isSorted ? `Sort ${sortOrder === 'asc' ? 'ascending' : 'descending'}` : `Sort by ${label}`}
        >
          {isSorted ? (
            sortOrder === 'asc' ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" />
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </Button>
      )}
      {children}
    </div>
  );
}
