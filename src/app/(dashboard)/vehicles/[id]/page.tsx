"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Car, Wrench, User, Image, Plus } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { format } from "date-fns";

interface VehicleData {
  vehicle: {
    id: string; vehicleNumber: string; plateNumber: string | null; vin: string | null;
    make: string | null; model: string | null; year: number | null;
    engineSize: string | null; fuelType: string | null; color: string | null;
    currentMileageKm: number | null; notes: string | null;
  };
  history: Array<{
    id: string; jobNumber: string; jobDate: string; status: string;
    description: string | null; totalCostGhs: string | null; mileageAtJob: number | null;
    shopName: string | null; customerName: string | null;
    photos: Array<{ id: string; url: string | null; photoType: string }>;
    parts: Array<{ id: string; partName: string; quantity: number; unitCostGhs: string | null }>;
  }>;
}

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<VehicleData | null>(null);

  useEffect(() => {
    fetch(`/api/vehicles/${id}`).then((r) => r.json()).then(setData);
  }, [id]);

  if (!data) return <div className="p-6 text-slate-400 text-sm">Loading...</div>;

  const { vehicle, history } = data;

  return (
    <div className="space-y-6 max-w-2xl">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Vehicle header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Car className="w-8 h-8 text-blue-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{vehicle.plateNumber ?? vehicle.vehicleNumber}</h1>
            <p className="text-slate-500">{[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ") || "No details"}</p>
          </div>
          <Link href={`/repairs/new?vehicleId=${id}`}
            className="flex items-center gap-1.5 h-10 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex-shrink-0">
            <Plus className="w-4 h-4" /> Add Repair
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {[
            ["Engine", vehicle.engineSize],
            ["Fuel", vehicle.fuelType],
            ["Color", vehicle.color],
            ["Mileage", vehicle.currentMileageKm ? `${vehicle.currentMileageKm.toLocaleString()} km` : null],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div key={label} className="bg-slate-50 rounded-lg p-2.5">
              <p className="text-xs text-slate-400">{label}</p>
              <p className="font-medium text-slate-800">{value}</p>
            </div>
          ))}
        </div>

        {vehicle.vin && (
          <p className="mt-3 text-xs text-slate-400 font-mono">VIN: {vehicle.vin}</p>
        )}
      </div>

      {/* Repair history timeline */}
      <div>
        <h2 className="font-semibold text-slate-900 mb-3">Service History ({history.length} records)</h2>
        {history.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400">
            <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No repair records yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((job) => (
              <Link key={job.id} href={`/repairs/${job.id}`}
                className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 text-center">
                    <p className="text-xs font-bold text-slate-800">{format(new Date(job.jobDate), "d MMM")}</p>
                    <p className="text-xs text-slate-400">{format(new Date(job.jobDate), "yyyy")}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-slate-900">{job.jobNumber}</p>
                      <StatusBadge status={job.status} />
                    </div>
                    {job.shopName && (
                      <p className="text-xs text-blue-600 mb-1 flex items-center gap-1">
                        <Wrench className="w-3 h-3" /> {job.shopName}
                      </p>
                    )}
                    {job.description && <p className="text-sm text-slate-600 line-clamp-2">{job.description}</p>}
                    {job.parts.length > 0 && (
                      <p className="text-xs text-slate-400 mt-1">{job.parts.map((p) => p.partName).join(", ")}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      {job.mileageAtJob && <span className="text-xs text-slate-400">{job.mileageAtJob.toLocaleString()} km</span>}
                      {job.totalCostGhs && <span className="text-xs font-medium text-green-700">₵{job.totalCostGhs}</span>}
                      {job.photos.length > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-slate-400">
                          <Image className="w-3 h-3" /> {job.photos.length}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Photo thumbnails */}
                {job.photos.filter((p) => p.photoType !== "receipt").length > 0 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto">
                    {job.photos.filter((p) => p.photoType !== "receipt").slice(0, 5).map((p) => (
                      p.url && <img key={p.id} src={p.url} alt="" className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
