"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, MapPin, Car, Plus } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { format } from "date-fns";

interface Customer {
  id: string; fullName: string; tel: string; email: string | null;
  location: string | null; customerNumber: string | null; createdAt: string;
}
interface Vehicle {
  id: string; vehicleNumber: string; plateNumber: string | null;
  make: string | null; model: string | null; year: number | null;
}
interface Job {
  id: string; jobNumber: string; status: string; jobDate: string; description: string | null;
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [jobCount, setJobCount] = useState(0);

  useEffect(() => {
    fetch(`/api/customers/${id}`)
      .then((r) => r.json())
      .then((d) => { setCustomer(d.customer); setVehicles(d.vehicles ?? []); setJobCount(d.jobCount ?? 0); });
  }, [id]);

  if (!customer) return <div className="p-6 text-slate-400 text-sm">Loading...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-blue-600 font-bold text-xl">{customer.fullName[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900">{customer.fullName}</h1>
            {customer.customerNumber && <p className="text-xs text-slate-400">{customer.customerNumber}</p>}
          </div>
          <span className="text-xs text-slate-400">Since {format(new Date(customer.createdAt), "MMM yyyy")}</span>
        </div>

        <div className="mt-5 space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Phone className="w-4 h-4 text-slate-400" /> {customer.tel}
          </div>
          {customer.email && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Mail className="w-4 h-4 text-slate-400" /> {customer.email}
            </div>
          )}
          {customer.location && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <MapPin className="w-4 h-4 text-slate-400" /> {customer.location}
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-3 text-center">
          <div className="flex-1 bg-slate-50 rounded-lg p-3">
            <p className="text-2xl font-bold text-slate-900">{vehicles.length}</p>
            <p className="text-xs text-slate-500">Vehicles</p>
          </div>
          <div className="flex-1 bg-slate-50 rounded-lg p-3">
            <p className="text-2xl font-bold text-slate-900">{jobCount}</p>
            <p className="text-xs text-slate-500">Total Jobs</p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900">Vehicles</h2>
          <Link href={`/vehicles?customerId=${id}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
            <Plus className="w-3.5 h-3.5" /> Register
          </Link>
        </div>
        {vehicles.length === 0 ? (
          <p className="text-sm text-slate-400 bg-white border border-slate-200 rounded-xl p-4 text-center">No vehicles registered yet.</p>
        ) : (
          <div className="space-y-2">
            {vehicles.map((v) => (
              <Link key={v.id} href={`/vehicles/${v.id}`} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 transition-colors">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Car className="w-5 h-5 text-slate-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{v.plateNumber ?? v.vehicleNumber}</p>
                  <p className="text-xs text-slate-500">{[v.make, v.model, v.year].filter(Boolean).join(" ") || "No details"}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
