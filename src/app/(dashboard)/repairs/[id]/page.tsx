"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Mic, Image, Package } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { format } from "date-fns";

interface JobDetail {
  job: {
    id: string; jobNumber: string; status: string; jobDate: string;
    description: string | null; mileageAtJob: number | null;
    laborCostGhs: string | null; partsCostGhs: string | null; totalCostGhs: string | null;
    voiceNoteKey: string | null;
  };
  photos: Array<{ id: string; url: string | null; photoType: string; fileName: string | null }>;
  parts: Array<{ id: string; partName: string; quantity: number; unitCostGhs: string | null }>;
}

const STATUS_OPTIONS = ["PENDING", "IN_PROGRESS", "DONE", "CANCELLED"] as const;

export default function RepairDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<JobDetail | null>(null);
  const [editStatus, setEditStatus] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => fetch(`/api/jobs/${id}`).then((r) => r.json()).then(setData);

  useEffect(() => { load(); }, [id]);

  const updateStatus = async (status: string) => {
    setSaving(true);
    await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setSaving(false);
    setEditStatus(false);
    load();
  };

  if (!data) return <div className="p-6 text-slate-400 text-sm">Loading...</div>;
  const { job, photos, parts } = data;
  const beforePhotos = photos.filter((p) => p.photoType === "before");
  const afterPhotos = photos.filter((p) => p.photoType === "after");
  const receipts = photos.filter((p) => p.photoType === "receipt");

  return (
    <div className="space-y-6 max-w-2xl">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 font-mono">{job.jobNumber}</h1>
            <p className="text-sm text-slate-500">{format(new Date(job.jobDate), "d MMMM yyyy")}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={job.status} />
            <button onClick={() => setEditStatus(true)} className="text-xs text-blue-600 hover:underline">Change</button>
          </div>
        </div>

        {editStatus && (
          <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl">
            {STATUS_OPTIONS.map((s) => (
              <button key={s} disabled={saving} onClick={() => updateStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${job.status === s ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"}`}>
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {job.mileageAtJob && <div className="bg-slate-50 rounded-lg p-2.5"><p className="text-xs text-slate-400">Mileage</p><p className="font-medium">{job.mileageAtJob.toLocaleString()} km</p></div>}
          {job.laborCostGhs && <div className="bg-slate-50 rounded-lg p-2.5"><p className="text-xs text-slate-400">Labour</p><p className="font-medium">₵{job.laborCostGhs}</p></div>}
          {job.totalCostGhs && <div className="bg-green-50 rounded-lg p-2.5"><p className="text-xs text-slate-400">Total</p><p className="font-bold text-green-700">₵{job.totalCostGhs}</p></div>}
        </div>

        {job.description && (
          <div>
            <p className="text-xs text-slate-400 mb-1">Work Done</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{job.description}</p>
          </div>
        )}

        {job.voiceNoteKey && (
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
            <Mic className="w-4 h-4 text-slate-400" /> Voice note attached
          </div>
        )}
      </div>

      {parts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
            <Package className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Parts Used</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {parts.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{p.partName}</p>
                  <p className="text-slate-400 text-xs">Qty: {p.quantity}</p>
                </div>
                {p.unitCostGhs && <span className="text-slate-700">₵{(parseFloat(p.unitCostGhs) * p.quantity).toFixed(2)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {beforePhotos.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-1.5"><Image className="w-4 h-4" /> Before</p>
          <div className="grid grid-cols-3 gap-2">
            {beforePhotos.map((p) => p.url && <img key={p.id} src={p.url} alt="before" className="aspect-square object-cover rounded-xl" />)}
          </div>
        </div>
      )}

      {afterPhotos.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-1.5"><Image className="w-4 h-4" /> After</p>
          <div className="grid grid-cols-3 gap-2">
            {afterPhotos.map((p) => p.url && <img key={p.id} src={p.url} alt="after" className="aspect-square object-cover rounded-xl" />)}
          </div>
        </div>
      )}

      {receipts.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-600 mb-2">Receipts</p>
          <div className="grid grid-cols-3 gap-2">
            {receipts.map((p) => p.url && <img key={p.id} src={p.url} alt="receipt" className="aspect-square object-cover rounded-xl" />)}
          </div>
        </div>
      )}
    </div>
  );
}
