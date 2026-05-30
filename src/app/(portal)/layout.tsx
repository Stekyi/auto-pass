export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <span className="font-bold text-slate-900">AutoPass</span>
          <span className="text-xs text-slate-400 hidden sm:block">— Your Vehicle History</span>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6 pb-24">{children}</main>
    </div>
  );
}
