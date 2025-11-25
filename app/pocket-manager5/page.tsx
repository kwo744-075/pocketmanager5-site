// app/pocket-manager5/page.tsx

export default function PocketManagerPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <header className="space-y-2">
          <p className="text-[10px] tracking-[0.3em] uppercase text-emerald-400">
            Pocket Manager5
          </p>
          <h1 className="text-3xl font-bold">Pocket Manager5 dashboard</h1>
          <p className="text-sm text-slate-300">
            This will become the main landing page for the Pocket Manager5 app:
            visits, labor, coaching, training, and daily cadence.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <p className="text-sm text-slate-300">
            For now this is just a placeholder screen so your link works.
            Next step we&apos;ll decide what cards / links you want here
            (daily cadence, coaching forms, reports, etc.) and then wire it to
            Supabase.
          </p>
        </section>
      </div>
    </main>
  );
}
