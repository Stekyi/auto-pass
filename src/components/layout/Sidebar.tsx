"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Car, Wrench, Calendar, Settings, LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";

const NAV = [
  { href: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { href: "/customers",  label: "Customers",  icon: Users },
  { href: "/vehicles",   label: "Vehicles",   icon: Car },
  { href: "/repairs",    label: "Repairs",    icon: Wrench },
  { href: "/schedule",   label: "Schedule",   icon: Calendar },
  { href: "/admin",      label: "Admin",      icon: Settings },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-56 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
      <div className="px-5 py-5 border-b border-slate-100">
        <span className="text-lg font-bold text-blue-600 tracking-tight">AutoPass</span>
        <p className="text-xs text-slate-400 mt-0.5">Service History</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-slate-100">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
