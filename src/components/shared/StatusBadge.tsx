import { cn } from "@/lib/utils/cn";

type Status = "PENDING" | "IN_PROGRESS" | "DONE" | "CANCELLED";

const map: Record<Status, { label: string; className: string }> = {
  PENDING:     { label: "Pending",     className: "bg-slate-100 text-slate-700" },
  IN_PROGRESS: { label: "In Progress", className: "bg-blue-100 text-blue-700" },
  DONE:        { label: "Done",        className: "bg-green-100 text-green-700" },
  CANCELLED:   { label: "Cancelled",   className: "bg-red-100 text-red-700" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = map[status as Status] ?? { label: status, className: "bg-slate-100 text-slate-600" };
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", s.className)}>
      {s.label}
    </span>
  );
}
