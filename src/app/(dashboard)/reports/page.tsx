"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  TrendingUp, Wrench, Users, Car, DollarSign, AlertTriangle,
  Bell, Send, Bot, User, Loader2, BarChart3,
} from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { PageHeader } from "@/components/shared/PageHeader";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Summary {
  period: string;
  totals: {
    jobs: number; revenue: number; avgValue: number;
    uniqueVehicles: number; uniqueCustomers: number;
    byStatus: { done: number; pending: number; inProgress: number; cancelled: number };
  };
  topParts: { name: string; count: number; qty: string | null }[];
  topVehicles: { plate: string; make: string | null; model: string | null; visits: number; spend: number }[];
  topCustomers: { name: string | null; tel: string | null; visits: number; spend: number }[];
  revenueByMonth: { month: string; revenue: number; jobs: number }[];
  maintenance: { overdue: number; upcoming: number };
}

interface ChatMsg { role: "user" | "assistant"; content: string; toolsUsed?: string[]; }

const PERIODS = [
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
  { label: "12 months", value: "12m" },
  { label: "All time", value: "all" },
];

const SUGGESTED = [
  "Summarise my workshop performance this month",
  "What are my most common repairs?",
  "Which customers visit most often?",
  "Show me my revenue trend",
  "Which vehicle has had the most problems?",
  "How many services are overdue?",
];

// ── Revenue chart (pure CSS bars) ─────────────────────────────────────────────

function RevenueChart({ data }: { data: { month: string; revenue: number; jobs: number }[] }) {
  if (data.length === 0) return <p className="text-sm text-slate-400 text-center py-6">No revenue data yet.</p>;

  const max = Math.max(...data.map(d => d.revenue), 1);

  return (
    <div className="flex items-end gap-2 h-32 pt-2">
      {data.map((d) => (
        <div key={d.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div className="w-full flex flex-col justify-end" style={{ height: "96px" }}>
            <div
              className="w-full bg-blue-500 rounded-t-sm hover:bg-blue-600 transition-colors cursor-default"
              style={{ height: `${Math.round((d.revenue / max) * 96)}px`, minHeight: d.revenue > 0 ? "4px" : "0" }}
              title={`₵${d.revenue.toFixed(0)} — ${d.jobs} jobs`}
            />
          </div>
          <p className="text-xs text-slate-400 truncate w-full text-center">{d.month.slice(5)}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [period, setPeriod] = useState("30d");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadSummary = useCallback(async (p: string) => {
    setLoading(true);
    const res = await fetch(`/api/reports/summary?period=${p}`);
    const data = await res.json();
    setSummary(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadSummary(period); }, [period, loadSummary]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || chatLoading) return;
    const userMsg: ChatMsg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/reports/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.reply, toolsUsed: data.toolsUsed }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Connection error. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const t = summary?.totals;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader title="Workshop Reports" subtitle="Performance analytics + AI insights" />
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === p.value ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-800"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : t ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Revenue (₵)"        value={`₵${t.revenue.toLocaleString("en-GH", { minimumFractionDigits: 0 })}`} icon={DollarSign} color="green" trend={`avg ₵${t.avgValue.toFixed(0)} / job`} />
            <StatCard label="Jobs Completed"     value={t.byStatus.done}      icon={Wrench}   color="blue"  trend={`${t.jobs} total`} />
            <StatCard label="Vehicles Served"    value={t.uniqueVehicles}     icon={Car}      color="blue"  />
            <StatCard label="Customers Served"   value={t.uniqueCustomers}    icon={Users}    color="blue"  />
          </div>

          {/* Maintenance alerts */}
          {(summary.maintenance.overdue > 0 || summary.maintenance.upcoming > 0) && (
            <div className="flex flex-wrap gap-3">
              {summary.maintenance.overdue > 0 && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-800">
                  <AlertTriangle className="w-4 h-4" />
                  <strong>{summary.maintenance.overdue}</strong> overdue service{summary.maintenance.overdue !== 1 ? "s" : ""}
                </div>
              )}
              {summary.maintenance.upcoming > 0 && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-800">
                  <Bell className="w-4 h-4" />
                  <strong>{summary.maintenance.upcoming}</strong> service{summary.maintenance.upcoming !== 1 ? "s" : ""} due in 30 days
                </div>
              )}
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Revenue trend */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-slate-400" />
                <h2 className="font-semibold text-slate-900 text-sm">Monthly Revenue</h2>
              </div>
              <RevenueChart data={summary.revenueByMonth} />
            </div>

            {/* Top parts */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900 text-sm mb-4">Most Common Services</h2>
              {summary.topParts.length === 0
                ? <p className="text-sm text-slate-400">No parts data yet.</p>
                : (
                  <div className="space-y-2">
                    {summary.topParts.slice(0, 6).map((p, i) => (
                      <div key={p.name} className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-4 text-right">{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-0.5">
                            <span className="font-medium text-slate-800 truncate">{p.name}</span>
                            <span className="text-slate-400 flex-shrink-0 ml-2">{p.count}×</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-400 rounded-full"
                              style={{ width: `${Math.round((p.count / (summary.topParts[0]?.count || 1)) * 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            {/* Top vehicles */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900 text-sm mb-3">Most Visited Vehicles</h2>
              {summary.topVehicles.length === 0
                ? <p className="text-sm text-slate-400">No jobs yet.</p>
                : (
                  <div className="divide-y divide-slate-50">
                    {summary.topVehicles.map((v) => (
                      <div key={v.plate} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{v.plate}</p>
                          <p className="text-xs text-slate-400">{[v.make, v.model].filter(Boolean).join(" ") || "—"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-slate-700">{v.visits} visit{v.visits !== 1 ? "s" : ""}</p>
                          <p className="text-xs text-green-700">₵{v.spend.toFixed(0)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            {/* Top customers */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900 text-sm mb-3">Most Loyal Customers</h2>
              {summary.topCustomers.length === 0
                ? <p className="text-sm text-slate-400">No jobs yet.</p>
                : (
                  <div className="divide-y divide-slate-50">
                    {summary.topCustomers.map((c, i) => (
                      <div key={i} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{c.name ?? "—"}</p>
                          <p className="text-xs text-slate-400">{c.tel ?? "—"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-slate-700">{c.visits} visit{c.visits !== 1 ? "s" : ""}</p>
                          <p className="text-xs text-green-700">₵{c.spend.toFixed(0)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </>
      ) : null}

      {/* ── AI Chat Panel ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-900">
          <Bot className="w-5 h-5 text-blue-400" />
          <div>
            <p className="font-semibold text-white text-sm">Ask your data</p>
            <p className="text-xs text-slate-400">AI analyses your workshop records and answers in plain language</p>
          </div>
        </div>

        {/* Messages */}
        <div className="h-72 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50">
          {messages.length === 0 && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-blue-600" />
                </div>
                <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2.5 max-w-xs border border-slate-100">
                  <p className="text-sm text-slate-700">Ask me anything about your workshop — repairs, revenue, customers, or maintenance reminders.</p>
                </div>
              </div>
              <div className="pl-9 flex flex-wrap gap-2">
                {SUGGESTED.map(q => (
                  <button key={q} onClick={() => sendMessage(q)}
                    className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === "user" ? "bg-slate-200" : "bg-blue-100"}`}>
                {m.role === "user" ? <User className="w-3.5 h-3.5 text-slate-600" /> : <Bot className="w-3.5 h-3.5 text-blue-600" />}
              </div>
              <div className={`rounded-2xl px-3.5 py-2.5 max-w-[80%] text-sm ${m.role === "user" ? "bg-blue-600 text-white rounded-tr-sm" : "bg-white text-slate-800 border border-slate-100 rounded-tl-sm"}`}>
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                {m.toolsUsed && m.toolsUsed.length > 0 && (
                  <p className="text-xs opacity-50 mt-1 italic">
                    Checked: {m.toolsUsed.map(t => t.replace(/_/g, " ")).join(", ")}
                  </p>
                )}
              </div>
            </div>
          ))}

          {chatLoading && (
            <div className="flex gap-2">
              <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 p-3 border-t border-slate-100">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="e.g. What was my best month this year?"
            disabled={chatLoading}
            className="flex-1 h-10 px-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || chatLoading}
            className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white rounded-xl flex items-center justify-center transition-colors"
          >
            {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
