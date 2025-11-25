// app/page.tsx

type MetricCardProps = {
  label: string;
  value: string;
  note: string;
};

function MetricCard({ label, value, note }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-[11px] text-slate-400 mb-1">{label}</p>
      <p className="text-lg font-semibold text-emerald-300">{value}</p>
      <p className="text-[10px] text-slate-500 mt-1">{note}</p>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        {/* Header */}
        <header className="text-center space-y-3">
          <p className="text-[10px] tracking-[0.3em] uppercase text-emerald-400">
            Pocket Manager5 • Pulse Check5
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold">
            <span className="text-red-500">P</span>ocket&nbsp;Manager{" "}
            <span className="text-red-500">5</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto">
            Your central hub for shop performance, visits, coaching, and KPIs –
            pulling together Pocket Manager5 and Pulse Check5 into one view.
          </p>
        </header>

        {/* Main dashboard row: left / center / right */}
        <section className="grid gap-4 lg:grid-cols-3 items-start">
          {/* Left – Current activity (long box) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
              Current activity
            </h2>

            <div className="text-xs text-slate-300 space-y-2">
              <div>
                <p className="font-semibold text-slate-100 text-sm">
                  Current contests
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Region Big 4 push (placeholder)</li>
                  <li>Zero Zeros challenge (placeholder)</li>
                </ul>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <p className="font-semibold text-slate-100 text-sm">
                  Challenges done today / WTD
                </p>
                <p>Today: 3 completed (placeholder)</p>
                <p>WTD: 11 completed (placeholder)</p>
              </div>
            </div>
          </div>

          {/* Center – Summary rollup (12-box grid) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-lg shadow-black/30 space-y-4">
            <p className="text-[10px] tracking-[0.25em] uppercase text-emerald-400 text-center">
              Summary rollup (Pocket Manager5 + Pulse Check5)
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              {/* TOP 6 */}
              <MetricCard
                label="Shops checked in today"
                value="12 / 14"
                note="Live from Pulse Check5 (placeholder)"
              />
              <MetricCard
                label="Cars"
                value="186"
                note="Today (placeholder)"
              />
              <MetricCard
                label="Sales"
                value="$24,580"
                note="PTD sales (placeholder)"
              />
              <MetricCard
                label="Big 4 performance (PTD)"
                value="103.8%"
                note="Region rollup (placeholder)"
              />
              <MetricCard
                label="Coolants"
                value="42"
                note="Units sold PTD (placeholder)"
              />
              <MetricCard
                label="Diffs"
                value="19"
                note="Units sold PTD (placeholder)"
              />

              {/* BOTTOM 6 */}
              <MetricCard
                label="Employees added / removed"
                value="+1 / -0"
                note="Staffing changes (placeholder)"
              />
              <MetricCard
                label="Training compliance"
                value="92%"
                note="Shop-wide (placeholder)"
              />
              <MetricCard
                label="Current labor hours +/-"
                value="+3.2"
                note="Vs. target (placeholder)"
              />
              <MetricCard
                label="Cash over / short"
                value="+$21.34"
                note="Today (placeholder)"
              />
              <MetricCard
                label="Staffed %"
                value="94%"
                note="Scheduled vs. ideal (placeholder)"
              />
              <MetricCard
                label="Turned cars"
                value="7"
                note="Today (placeholder)"
              />
            </div>

            <p className="text-[10px] text-slate-500 mt-1 text-center">
              These values are static for now. Next step is wiring them to your
              existing Supabase views for Pocket Manager5 and Pulse Check5.
            </p>
          </div>

          {/* Right – Other stats (long box) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
              Other stats
            </h2>

            <div className="text-xs text-slate-300 space-y-2">
              <div>
                <p className="font-semibold text-slate-100 text-sm">
                  Current staffed %
                </p>
                <p>94% of target labor hours (placeholder)</p>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <p className="font-semibold text-slate-100 text-sm">
                  Meetings today / WTD
                </p>
                <p>Today: 2 shop visits logged (placeholder)</p>
                <p>WTD: 7 visits / meetings (placeholder)</p>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <p className="font-semibold text-slate-100 text-sm">
                  Claims submitted today / WTD
                </p>
                <p>Today: 1 claim (placeholder)</p>
                <p>WTD: 3 claims (placeholder)</p>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <p className="font-semibold text-slate-100 text-sm">
                  Turned cars today
                </p>
                <p>7 turned away (placeholder)</p>
              </div>
            </div>
          </div>
        </section>

        {/* Two app tiles */}
        <section className="grid md:grid-cols-2 gap-8">
          {/* Pocket Manager5 card */}
          <a
            href="/pocket-manager5"
            className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between hover:border-emerald-400/80 hover:bg-slate-900 transition"
          >
            <div>
              <h2 className="text-xl font-semibold mb-2 flex items-center justify-between">
                <span>Pocket Manager5</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-400">
                  Daily ops
                </span>
              </h2>
              <p className="text-sm text-slate-300 mb-4">
                Mobile-first toolkit for shop managers and DMs: visits, labor,
                coaching, training, and quick references – designed to live in
                your pocket.
              </p>
              <ul className="text-xs text-slate-300 space-y-2 mb-4">
                <li>• Daily management cadence in your hand</li>
                <li>• Drill down from region → district → shop</li>
                <li>• Ties into your existing Pocket Manager5 app data</li>
              </ul>
            </div>
            <button className="mt-2 inline-flex items-center justify-center rounded-xl border border-emerald-400/70 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-300 group-hover:bg-emerald-500/20">
              Go to Pocket Manager5 →
            </button>
          </a>

          {/* Pulse Check5 card */}
          <a
            href="/pulse-check5"
            className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between hover:border-emerald-400/80 hover:bg-slate-900 transition"
          >
            <div>
              <h2 className="text-xl font-semibold mb-2 flex items-center justify-between">
                <span>Pulse Check5</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-400">
                  Live KPIs
                </span>
              </h2>
              <p className="text-sm text-slate-300 mb-4">
                High-level dashboards for RDs and DMs: shop-by-shop status,
                Big 4, labor, and trends so you know where to coach today.
              </p>
              <ul className="text-xs text-slate-300 space-y-2 mb-4">
                <li>• Region heartbeat in one view</li>
                <li>• Daily &amp; weekly KPI rollups</li>
                <li>• Built to plug into your current Supabase schema</li>
              </ul>
            </div>
            <button className="mt-2 inline-flex items-center justify-center rounded-xl border border-emerald-400/70 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-300 group-hover:bg-emerald-500/20">
              Go to Pulse Check5 →
            </button>
          </a>
        </section>
      </div>
    </main>
  );
}
