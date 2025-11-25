// app/pulse-check5/page.tsx

export default function PulseCheckPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <header className="space-y-2">
          <p className="text-[10px] tracking-[0.3em] uppercase text-emerald-400">
            Pulse Check5
          </p>
          <h1 className="text-3xl font-bold">Pulse Check5 dashboard</h1>
          <p className="text-sm text-slate-300">
            This will become the high-level KPI view for RDs and DMs: shop
            status, Big 4, labor, and trends so you know where to coach today.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <p className="text-sm text-slate-300">
            For now this is just a placeholder screen so the link works.
            Next step we&apos;ll decide what live metrics and charts you want
            here and wire them to your existing Supabase Pulse Check5 data.
          </p>
        </section>
      </div>
    </main>
  );
}
