"use client";

import { useEffect, useState } from "react";
import { SessionProvider } from "next-auth/react";
import { TopBar } from "@/components/layout/TopBar";
import { BottomNav } from "@/components/shared/BottomNav";
import { LocationSetupBanner } from "@/components/shared/LocationSetup";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

function SubscriptionBanner() {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/dashboard/subscription").then((r) => r.json()).then((d) => setDaysLeft(d.daysLeft));
  }, []);
  if (daysLeft === null || daysLeft > 30) return null;
  const isExpired = daysLeft <= 0;
  return (
    <div className={`flex items-center gap-3 px-4 py-2 text-sm ${isExpired ? "bg-red-600 text-white" : "bg-amber-500 text-white"}`}>
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>
        {isExpired
          ? "Your subscription has expired. You cannot log new repairs."
          : `Your subscription expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}.`}
      </span>
      <Link href="/admin" className="ml-auto text-xs underline font-medium flex-shrink-0">Renew →</Link>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
        <TopBar />
        <SubscriptionBanner />
        <LocationSetupBanner />
        {/* pb-16 on mobile gives room for the fixed BottomNav */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-16 md:pb-6">{children}</main>
      </div>
      <BottomNav />
    </SessionProvider>
  );
}
