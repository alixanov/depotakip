import type { ReactNode } from "react";
import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  width?: string;
  className?: string;
  /** Server-side sort field. Enables clickable header (3-state toggle). */
  sortKey?: string;
}

export interface SortState {
  key: string;
  dir: "asc" | "desc";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[] | undefined;
  loading?: boolean;
  error?: Error | null;
  empty?: ReactNode;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Number of skeleton rows to render on first load. Default 5. */
  skeletonRows?: number;
  sort?: SortState;
  onSortChange?: (next: SortState | undefined) => void;
  /** Optional card renderer for mobile (< md). Falls back to table if not provided. */
  renderCard?: (row: T) => ReactNode;
  /** Per-row classNames — used to highlight overdue/attention rows. */
  rowClassName?: (row: T) => string | undefined;
}

/** Composes a SortState into the backend `-key` / `key` convention. */
export function sortToParam(sort: SortState | undefined): string | undefined {
  if (!sort) return undefined;
  return sort.dir === "desc" ? `-${sort.key}` : sort.key;
}

/** Cycles sort state: undef → desc → asc → undef. */
function cycleSort(current: SortState | undefined, key: string): SortState | undefined {
  if (!current || current.key !== key) return { key, dir: "desc" };
  if (current.dir === "desc") return { key, dir: "asc" };
  return undefined;
}

export function DataTable<T>({
  columns,
  data,
  loading,
  error,
  empty,
  rowKey,
  onRowClick,
  skeletonRows = 5,
  sort,
  onSortChange,
  renderCard,
  rowClassName,
}: DataTableProps<T>) {
  if (error) {
    return <p className="p-6 text-sm text-destructive">{error.message}</p>;
  }

  const showSkeleton = loading && !data;
  const isEmpty = !loading && (!data || data.length === 0);

  if (isEmpty) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">{empty || "Veri yok"}</div>
    );
  }

  // Mobile: cards view (when renderCard provided)
  const mobileView = renderCard ? (
    <ul className="divide-y md:hidden">
      {showSkeleton
        ? Array.from({ length: skeletonRows }, (_, i) => (
            <li key={`sk-card-${i}`} className="p-4">
              <Skeleton className="mb-2 h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </li>
          ))
        : data!.map((row) => (
            <li
              key={rowKey(row)}
              className={cn(
                "p-4 transition-colors",
                onRowClick && "cursor-pointer hover:bg-muted/40",
                rowClassName?.(row)
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {renderCard(row)}
            </li>
          ))}
    </ul>
  ) : null;

  return (
    <>
      {mobileView}
      <div className={cn("overflow-x-auto", renderCard && "hidden md:block")}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card/85 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-card/65">
            <tr className="border-b">
              {columns.map((c) => {
                const sortable = c.sortKey && onSortChange;
                const active = sort?.key === c.sortKey;
                if (!sortable) {
                  return (
                    <th key={c.key} className={cn("p-3", c.className)} style={{ width: c.width }}>
                      {c.header}
                    </th>
                  );
                }
                const ariaSort = !active
                  ? "none"
                  : sort?.dir === "asc"
                    ? "ascending"
                    : "descending";
                return (
                  <th
                    key={c.key}
                    className={cn("p-3", c.className)}
                    style={{ width: c.width }}
                    aria-sort={ariaSort}
                  >
                    <button
                      type="button"
                      onClick={() => onSortChange(cycleSort(sort, c.sortKey!))}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-sm transition-colors hover:text-foreground",
                        active && "text-foreground"
                      )}
                    >
                      {c.header}
                      {active && sort?.dir === "asc" ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : active && sort?.dir === "desc" ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-50" />
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {showSkeleton
              ? Array.from({ length: skeletonRows }, (_, i) => (
                  <tr key={`sk-${i}`} className="border-b last:border-0">
                    {columns.map((c) => (
                      <td key={c.key} className={cn("p-3", c.className)}>
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              : data!.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "border-b last:border-0",
                      onRowClick && "cursor-pointer hover:bg-muted/40",
                      rowClassName?.(row)
                    )}
                  >
                    {columns.map((c) => (
                      <td key={c.key} className={cn("p-3 align-top", c.className)}>
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

interface PaginationBarProps {
  pagination: PaginationInfo | undefined;
  onChange: (page: number) => void;
}

export function PaginationBar({ pagination, onChange }: PaginationBarProps) {
  if (!pagination || pagination.total <= pagination.limit) return null;
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  return (
    <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
      <span>
        {pagination.total} kayıt · sayfa {pagination.page}/{totalPages}
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={pagination.page <= 1}
          onClick={() => onChange(pagination.page - 1)}
          className="rounded px-2 py-1 hover:bg-muted disabled:opacity-30"
        >
          ‹
        </button>
        <button
          type="button"
          disabled={!pagination.hasMore}
          onClick={() => onChange(pagination.page + 1)}
          className="rounded px-2 py-1 hover:bg-muted disabled:opacity-30"
        >
          ›
        </button>
      </div>
    </div>
  );
}
