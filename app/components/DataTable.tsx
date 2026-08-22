"use client";

import React, { useState, useEffect, useRef } from "react";
import SortableTableHead from "@/app/components/SortableTableHead";
import { Loader2 } from "lucide-react";

export interface ColumnDef<T> {
  id: string;
  label: string;
  sortKey?: string;
  minWidth?: number | string;
  width?: string;
  rightAligned?: boolean;
  render: (row: T) => React.ReactNode;
  headerIcon?: React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  visibleColumns?: string[];
  keyExtractor: (row: T) => string;
  rowClassName?: (row: T) => string;
  maxHeight?: string;
  batchSize?: number;
  emptyMessage?: React.ReactNode;
  loading?: boolean;
  
  // Custom counter text support
  totalFilteredCount?: number;
  totalCount?: number;
  isFiltered?: boolean;
  tableLayout?: "auto" | "fixed";
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  data,
  columns,
  visibleColumns,
  keyExtractor,
  rowClassName,
  maxHeight = "calc(100vh - 280px)",
  batchSize = 25,
  emptyMessage = "No hay datos disponibles.",
  loading = false,
  totalFilteredCount,
  totalCount,
  isFiltered = false,
  tableLayout = "auto",
  onRowClick
}: DataTableProps<T>) {
  const [renderedCount, setRenderedCount] = useState(batchSize);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Compute which columns to actually display
  const activeColumns = visibleColumns
    ? columns.filter((c) => visibleColumns.includes(c.id))
    : columns;

  // Infinite Scroll logic
  useEffect(() => {
    setRenderedCount(batchSize);
  }, [data, batchSize]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setRenderedCount((prev) => Math.min(prev + batchSize, data.length));
        }
      },
      { threshold: 0.1, rootMargin: "80px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [data.length, batchSize]);

  const displayedRows = data.slice(0, renderedCount);
  const hasMore = renderedCount < data.length;

  const actualTotalCount = totalCount ?? data.length;
  const actualFilteredCount = totalFilteredCount ?? data.length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm flex-1 min-h-0 flex flex-col relative">
      <div
        className="overflow-y-auto overflow-x-auto flex-1"
        style={{ maxHeight }}
      >
        <table className={`min-w-full border-collapse text-sm w-full ${tableLayout === "fixed" ? "table-fixed" : "table-auto"}`}>
          <thead className="sticky top-0 z-20 bg-card/95 backdrop-blur-md border-b border-border/50">
            <tr>
              {activeColumns.map((col) => (
                <SortableTableHead
                  key={col.id}
                  column={col.sortKey || col.id}
                  label={col.label}
                  icon={col.headerIcon}
                  className={col.rightAligned ? "text-right" : undefined}
                  style={{ minWidth: col.minWidth, width: col.width }}
                />
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {loading ? (
              <tr>
                <td colSpan={activeColumns.length || 1} className="h-32 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={activeColumns.length || 1} className="h-24 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              displayedRows.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-border/30 transition-colors hover:bg-muted/50 ${
                    onRowClick ? "cursor-pointer" : ""
                  } ${rowClassName ? rowClassName(row) : ""}`}
                >
                  {activeColumns.map((col) => col.render(row))}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Infinite scroll sentinel */}
        {!loading && hasMore && (
          <>
            <div ref={sentinelRef} className="h-px w-full" />
            <div className="flex justify-center py-3">
              <div className="flex gap-1.5 items-center text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Counter Footer ────────────────────────────────────── */}
      <div className="w-full flex justify-end p-2 border-t border-border/50 bg-muted/10">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{displayedRows.length}</span>{" "}
          de <span className="font-medium text-foreground">{actualFilteredCount}</span>{" "}
          registros {isFiltered ? "(filtrados)" : ""}
        </div>
      </div>
    </div>
  );
}
