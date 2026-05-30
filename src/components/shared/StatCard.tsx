import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: "blue" | "green" | "amber" | "red";
  trend?: string;
}

const colorMap = {
  blue:  { border: "border-blue-500",  bg: "bg-blue-50",  icon: "text-blue-600",  value: "text-blue-700" },
  green: { border: "border-green-500", bg: "bg-green-50", icon: "text-green-600", value: "text-green-700" },
  amber: { border: "border-amber-500", bg: "bg-amber-50", icon: "text-amber-600", value: "text-amber-700" },
  red:   { border: "border-red-500",   bg: "bg-red-50",   icon: "text-red-600",   value: "text-red-700"  },
};

export function StatCard({ label, value, icon: Icon, color = "blue", trend }: Props) {
  const c = colorMap[color];
  return (
    <div className={cn("bg-white rounded-xl border-l-4 shadow-sm p-5 flex items-center gap-4", c.border)}>
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", c.bg)}>
        <Icon className={cn("w-6 h-6", c.icon)} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-slate-500 truncate">{label}</p>
        <p className={cn("text-3xl font-bold", c.value)}>{value}</p>
        {trend && <p className="text-xs text-slate-400 mt-0.5">{trend}</p>}
      </div>
    </div>
  );
}
