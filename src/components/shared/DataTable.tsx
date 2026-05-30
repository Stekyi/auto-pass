import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  mobileHidden?: boolean;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  keyField?: keyof T;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  onRowClick,
  emptyMessage = "No records found.",
  keyField = "id" as keyof T,
}: Props<T>) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap",
                  col.mobileHidden && "hidden sm:table-cell",
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={String(row[keyField] ?? i)}
              onClick={() => onRowClick?.(row)}
              className={cn(
                "border-b border-slate-50 last:border-0",
                onRowClick && "cursor-pointer hover:bg-slate-50 transition-colors"
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-slate-700",
                    col.mobileHidden && "hidden sm:table-cell",
                    col.className
                  )}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
