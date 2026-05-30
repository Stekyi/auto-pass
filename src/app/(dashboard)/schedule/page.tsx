"use client";

import { useEffect, useState } from "react";
import { Bell, Car, User, CheckCircle, Send, AlertTriangle, Clock } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { format, parseISO, differenceInDays, isPast } from "date-fns";

interface ScheduleItem {
  schedule: {
    id: string; partName: string; dueDateEstimate: string | null;
    dueKmEstimate: number | null; alertSent: boolean; notes: string | null;
  };
  vehiclePlate: string | null;
  vehicleMake: string | null;
  vehicleNumber: string | null;
  customerName: string | null;
  customerTel: string | null;
}

function groupItems(items: ScheduleItem[]) {
  const overdue: ScheduleItem[] = [];
  const thisWeek: ScheduleItem[] = [];
  const thisMonth: ScheduleItem[] = [];
  const later: ScheduleItem[] = [];

  const today = new Date();
  for (const item of items) {
    if (!item.schedule.dueDateEstimate) { later.push(item); continue; }
    const due = parseISO(item.schedule.dueDateEstimate);
    const diff = differenceInDays(due, today);
    if (diff < 0) overdue.push(item);
    else if (diff <= 7) thisWeek.push(item);
    else if (diff <= 30) thisMonth.push(item);
    else later.push(item);
  }
  return { overdue, thisWeek, thisMonth, later };
}

function Group({ title, items, icon: Icon, color, onNotify, onDone }: {
  title: string; items: ScheduleItem[]; icon: React.ElementType; color: string;
  onNotify: (id: string) => void; onDone: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className={`flex items-center gap-2 mb-3 ${color}`}>
        <Icon className="w-4 h-4" />
        <h2 className="font-semibold">{title} ({items.length})</h2>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.schedule.id} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color === "text-red-600" ? "bg-red-50" : color === "text-amber-600" ? "bg-amber-50" : "bg-blue-50"}`}>
                <Bell className={`w-5 h-5 ${color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900">{item.schedule.partName}</p>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                  {(item.vehiclePlate || item.vehicleMake) && (
                    <span className="flex items-center gap-1"><Car className="w-3 h-3" /> {[item.vehicleMake, item.vehiclePlate].filter(Boolean).join(" ")}</span>
                  )}
                  {item.customerName && (
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> {item.customerName}</span>
                  )}
                  {item.schedule.dueDateEstimate && (
                    <span className={`font-medium ${isPast(parseISO(item.schedule.dueDateEstimate)) ? "text-red-600" : ""}`}>
                      Due {format(parseISO(item.schedule.dueDateEstimate), "d MMM yyyy")}
                    </span>
                  )}
                  {item.schedule.dueKmEstimate && (
                    <span>{item.schedule.dueKmEstimate.toLocaleString()} km</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => onNotify(item.schedule.id)}
                disabled={item.schedule.alertSent}
                className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-medium transition-colors ${item.schedule.alertSent ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}
              >
                <Send className="w-3.5 h-3.5" />
                {item.schedule.alertSent ? "Sent" : "Send Reminder"}
              </button>
              <button
                onClick={() => onDone(item.schedule.id)}
                className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Mark Done
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/schedule?days=90").then((r) => r.json()).then((d) => { setItems(d.schedule ?? []); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const notify = async (id: string) => {
    await fetch(`/api/schedule/${id}/notify`, { method: "POST" });
    load();
  };

  const markDone = async (id: string) => {
    await fetch(`/api/schedule/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCompleted: true }),
    });
    load();
  };

  const { overdue, thisWeek, thisMonth, later } = groupItems(items);

  return (
    <div className="space-y-6">
      <PageHeader title="Maintenance Schedule" subtitle={`${items.length} upcoming service items`} />

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-12">Loading...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No upcoming maintenance items.</p>
          <p className="text-xs mt-1">They appear automatically when you log parts in a repair job.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <Group title="Overdue" items={overdue} icon={AlertTriangle} color="text-red-600" onNotify={notify} onDone={markDone} />
          <Group title="This Week" items={thisWeek} icon={Bell} color="text-amber-600" onNotify={notify} onDone={markDone} />
          <Group title="This Month" items={thisMonth} icon={Clock} color="text-blue-600" onNotify={notify} onDone={markDone} />
          <Group title="Later" items={later} icon={Clock} color="text-slate-500" onNotify={notify} onDone={markDone} />
        </div>
      )}
    </div>
  );
}
