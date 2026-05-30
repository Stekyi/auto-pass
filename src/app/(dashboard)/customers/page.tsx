"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Phone, User } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchBar } from "@/components/shared/SearchBar";
import { Modal } from "@/components/shared/Modal";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { format } from "date-fns";

interface Customer {
  id: string;
  customerNumber: string | null;
  fullName: string;
  tel: string;
  email: string | null;
  location: string | null;
  createdAt: string;
}

function CustomerForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ fullName: "", tel: "", email: "", location: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, email: form.email || undefined }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error?.message ?? "Failed to save."); return; }
    onSuccess();
    onClose();
  };

  const field = (label: string, key: keyof typeof form, type = "text", required = false) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}{required && " *"}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        required={required}
        className="w-full h-12 px-4 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      {field("Full Name", "fullName", "text", true)}
      {field("Phone Number", "tel", "tel", true)}
      {field("Email", "email", "email")}
      {field("Location / Area", "location")}
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving} className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl text-sm">
          {saving ? "Saving..." : "Add Customer"}
        </button>
        <button type="button" onClick={onClose} className="flex-1 h-12 border border-slate-300 rounded-xl text-sm hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async (q: string) => {
    setLoading(true);
    const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setCustomers(data.customers ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(""); }, [load]);

  const columns: Column<Customer>[] = [
    { key: "name", header: "Name", render: (r) => (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <p className="font-medium text-slate-900">{r.fullName}</p>
          {r.customerNumber && <p className="text-xs text-slate-400">{r.customerNumber}</p>}
        </div>
      </div>
    )},
    { key: "tel", header: "Phone", render: (r) => (
      <span className="flex items-center gap-1.5 text-slate-600"><Phone className="w-3.5 h-3.5" />{r.tel}</span>
    )},
    { key: "location", header: "Location", render: (r) => r.location ?? "—", mobileHidden: true },
    { key: "joined", header: "Joined", render: (r) => format(new Date(r.createdAt), "d MMM yyyy"), mobileHidden: true },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        subtitle="Manage your customer records"
        action={
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 h-12 px-5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        }
      />

      <SearchBar
        placeholder="Search by name or phone..."
        onSearch={(q) => { setQuery(q); load(q); }}
        loading={loading}
      />

      <DataTable
        columns={columns}
        rows={customers}
        onRowClick={(r) => router.push(`/customers/${r.id}`)}
        emptyMessage={query ? "No customers match your search." : "No customers yet. Add your first one!"}
      />

      {showAdd && (
        <Modal title="Add Customer" onClose={() => setShowAdd(false)}>
          <CustomerForm onSuccess={() => load(query)} onClose={() => setShowAdd(false)} />
        </Modal>
      )}
    </div>
  );
}
