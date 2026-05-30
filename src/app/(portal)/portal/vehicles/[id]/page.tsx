"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Wrench, Package, Image, Download } from "lucide-react";
import { format } from "date-fns";
import { ChatWidget } from "@/components/portal/ChatWidget";

interface HistoryData {
  vehicle: {
    id: string; plateNumber: string | null; vehicleNumber: string;
    make: string | null; model: string | null; year: number | null;
    engineSize: string | null; fuelType: string | null; vin: string | null;
  };
  history: Array<{
    id: string; jobDate: string; description: string | null;
    mileageAtJob: number | null; totalCostGhs: string | null;
    shopName: string | null; shopTel: string | null; status: string;
    photos: Array<{ id: string; url: string | null; photoType: string }>;
    parts: Array<{ id: string; partName: string; quantity: number; unitCostGhs: string | null }>;
  }>;
}

export default function PortalVehicleHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch(`/api/portal/vehicles/${id}/history`)
      .then((r) => { if (r.status === 401) { router.push("/portal/login"); return null; } return r.json(); })
      .then((d) => { if (d) setData(d); setLoading(false); });
  }, [id, router]);

  const downloadPassport = async () => {
    setDownloading(true);
    const res = await fetch(`/api/portal/vehicles/${id}/passport`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vehicle-passport-${data?.vehicle.plateNumber ?? id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setDownloading(false);
  };

  if (loading) return <div className="text-center py-16 text-slate-400 text-sm">Loading history...</div>;
  if (!data) return <div className="text-center py-16 text-slate-400 text-sm">Vehicle not found.</div>;

  const { vehicle, history } = data;

  const vehicleName = [vehicle.make, vehicle.model, vehicle.plateNumber]
    .filter(Boolean).join(" ") || vehicle.vehicleNumber;

  return (
    <div className="space-y-5">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-4 h-4" /> Your Cars
      </button>

      {/* Vehicle header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h1 className="text-2xl font-bold text-slate-900">{vehicle.plateNumber ?? vehicle.vehicleNumber}</h1>
        <p className="text-slate-600">{[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ") || "No details"}</p>
        {vehicle.vin && <p className="text-xs text-slate-400 font-mono mt-1">VIN: {vehicle.vin}</p>}
        <div className="flex gap-2 mt-2 text-xs text-slate-500">
          {vehicle.engineSize && <span>Engine: {vehicle.engineSize}</span>}
          {vehicle.fuelType && <span>· {vehicle.fuelType}</span>}
        </div>
        <p className="mt-2 text-sm font-medium text-blue-700">{history.length} service records</p>
      </div>

      {/* History timeline */}
      {history.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No service records yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((job) => {
            const jobPhotos = job.photos.filter((p) => p.photoType !== "receipt");
            return (
              <div key={job.id} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                {/* Date + shop */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-slate-900 text-lg">{format(new Date(job.jobDate), "d MMM yyyy")}</p>
                    {job.shopName && <p className="text-sm text-blue-600 font-medium">{job.shopName}</p>}
                    {job.shopTel && <p className="text-xs text-slate-400">{job.shopTel}</p>}
                  </div>
                  {job.totalCostGhs && (
                    <div className="text-right">
                      <p className="font-bold text-green-700 text-lg">₵{job.totalCostGhs}</p>
                      {job.mileageAtJob && <p className="text-xs text-slate-400">{job.mileageAtJob.toLocaleString()} km</p>}
                    </div>
                  )}
                </div>

                {/* What was done */}
                {job.description && (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Wrench className="w-3 h-3" /> What was done</p>
                    <p className="text-sm text-slate-700">{job.description}</p>
                  </div>
                )}

                {/* Parts */}
                {job.parts.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 mb-2 flex items-center gap-1"><Package className="w-3 h-3" /> Parts replaced</p>
                    <div className="flex flex-wrap gap-2">
                      {job.parts.map((p) => (
                        <span key={p.id} className="px-3 py-1 bg-blue-50 text-blue-800 text-xs rounded-full font-medium">
                          {p.partName} × {p.quantity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Photos inline */}
                {jobPhotos.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 mb-2 flex items-center gap-1"><Image className="w-3 h-3" /> Photos</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {jobPhotos.map((p) => p.url && (
                        <img key={p.id} src={p.url} alt={p.photoType} className="w-20 h-20 object-cover rounded-xl flex-shrink-0" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Download Passport — fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 flex gap-2">
        <button
          onClick={downloadPassport}
          disabled={downloading}
          className="flex-1 h-14 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm"
        >
          <Download className="w-5 h-5" />
          {downloading ? "Generating..." : "Download Passport"}
        </button>
      </div>

      {/* Floating chat assistant */}
      <ChatWidget vehicleId={vehicle.id} vehicleName={vehicleName} />
    </div>
  );
}
