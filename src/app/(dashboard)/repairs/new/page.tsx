"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import { AutocompleteSelect } from "@/components/shared/AutocompleteSelect";
import { PhotoUpload } from "@/components/shared/PhotoUpload";
import { VoiceRecorder } from "@/components/shared/VoiceRecorder";
import { format } from "date-fns";

const STEPS = ["Vehicle", "Customer", "Details", "Photos", "Voice", "Parts", "Review"];

interface VehicleOption { id: string; label: string; plateNumber: string | null; make: string | null; model: string | null; customerId: string | null; }
interface CustomerOption { id: string; label: string; tel: string; }
interface VehicleResult extends VehicleOption { name: string; }
interface CustomerResult extends CustomerOption { name: string; }
interface Part { partName: string; partNumber: string; quantity: number; unitCostGhs: string; }

const emptyPart = (): Part => ({ partName: "", partNumber: "", quantity: 1, unitCostGhs: "" });

function NewRepairContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedVehicleId = searchParams.get("vehicleId");

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);

  // Cache of search results for full-object lookups
  const vehicleCache = useRef<Map<string, VehicleResult>>(new Map());
  const customerCache = useRef<Map<string, CustomerResult>>(new Map());

  // Step 1 — Vehicle
  const [vehicle, setVehicle] = useState<VehicleOption | null>(null);

  // Step 2 — Customer
  const [customer, setCustomer] = useState<CustomerOption | null>(null);

  // Step 3 — Details
  const [jobDate, setJobDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [mileage, setMileage] = useState("");
  const [description, setDescription] = useState("");
  const [laborCost, setLaborCost] = useState("");
  const [partsCost, setPartsCost] = useState("");

  // Step 4 — Photos (handled by PhotoUpload; need jobId first — create job on save)
  // Step 5 — Voice (same)

  // Step 6 — Parts
  const [parts, setParts] = useState<Part[]>([emptyPart()]);

  // Preload vehicle if vehicleId is in URL
  useEffect(() => {
    if (preselectedVehicleId) {
      fetch(`/api/vehicles/${preselectedVehicleId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.vehicle) {
            setVehicle({
              id: d.vehicle.id,
              label: [d.vehicle.plateNumber, d.vehicle.make, d.vehicle.model].filter(Boolean).join(" "),
              plateNumber: d.vehicle.plateNumber,
              make: d.vehicle.make,
              model: d.vehicle.model,
              customerId: d.vehicle.customerId,
            });
          }
        });
    }
  }, [preselectedVehicleId]);

  // Auto-fill customer from vehicle
  useEffect(() => {
    if (vehicle?.customerId && !customer) {
      fetch(`/api/customers/${vehicle.customerId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.customer) {
            setCustomer({ id: d.customer.id, label: d.customer.fullName, tel: d.customer.tel });
          }
        });
    }
  }, [vehicle, customer]);

  const searchVehicles = useCallback(async (q: string) => {
    const res = await fetch(`/api/vehicles/search?q=${encodeURIComponent(q)}`);
    const d = await res.json();
    const results: VehicleResult[] = (d.vehicles ?? []).map((v: VehicleOption) => ({
      ...v,
      name: [v.plateNumber, v.make, v.model].filter(Boolean).join(" ") || v.id,
      label: [v.plateNumber, v.make, v.model].filter(Boolean).join(" ") || v.id,
    }));
    results.forEach((r) => vehicleCache.current.set(r.id, r));
    return results;
  }, []);

  const searchCustomers = useCallback(async (q: string) => {
    const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
    const d = await res.json();
    const results: CustomerResult[] = (d.customers ?? []).map((c: { id: string; fullName: string; tel: string }) => ({
      id: c.id,
      name: c.fullName,
      label: c.fullName,
      tel: c.tel,
    }));
    results.forEach((r) => customerCache.current.set(r.id, r));
    return results;
  }, []);

  const totalCost = (() => {
    const l = parseFloat(laborCost) || 0;
    const p = parts.reduce((sum, pt) => sum + (parseFloat(pt.unitCostGhs) || 0) * pt.quantity, 0);
    return l + p;
  })();

  const saveJob = async () => {
    if (!vehicle || !customer) return;
    setSaving(true);
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId: vehicle.id,
        customerId: customer.id,
        jobDate,
        mileageAtJob: mileage ? parseInt(mileage) : undefined,
        description: description || undefined,
        laborCostGhs: laborCost ? parseFloat(laborCost) : undefined,
        partsCostGhs: parts.reduce((s, p) => s + (parseFloat(p.unitCostGhs) || 0) * p.quantity, 0) || undefined,
        totalCostGhs: totalCost || undefined,
        status: "PENDING",
        parts: parts.filter((p) => p.partName.trim()).map((p) => ({
          partName: p.partName,
          partNumber: p.partNumber || undefined,
          quantity: p.quantity,
          unitCostGhs: p.unitCostGhs ? parseFloat(p.unitCostGhs) : undefined,
        })),
      }),
    });
    setSaving(false);
    if (res.ok) {
      const d = await res.json();
      setCreatedJobId(d.job.id);
      setStep(7); // success
    }
  };

  const canNext = [
    !!vehicle,
    !!customer,
    !!jobDate,
    true, // photos optional
    true, // voice optional
    parts.every((p) => p.partName.trim() || parts.length === 1),
    true,
  ];

  const progress = ((step) / (STEPS.length)) * 100;

  if (step === 7 && createdJobId) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <Check className="w-10 h-10 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Job Saved!</h2>
          <p className="text-slate-500 mt-1">The repair record has been created.</p>
        </div>
        <div className="flex flex-col gap-3">
          <button onClick={() => router.push(`/repairs/${createdJobId}`)}
            className="h-14 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl">
            View Job Record
          </button>
          <button onClick={() => { setStep(0); setCreatedJobId(null); setVehicle(null); setCustomer(null); setParts([emptyPart()]); }}
            className="h-14 border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-xl">
            Log Another Repair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => step > 0 ? setStep(step - 1) : router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <p className="text-xs text-slate-500">Step {step + 1} of {STEPS.length}</p>
          <h1 className="text-xl font-bold text-slate-900">{STEPS[step]}</h1>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      {/* Step content */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 min-h-[280px] flex flex-col gap-5">

        {step === 0 && (
          <>
            <p className="text-slate-600">Search by plate number, VIN, or make/model.</p>
            <AutocompleteSelect
              label=""
              placeholder="e.g. GH-1234-23 or Toyota"
              fetchOptions={searchVehicles}
              value={vehicle?.id ?? ""}
              onChange={(id, name) => {
                const cached = vehicleCache.current.get(id);
                setVehicle({ id, label: name, plateNumber: cached?.plateNumber ?? null, make: cached?.make ?? null, model: cached?.model ?? null, customerId: cached?.customerId ?? null });
                setCustomer(null);
              }}
            />
            {vehicle && (
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="font-semibold text-blue-900">{vehicle.plateNumber ?? vehicle.id}</p>
                <p className="text-sm text-blue-700">{[vehicle.make, vehicle.model].filter(Boolean).join(" ")}</p>
              </div>
            )}
            <button onClick={() => router.push("/vehicles")} className="text-sm text-blue-600 hover:underline">
              + Register a new vehicle
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-slate-600">Who brought this vehicle in?</p>
            <AutocompleteSelect
              label=""
              placeholder="Search customer by name or phone"
              fetchOptions={searchCustomers}
              value={customer?.id ?? ""}
              onChange={(id, name) => {
                const cached = customerCache.current.get(id);
                setCustomer({ id, label: name, tel: cached?.tel ?? "" });
              }}
            />
            {customer && (
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="font-semibold text-blue-900">{customer.label}</p>
                <p className="text-sm text-blue-700">{customer.tel}</p>
              </div>
            )}
            <button onClick={() => router.push("/customers")} className="text-sm text-blue-600 hover:underline">
              + Add new customer
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Job Date *</label>
              <input type="date" value={jobDate} onChange={(e) => setJobDate(e.target.value)}
                className="w-full h-14 px-4 border border-slate-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Current Mileage (km)</label>
              <input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)}
                placeholder="e.g. 85000" className="w-full h-14 px-4 border border-slate-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">What was done? (optional — or use voice note)</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                rows={3} placeholder="e.g. Changed engine oil, replaced air filter..."
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Labour (₵)</label>
                <input type="number" value={laborCost} onChange={(e) => setLaborCost(e.target.value)}
                  placeholder="0.00" className="w-full h-12 px-4 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Est. Total (₵)</label>
                <div className="w-full h-12 px-4 border border-slate-200 rounded-xl text-sm flex items-center bg-slate-50 text-slate-700 font-medium">
                  ₵{totalCost.toFixed(2)}
                </div>
              </div>
            </div>
          </>
        )}

        {step === 3 && createdJobId && (
          <PhotoUpload jobId={createdJobId} photoType="before" label="Before Photos" />
        )}
        {step === 3 && !createdJobId && (
          <p className="text-slate-500 text-sm">Photos will be attached after the job is created. Continue to proceed.</p>
        )}

        {step === 4 && createdJobId && (
          <VoiceRecorder jobId={createdJobId} />
        )}
        {step === 4 && !createdJobId && (
          <p className="text-slate-500 text-sm">Voice note will be attached after the job is created. Continue to proceed.</p>
        )}

        {step === 5 && (
          <>
            <p className="text-slate-600 text-sm">List all parts installed. This auto-schedules future maintenance.</p>
            <div className="space-y-3">
              {parts.map((part, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="text" value={part.partName} onChange={(e) => setParts((prev) => prev.map((p, j) => j === i ? { ...p, partName: e.target.value } : p))}
                      placeholder="Part name (e.g. Brake Pads)" className="flex-1 h-11 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    {parts.length > 1 && (
                      <button onClick={() => setParts((prev) => prev.filter((_, j) => j !== i))} className="w-9 h-9 text-red-400 hover:text-red-600 flex items-center justify-center flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" min={1} value={part.quantity} onChange={(e) => setParts((prev) => prev.map((p, j) => j === i ? { ...p, quantity: parseInt(e.target.value) || 1 } : p))}
                      placeholder="Qty" className="h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input type="number" value={part.unitCostGhs} onChange={(e) => setParts((prev) => prev.map((p, j) => j === i ? { ...p, unitCostGhs: e.target.value } : p))}
                      placeholder="Unit cost (₵)" className="h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setParts((prev) => [...prev, emptyPart()])}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
              <Plus className="w-4 h-4" /> Add another part
            </button>
          </>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 text-lg">Review & Save</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Vehicle</span>
                <span className="font-medium">{vehicle?.label}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Customer</span>
                <span className="font-medium">{customer?.label}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Date</span>
                <span className="font-medium">{format(new Date(jobDate), "d MMM yyyy")}</span>
              </div>
              {mileage && (
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Mileage</span>
                  <span className="font-medium">{parseInt(mileage).toLocaleString()} km</span>
                </div>
              )}
              {description && (
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Work done</span>
                  <span className="font-medium text-right max-w-[60%] line-clamp-2">{description}</span>
                </div>
              )}
              {parts.filter((p) => p.partName.trim()).length > 0 && (
                <div className="py-2 border-b border-slate-100">
                  <span className="text-slate-500 block mb-1">Parts</span>
                  {parts.filter((p) => p.partName.trim()).map((p, i) => (
                    <p key={i} className="font-medium text-right">{p.partName} × {p.quantity} {p.unitCostGhs ? `@ ₵${p.unitCostGhs}` : ""}</p>
                  ))}
                </div>
              )}
              {totalCost > 0 && (
                <div className="flex justify-between py-2 text-base">
                  <span className="font-semibold text-slate-900">Total</span>
                  <span className="font-bold text-green-700">₵{totalCost.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)}
            className="flex-1 h-14 border border-slate-300 rounded-xl text-slate-700 font-medium hover:bg-slate-50 flex items-center justify-center gap-2">
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
        )}

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => { if (step === STEPS.length - 2) { /* last step before review */ } setStep(step + 1); }}
            disabled={!canNext[step]}
            className="flex-1 h-14 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            Next <ArrowRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={saveJob}
            disabled={saving || !vehicle || !customer}
            className="flex-1 h-14 bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-lg transition-colors"
          >
            {saving ? "Saving..." : "Save Job"}
            {!saving && <Check className="w-6 h-6" />}
          </button>
        )}
      </div>
    </div>
  );
}

export default function NewRepairPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400 text-sm">Loading...</div>}>
      <NewRepairContent />
    </Suspense>
  );
}
