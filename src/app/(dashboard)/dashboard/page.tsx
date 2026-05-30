"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wrench, DollarSign, Bell, Car, Plus, Clock } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { format } from "date-fns";

interface Stats {
  jobsToday: number;
  jobsThisMonth: number;
  revenueThisMonth: number;
  upcoming30Days: number;
  activeVehicles: number;
}

interface Job {
  id: string;
  jobNumber: string;
  jobDate: string;
  status: string;
  description: string | null;
  totalCostGhs: string | null;
}

interface ScheduleItem {
  schedule: {
    id: string;
    partName: string;
    dueDateEstimate: string | null;
    dueKmEstimate: number | null;
  };
  vehiclePlate: string | null;
  vehicleMake: string | null;
  customerName: string | null;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [upcoming, setUpcoming] = useState<ScheduleItem[]>([]);

  useEffect(() => {
    const fetchJson = async <T,>(url: string): Promise<T | null> => {
      const res = await fetch(url);
      if (!res.ok) return null;
      return res.json() as Promise<T>;
    };

    Promise.all([
      fetchJson<Stats>("/api/dashboard/stats"),
      fetchJson<{ jobs?: Job[] }>("/api/jobs?page=1"),
      fetchJson<{ schedule?: ScheduleItem[] }>("/api/schedule?days=7"),
    ])
      .then(([s, j, sc]) => {
        setStats(s ?? null);
        setRecentJobs(j?.jobs?.slice(0, 5) ?? []);
        setUpcoming(sc?.schedule?.slice(0, 5) ?? []);
      })
      .catch(() => {
        setStats(null);
        setRecentJobs([]);
        setUpcoming([]);
      });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
        </div>
        <Link
          href="/repairs/new"
          className="flex items-center gap-2 h-12 px-5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          New Repair
        </Link>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Jobs Today"      value={stats.jobsToday}      icon={Wrench}     color="blue" />
          <StatCard label="Jobs This Month" value={stats.jobsThisMonth}  icon={Clock}      color="blue" trend="month to date" />
          <StatCard label="Revenue (GHS)"   value={`₵${stats.revenueThisMonth.toFixed(0)}`} icon={DollarSign} color="green" trend="completed jobs" />
          <StatCard label="Due in 30 Days"  value={stats.upcoming30Days} icon={Bell}       color="amber" trend="maintenance alerts" />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Jobs */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Recent Jobs</h2>
            <Link href="/repairs" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          {recentJobs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No jobs yet.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {recentJobs.map((job) => (
                <li key={job.id}>
                  <Link href={`/repairs/${job.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{job.jobNumber}</p>
                      <p className="text-xs text-slate-500 truncate">{job.description ?? "—"}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <StatusBadge status={job.status} />
                      <p className="text-xs text-slate-400 mt-1">{job.jobDate}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Upcoming Maintenance */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Upcoming Service</h2>
            <Link href="/schedule" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Nothing due this week.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {upcoming.map((item) => (
                <li key={item.schedule.id} className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Bell className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{item.schedule.partName}</p>
                      <p className="text-xs text-slate-500">
                        {[item.vehicleMake, item.vehiclePlate].filter(Boolean).join(" ")} · {item.customerName ?? "—"}
                      </p>
                    </div>
                    <p className="text-xs text-amber-600 flex-shrink-0 font-medium">
                      {item.schedule.dueDateEstimate ?? `${item.schedule.dueKmEstimate?.toLocaleString()} km`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
