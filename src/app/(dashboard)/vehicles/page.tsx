"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Car, Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchBar } from "@/components/shared/SearchBar";
import { Modal } from "@/components/shared/Modal";

interface Vehicle {
  id: string; vehicleNumber: string; plateNumber: string | null;
  make: string | null; model: string | null; year: number | null;
  vin: string | null; currentMileageKm: number | null; createdAt: string;
}

function VehicleForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ plateNumber: "", vin: "", make: "", model: "", year: "", engineSize: "", fuelType: "", color: "", currentMileageKm: "", notes: "" });
  const [vinLoading, setVinLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const decodeVin = async () => {
    if (form.vin.length !== 17) return;
    setVinLoading(true);
    const res = await fetch(`/api/vehicles/vin/${form.vin}`);
    const data = await res.json();
    setVinLoading(false);
    if (!data.error) {
      setForm((f) => ({
        ...f,
        make: data.make ?? f.make,
        model: data.model ?? f.model,
        year: data.year ?? f.year,
        engineSize: data.engineSize ?? f.engineSize,
        fuelType: data.fuelType ?? f.fuelType,
      }));
    }
  };

  const submit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      year: form.year ? parseInt(form.year) : undefined,
      currentMileageKm: form.currentMileageKm ? parseInt(form.currentMileageKm) : undefined,
    };
    const res = await fetch("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error?.message ?? "Failed to save."); return; }
    onSuccess();
    onClose();
  };

  const tf = (label: string, key: keyof typeof form, type = "text") => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input type={type} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full h-11 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">VIN (17 chars — auto-fills details)</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={form.vin}
            onChange={(e) => setForm((f) => ({ ...f, vin: e.target.value.toUpperCase() }))}
            maxLength={17}
            placeholder="1HGBH41JXMN109186"
            className="flex-1 h-11 px-3 border border-slate-300 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="button" onClick={decodeVin} disabled={form.vin.length !== 17 || vinLoading}
            className="h-11 px-3 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm disabled:opacity-50 flex items-center gap-1.5">
            {vinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Look up
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {tf("Plate Number *", "plateNumber")}
        {tf("Color", "color")}
        {tf("Make (e.g. Toyota)", "make")}
        {tf("Model (e.g. Corolla)", "model")}
        {tf("Year", "year", "number")}
        {tf("Engine Size", "engineSize")}
        {tf("Fuel Type", "fuelType")}
        {tf("Current Mileage (km)", "currentMileageKm", "number")}
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={saving} className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl text-sm">
          {saving ? "Registering..." : "Register Vehicle"}
        </button>
        <button type="button" onClick={onClose} className="flex-1 h-12 border border-slate-300 rounded-xl text-sm hover:bg-slate-50">Cancel</button>
      </div>
    </form>
  );
}

export default function VehiclesPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async (q: string) => {
    setLoading(true);
    const res = await fetch(`/api/vehicles?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setVehicles(data.vehicles ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(""); }, [load]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vehicles"
        subtitle="Search all vehicles across all workshops"
        action={
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 h-12 px-5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm">
            <Plus className="w-4 h-4" /> Register
          </button>
        }
      />

      <SearchBar placeholder="Search by plate, VIN, or make..." onSearch={(q) => { setQuery(q); load(q); }} loading={loading} />

      {vehicles.length === 0 && !loading ? (
        <div className="text-center py-16 text-slate-400">
          <Car className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{query ? "No vehicles match your search." : "No vehicles registered yet."}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => (
            <button key={v.id} onClick={() => router.push(`/vehicles/${v.id}`)}
              className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Car className="w-5 h-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-lg leading-tight">{v.plateNumber ?? v.vehicleNumber}</p>
                  <p className="text-xs text-slate-500">{v.vehicleNumber}</p>
                </div>
              </div>
              <p className="text-sm text-slate-700 font-medium">{[v.make, v.model].filter(Boolean).join(" ") || "Unknown"}</p>
              <p className="text-xs text-slate-400">{v.year ?? "—"} {v.currentMileageKm ? `· ${v.currentMileageKm.toLocaleString()} km` : ""}</p>
            </button>
          ))}
        </div>
      )}

      {showAdd && (
        <Modal title="Register Vehicle" onClose={() => setShowAdd(false)} maxWidth="lg">
          <VehicleForm onSuccess={() => load(query)} onClose={() => setShowAdd(false)} />
        </Modal>
      )}
    </div>
  );
}
