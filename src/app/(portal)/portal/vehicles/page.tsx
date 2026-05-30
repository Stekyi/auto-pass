"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Car, LogOut } from "lucide-react";
import { format } from "date-fns";

interface Vehicle {
  id: string; vehicleNumber: string; plateNumber: string | null;
  make: string | null; model: string | null; year: number | null;
  lastJobDate: string | null; jobCount: number;
}

export default function PortalVehiclesPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tel, setTel] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/vehicles")
      .then((r) => { if (r.status === 401) { router.push("/portal/login"); return null; } return r.json(); })
      .then((d) => { if (d) { setVehicles(d.vehicles ?? []); setTel(d.tel ?? ""); } setLoading(false); });
  }, [router]);

  const signOut = async () => {
    await fetch("/api/portal/auth/sign-out", { method: "POST" }).catch(() => {});
    document.cookie = "portal_token=; Max-Age=0; path=/";
    router.push("/portal/login");
  };

  if (loading) return <div className="text-center py-16 text-slate-400 text-sm">Loading your vehicles...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your Cars</h1>
          <p className="text-sm text-slate-500">{tel}</p>
        </div>
        <button onClick={signOut} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>

      {vehicles.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Car className="w-14 h-14 mx-auto mb-4 opacity-30" />
          <p className="font-medium text-slate-700">No vehicles found</p>
          <p className="text-sm mt-1">Ask your mechanic to register your vehicle on AutoPass.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <Link key={v.id} href={`/portal/vehicles/${v.id}`}
              className="flex items-center gap-4 bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-300 hover:shadow-sm transition-all">
              <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Car className="w-7 h-7 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold text-slate-900">{v.plateNumber ?? v.vehicleNumber}</p>
                <p className="text-sm text-slate-600">{[v.make, v.model, v.year].filter(Boolean).join(" ") || "Details not added"}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {v.jobCount} service record{v.jobCount !== 1 ? "s" : ""}
                  {v.lastJobDate ? ` · Last: ${format(new Date(v.lastJobDate), "d MMM yyyy")}` : ""}
                </p>
              </div>
              <div className="text-blue-500 text-lg">›</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
