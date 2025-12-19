"use client";

import Link from "next/link";

const TILE_CLASS = "group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-4 transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400";

export default function ContestPortalPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
        <header className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Contests portal</p>
          <h1 className="text-2xl font-semibold text-white">Launch contests and track progress</h1>
          <p className="text-sm text-slate-300">Top Ranking KPIs remain unchanged. Use the tiles below to open each game.</p>
        </header>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <ContestTile title="Bingo" href="/pocket-manager5/contests/bingo" description="Interactive bingo board with realtime marks." />
          <ContestTile title="Blackout" href="/pocket-manager5/contests/blackout" description="Fill every objective to win." />
          <ContestTile title="Fighting Back" href="/pocket-manager5/contests/fighting-back" description="Comeback challenges for shops." />
          <ContestTile title="Top Ranking KPIs" href="/contests" description="Existing contest logic (unchanged)." tone="emerald" />
        </section>
      </div>
    </main>
  );
}

function ContestTile({ title, description, href, tone = "default" }: { title: string; description: string; href: string; tone?: "default" | "emerald" }) {
  return (
    <Link
      href={href}
      className={`${TILE_CLASS} ${tone === "emerald" ? "border-emerald-400/50 bg-emerald-500/10" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-slate-300">{description}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-200">
          Open
        </span>
      </div>
    </Link>
  );
}
