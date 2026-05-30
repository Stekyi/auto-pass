"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Car, Wrench, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const items = [
  { href: "/dashboard", label: "Home",     icon: LayoutDashboard },
  { href: "/vehicles",  label: "Vehicles", icon: Car },
  { href: "/repairs",  label: "Repairs",  icon: Wrench },
  { href: "/reports",  label: "Reports",  icon: BarChart3 },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex z-40 safe-area-pb">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors",
              active ? "text-blue-600" : "text-slate-500"
            )}
          >
            <Icon className={cn("w-6 h-6", active && "fill-blue-100")} strokeWidth={active ? 2.5 : 1.5} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
