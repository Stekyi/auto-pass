"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Bot, CheckCircle, AlertTriangle, DollarSign, Car, Clock } from "lucide-react";

type Tab = "tenants" | "customers" | "subscriptions" | "parts" | "settings" | "ai" | "charges" | "pricing";

// ── Tenants Tab ────────────────────────────────────────────────────────────────
function TenantsTab() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    code: "",
    ownerName: "",
    contactEmail: "",
    contactTel: "",
    clerkName: "",
    clerkEmail: "",
    clerkPassword: "",
  });
  const load = () => {
    fetch("/api/admin/tenants")
      .then(r => r.json())
      .then(d => setTenants(Array.isArray(d) ? d : (d.tenants ?? [])));
  };
  useEffect(() => { load(); }, []);

  const setActive = async (id: string, isActive: boolean) => {
    await fetch("/api/admin/tenants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive }),
    });
    load();
  };

  const createTenant = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/admin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        code: form.code,
        ownerName: form.ownerName || undefined,
        contactEmail: form.contactEmail || undefined,
        contactTel: form.contactTel || undefined,
        clerkName: form.clerkName,
        clerkEmail: form.clerkEmail,
        clerkPassword: form.clerkPassword,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to create mechanic.");
      return;
    }
    setForm({
      name: "",
      code: "",
      ownerName: "",
      contactEmail: "",
      contactTel: "",
      clerkName: "",
      clerkEmail: "",
      clerkPassword: "",
    });
    load();
  };
  return (
    <div className="space-y-4">
      <form onSubmit={createTenant} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            required
            value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Mechanic name (shop name)"
            className="h-11 px-3 border border-slate-300 rounded-lg text-sm"
          />
          <input
            required
            value={form.code}
            onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))}
            placeholder="Shop code (e.g. KAN)"
            className="h-11 px-3 border border-slate-300 rounded-lg text-sm uppercase"
          />
          <input
            value={form.ownerName}
            onChange={(e) => setForm(f => ({ ...f, ownerName: e.target.value }))}
            placeholder="Owner name (optional)"
            className="h-11 px-3 border border-slate-300 rounded-lg text-sm"
          />
          <input
            value={form.contactTel}
            onChange={(e) => setForm(f => ({ ...f, contactTel: e.target.value }))}
            placeholder="Contact phone (optional)"
            className="h-11 px-3 border border-slate-300 rounded-lg text-sm"
          />
          <input
            type="email"
            value={form.contactEmail}
            onChange={(e) => setForm(f => ({ ...f, contactEmail: e.target.value }))}
            placeholder="Contact email (optional)"
            className="h-11 px-3 border border-slate-300 rounded-lg text-sm"
          />
        </div>

        <div className="border-t border-slate-100 pt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            required
            value={form.clerkName}
            onChange={(e) => setForm(f => ({ ...f, clerkName: e.target.value }))}
            placeholder="Staff name (first user)"
            className="h-11 px-3 border border-slate-300 rounded-lg text-sm"
          />
          <input
            required
            type="email"
            value={form.clerkEmail}
            onChange={(e) => setForm(f => ({ ...f, clerkEmail: e.target.value }))}
            placeholder="Staff email"
            className="h-11 px-3 border border-slate-300 rounded-lg text-sm"
          />
          <input
            required
            type="password"
            value={form.clerkPassword}
            onChange={(e) => setForm(f => ({ ...f, clerkPassword: e.target.value }))}
            placeholder="Staff temporary password"
            className="h-11 px-3 border border-slate-300 rounded-lg text-sm"
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex items-center justify-end">
          <button type="submit" disabled={saving} className="h-11 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:bg-blue-400">
            {saving ? "Creating..." : "Create Mechanic"}
          </button>
        </div>
      </form>

      {tenants.map((t: any) => (
        <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-900">{t.name} <span className="text-xs text-slate-400 font-mono">({t.code})</span></p>
              <p className="text-xs text-slate-500">{t.ownerName} · {t.contactTel ?? "—"}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>{t.isActive ? "Active" : "Suspended"}</span>
              <button
                onClick={() => setActive(t.id, !t.isActive)}
                className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                {t.isActive ? "Suspend" : "Activate"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Customers Tab ────────────────────────────────────────────────────────────
function CustomersTab() {
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState("active");
  const [query, setQuery] = useState("");

  const load = () => {
    const params = new URLSearchParams();
    params.set("status", filter);
    if (query.trim()) params.set("q", query.trim());
    fetch(`/api/admin/customers?${params.toString()}`)
      .then(r => r.json())
      .then(d => setItems(d.customers ?? []));
  };

  useEffect(() => { load(); }, [filter]);

  const setActive = async (id: string, isActive: boolean) => {
    await fetch("/api/admin/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive }),
    });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customer name, phone, or mechanic"
          className="flex-1 h-10 px-3 border border-slate-300 rounded-lg text-sm"
        />
        <button onClick={load} className="h-10 px-4 bg-slate-900 text-white text-sm font-medium rounded-lg">Search</button>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {(["active", "inactive", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filter === s ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No customers found.</p>
      ) : (
        <div className="space-y-3">
          {items.map((c: any) => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">{c.fullName}</p>
                <p className="text-xs text-slate-500">{c.tel}{c.email ? ` · ${c.email}` : ""}</p>
                <p className="text-xs text-slate-400">{c.mechanicName ?? "—"}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>{c.isActive ? "Active" : "Suspended"}</span>
                <button
                  onClick={() => setActive(c.id, !c.isActive)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50"
                >
                  {c.isActive ? "Suspend" : "Activate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Subscriptions Tab ──────────────────────────────────────────────────────────
function SubscriptionsTab() {
  const [subs, setSubs] = useState<any[]>([]);
  useEffect(() => { fetch("/api/admin/subscriptions").then(r => r.json()).then(d => setSubs(d.subscriptions ?? [])); }, []);
  return (
    <div className="space-y-3">
      {subs.map((s: any) => (
        <div key={s.subscription.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-900">{s.mechanicName}</p>
            <p className="text-xs text-slate-500">{s.subscription.startDate} → {s.subscription.endDate}</p>
          </div>
          <div className="text-right">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.subscription.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>{s.subscription.status}</span>
            <p className="text-xs text-slate-400 mt-0.5">₵{s.subscription.amountGhs}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Parts Catalog Tab ──────────────────────────────────────────────────────────
function PartsTab() {
  const [parts, setParts] = useState<any[]>([]);
  const [form, setForm] = useState({ partName: "", lifeMonths: "", lifeKm: "" });
  const [saving, setSaving] = useState(false);

  const load = () => fetch("/api/admin/parts").then(r => r.json()).then(d => setParts(d.parts ?? []));
  useEffect(() => { load(); }, []);

  const save = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/admin/parts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partName: form.partName, lifeMonths: form.lifeMonths ? parseInt(form.lifeMonths) : undefined, lifeKm: form.lifeKm ? parseInt(form.lifeKm) : undefined }),
    });
    setSaving(false);
    setForm({ partName: "", lifeMonths: "", lifeKm: "" });
    load();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-3 gap-3">
        <input required value={form.partName} onChange={e => setForm(f => ({ ...f, partName: e.target.value }))} placeholder="Part name (e.g. Brake Pads)" className="col-span-3 h-11 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="number" value={form.lifeMonths} onChange={e => setForm(f => ({ ...f, lifeMonths: e.target.value }))} placeholder="Life (months)" className="h-11 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="number" value={form.lifeKm} onChange={e => setForm(f => ({ ...f, lifeKm: e.target.value }))} placeholder="Life (km)" className="h-11 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit" disabled={saving} className="h-11 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:bg-blue-400">
          {saving ? "..." : "Add Part"}
        </button>
      </form>
      <div className="space-y-2">
        {parts.map((p: any) => (
          <div key={p.id} className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="font-medium text-slate-900">{p.partName}</p>
            <div className="flex gap-3 text-xs text-slate-500">
              {p.lifeMonths && <span>{p.lifeMonths} months</span>}
              {p.lifeKm && <span>{p.lifeKm.toLocaleString()} km</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Settings Tab ───────────────────────────────────────────────────────────────
function SettingsTab() {
  const [settings, setSettings] = useState<Array<{ key: string; value: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { fetch("/api/admin/settings").then(r => r.json()).then(d => setSettings(d.settings ?? [])); }, []);

  const save = async () => {
    setSaving(true);
    const payload = Object.fromEntries(settings.filter(s => !s.value.includes("••")).map(s => [s.key, s.value]));
    await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-3">
      {settings.map((s, i) => (
        <div key={s.key} className="flex items-center gap-3">
          <label className="w-48 text-xs text-slate-500 shrink-0 font-mono">{s.key}</label>
          <input
            type={s.value.includes("••") ? "password" : "text"}
            value={s.value}
            onChange={(e) => setSettings(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
            className="flex-1 h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      ))}
      <button onClick={save} disabled={saving} className="mt-2 h-11 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-xl">
        {saved ? "Saved!" : saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}

// ── Pricing Tab ───────────────────────────────────────────────────────────────
function PricingTab() {
  const [prices, setPrices] = useState({ vehicleRegistration: "50", subscription: "100" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/prices").then(r => r.json()).then(d => {
      if (d.vehicleRegistration !== undefined)
        setPrices({ vehicleRegistration: String(d.vehicleRegistration), subscription: String(d.subscription) });
    });
  }, []);

  const save = async () => {
    setSaving(true);
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        price_vehicle_registration: prices.vehicleRegistration,
        price_subscription_ghs: prices.subscription,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const field = (label: string, desc: string, key: keyof typeof prices) => (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-medium text-slate-900">{label}</p>
          <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm text-slate-500 font-medium">₵</span>
          <input
            type="number"
            min="0"
            step="0.50"
            value={prices[key]}
            onChange={(e) => setPrices(p => ({ ...p, [key]: e.target.value }))}
            className="w-28 h-11 px-3 border border-slate-300 rounded-xl text-sm font-medium text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">How pricing works</p>
        <ul className="space-y-1 text-blue-700">
          <li>• <strong>Vehicle Registration Fee</strong>: charged every time a mechanic registers a new vehicle. The mechanic collects this from the customer and pays AutoPass.</li>
          <li>• <strong>Annual Subscription</strong>: charged once per year per mechanic shop to keep their account active and allow logging repairs.</li>
        </ul>
      </div>

      {field("Vehicle Registration Fee", "One-time charge per new vehicle added to the system", "vehicleRegistration")}
      {field("Annual Subscription (per mechanic)", "Annual fee per workshop account", "subscription")}

      <button onClick={save} disabled={saving}
        className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl text-sm">
        {saved ? "✓ Saved" : saving ? "Saving..." : "Save Prices"}
      </button>
    </div>
  );
}

// ── Charges Tab ───────────────────────────────────────────────────────────────
function ChargesTab() {
  const [charges, setCharges] = useState<any[]>([]);
  const [filter, setFilter] = useState("pending");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [refInputs, setRefInputs] = useState<Record<string, string>>({});

  const load = (status: string) => {
    fetch(`/api/admin/charges?status=${status}`).then(r => r.json()).then(d => setCharges(d.charges ?? []));
  };

  useEffect(() => { load(filter); }, [filter]);

  const markPaid = async (id: string, status: "paid" | "waived") => {
    setMarkingId(id);
    await fetch(`/api/admin/charges/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reference: refInputs[id] || undefined }),
    });
    setMarkingId(null);
    load(filter);
  };

  const totalPending = charges
    .filter(c => c.charge.status === "pending")
    .reduce((s, c) => s + parseFloat(c.charge.amountGhs), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      {filter === "pending" && charges.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-900">₵{totalPending.toFixed(2)} outstanding</p>
            <p className="text-xs text-amber-700">{charges.length} vehicle registration{charges.length !== 1 ? "s" : ""} awaiting payment</p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {(["pending", "paid", "waived", "all"] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filter === s ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>
            {s}
          </button>
        ))}
      </div>

      {charges.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No charges in this category.</p>
      ) : (
        <div className="space-y-3">
          {charges.map((c: any) => (
            <div key={c.charge.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <p className="font-semibold text-slate-900">{c.vehiclePlate ?? c.vehicleNumber ?? "—"}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      c.charge.status === "paid" ? "bg-green-100 text-green-700" :
                      c.charge.status === "waived" ? "bg-slate-100 text-slate-500" :
                      "bg-amber-100 text-amber-700"}`}>
                      {c.charge.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {[c.vehicleMake, c.vehicleModel].filter(Boolean).join(" ") || ""}
                    {c.shopName ? ` · ${c.shopName}` : ""}
                    {c.customerName ? ` · ${c.customerName}` : ""}
                  </p>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {new Date(c.charge.createdAt).toLocaleDateString("en-GH")}
                    {c.charge.reference ? ` · Ref: ${c.charge.reference}` : ""}
                  </p>
                </div>
                <p className="text-lg font-bold text-slate-900 flex-shrink-0">₵{c.charge.amountGhs}</p>
              </div>

              {c.charge.status === "pending" && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Payment ref (optional)"
                    value={refInputs[c.charge.id] ?? ""}
                    onChange={(e) => setRefInputs(r => ({ ...r, [c.charge.id]: e.target.value }))}
                    className="flex-1 h-9 px-3 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => markPaid(c.charge.id, "paid")}
                    disabled={markingId === c.charge.id}
                    className="h-9 px-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-xs font-medium rounded-lg flex items-center gap-1"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Mark Paid
                  </button>
                  <button
                    onClick={() => markPaid(c.charge.id, "waived")}
                    disabled={markingId === c.charge.id}
                    className="h-9 px-3 border border-slate-300 hover:bg-slate-50 text-slate-600 text-xs font-medium rounded-lg"
                  >
                    Waive
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AI Settings Tab ───────────────────────────────────────────────────────────
function AiTab() {
  const AI_KEYS = ["ai_enabled", "ai_provider", "ai_api_key", "ai_model"];
  const PROVIDER_MODELS: Record<string, string[]> = {
    anthropic: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-8"],
    openai: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
  };

  const [cfg, setCfg] = useState({ ai_enabled: "true", ai_provider: "anthropic", ai_api_key: "", ai_model: "claude-haiku-4-5-20251001" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings").then(r => r.json()).then(d => {
      const settings: Record<string, string> = {};
      (d.settings ?? []).filter((s: any) => AI_KEYS.includes(s.key)).forEach((s: any) => {
        settings[s.key] = s.value.includes("••") ? "" : s.value;
      });
      if (Object.keys(settings).length > 0) setCfg(prev => ({ ...prev, ...settings }));
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const payload: Record<string, string> = {};
    Object.entries(cfg).forEach(([k, v]) => { if (v) payload[k] = v; });
    await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    // Simple validation — check the key looks like a real key
    if (!cfg.ai_api_key || cfg.ai_api_key.length < 20) {
      setTestResult({ ok: false, message: "API key looks too short. Please check it." });
      setTesting(false);
      return;
    }
    if (cfg.ai_provider === "anthropic" && !cfg.ai_api_key.startsWith("sk-ant-")) {
      setTestResult({ ok: false, message: "Anthropic keys start with 'sk-ant-'. Check your key." });
      setTesting(false);
      return;
    }
    setTestResult({ ok: true, message: "Key format looks valid. Save settings and try the customer chat." });
    setTesting(false);
  };

  return (
    <div className="space-y-6">
      {/* Explainer */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Bot className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">Customer AI Assistant</p>
          <p>When enabled, customers see a chat button on their vehicle history page. They can ask about repair history, costs, upcoming maintenance, and find nearby mechanics.</p>
          <p className="mt-1 text-blue-600">Requires an API key from Anthropic (Claude) or OpenAI (GPT).</p>
        </div>
      </div>

      {/* Enable/disable */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="font-medium text-slate-900">Enable AI Assistant</p>
          <p className="text-xs text-slate-500">Customers will see a chat button in their portal</p>
        </div>
        <button
          onClick={() => setCfg(c => ({ ...c, ai_enabled: c.ai_enabled === "true" ? "false" : "true" }))}
          className={`w-12 h-6 rounded-full transition-colors relative ${cfg.ai_enabled === "true" ? "bg-blue-600" : "bg-slate-300"}`}
        >
          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${cfg.ai_enabled === "true" ? "left-7" : "left-1"}`} />
        </button>
      </div>

      {/* Provider + model */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <p className="font-medium text-slate-900">Model Configuration</p>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Provider</label>
          <select
            value={cfg.ai_provider}
            onChange={(e) => setCfg(c => ({ ...c, ai_provider: e.target.value, ai_model: PROVIDER_MODELS[e.target.value]?.[0] ?? "" }))}
            className="w-full h-11 px-3 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="anthropic">Anthropic (Claude) — Recommended</option>
            <option value="openai">OpenAI (GPT)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Model</label>
          <select
            value={cfg.ai_model}
            onChange={(e) => setCfg(c => ({ ...c, ai_model: e.target.value }))}
            className="w-full h-11 px-3 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {(PROVIDER_MODELS[cfg.ai_provider] ?? []).map(m => (
              <option key={m} value={m}>{m}{m.includes("haiku") ? " (Cheapest, Fast)" : m.includes("mini") ? " (Cheapest, Fast)" : m.includes("sonnet") ? " (Balanced)" : " (Most Capable)"}</option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">We recommend Haiku / mini for cost efficiency. Handles all summary tasks well.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">API Key</label>
          <input
            type="password"
            value={cfg.ai_api_key}
            onChange={(e) => setCfg(c => ({ ...c, ai_api_key: e.target.value }))}
            placeholder={cfg.ai_provider === "anthropic" ? "sk-ant-api03-..." : "sk-..."}
            className="w-full h-11 px-3 border border-slate-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-400 mt-1">
            {cfg.ai_provider === "anthropic"
              ? "Get your key at console.anthropic.com → API Keys"
              : "Get your key at platform.openai.com → API keys"}
          </p>
        </div>

        {testResult && (
          <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${testResult.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
            {testResult.ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {testResult.message}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={testConnection} disabled={testing}
            className="h-11 px-4 border border-slate-300 rounded-xl text-sm hover:bg-slate-50 disabled:opacity-50">
            {testing ? "Checking..." : "Validate Key"}
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-xl">
            {saved ? "Saved!" : saving ? "Saving..." : "Save AI Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Admin Page ────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string }[] = [
  { id: "tenants",       label: "Mechanics" },
  { id: "customers",     label: "Customers" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "charges",       label: "Charges" },
  { id: "pricing",       label: "Pricing" },
  { id: "parts",         label: "Parts" },
  { id: "settings",      label: "Settings" },
  { id: "ai",            label: "AI" },
];

export default function AdminPanelClient() {
  const [tab, setTab] = useState<Tab>("tenants");
  return (
    <div className="space-y-6">
      <PageHeader title="Admin Panel" subtitle="Manage tenants, subscriptions, and system settings" />
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 flex-wrap">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${tab === t.id ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-800"}`}>
            {t.id === "ai" ? <span className="flex items-center justify-center gap-1"><Bot className="w-3.5 h-3.5" />{t.label}</span> : t.label}
          </button>
        ))}
      </div>
      <div>
        {tab === "tenants"       && <TenantsTab />}
        {tab === "customers"     && <CustomersTab />}
        {tab === "subscriptions" && <SubscriptionsTab />}
        {tab === "charges"       && <ChargesTab />}
        {tab === "pricing"       && <PricingTab />}
        {tab === "parts"         && <PartsTab />}
        {tab === "settings"      && <SettingsTab />}
        {tab === "ai"            && <AiTab />}
      </div>
    </div>
  );
}
