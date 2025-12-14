import { CadenceWorkflow } from "@/app/components/features/cadence-workflow";

export const metadata = {
  title: "Cadence — Pocket Manager",
};

export default function CadencePage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6">
        <p className="text-sm uppercase tracking-wider text-slate-400">Pocket Manager Feature</p>
        <h1 className="text-3xl font-bold text-white">Cadence — LIVE</h1>
        <p className="mt-2 text-sm text-slate-300">Daily DM portal for labor, deposits, DM list, and WTD summaries.</p>
      </header>

      <CadenceWorkflow />
    </main>
  );
}
