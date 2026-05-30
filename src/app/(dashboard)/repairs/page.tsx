"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Wrench } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { format } from "date-fns";

interface Job {
  id: string; jobNumber: string; status: string;
  jobDate: string; description: string | null; totalCostGhs: string | null;
}

const STATUS_OPTIONS = ["", "PENDING", "IN_PROGRESS", "DONE", "CANCELLED"];

export default function RepairsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async (status: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    const res = await fetch(`/api/jobs?${params}`);
    const data = await res.json();
    setJobs(data.jobs ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(""); }, [load]);

  const columns: Column<Job>[] = [
    { key: "jobNumber", header: "Job #", render: (r) => <span className="font-mono text-sm font-medium">{r.jobNumber}</span> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "date", header: "Date", render: (r) => format(new Date(r.jobDate), "d MMM yyyy"), mobileHidden: true },
    { key: "desc", header: "Description", render: (r) => <span className="text-slate-500 text-sm truncate max-w-xs block">{r.description ?? "—"}</span>, mobileHidden: true },
    { key: "cost", header: "Total (₵)", render: (r) => r.totalCostGhs ? `₵${r.totalCostGhs}` : "—", mobileHidden: true },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Repairs"
        subtitle="All job records for your workshop"
        action={
          <Link href="/repairs/new" className="flex items-center gap-2 h-12 px-5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm">
            <Plus className="w-4 h-4" /> New Repair
          </Link>
        }
      />

      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_OPTIONS.map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); load(s); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      {jobs.length === 0 && !loading ? (
        <div className="text-center py-16 text-slate-400">
          <Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No repair jobs yet.</p>
          <Link href="/repairs/new" className="inline-block mt-3 text-blue-600 text-sm hover:underline">Log your first repair →</Link>
        </div>
      ) : (
        <DataTable columns={columns} rows={jobs} onRowClick={(r) => router.push(`/repairs/${r.id}`)} emptyMessage="No jobs found." />
      )}
    </div>
  );
}
