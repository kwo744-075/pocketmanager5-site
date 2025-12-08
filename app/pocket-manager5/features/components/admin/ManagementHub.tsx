"use client";

export default function ManagementHub() {
  return (
    <section className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6">
      <h3 className="text-lg font-semibold text-white">Management Hub</h3>
      <p className="text-sm text-slate-400 mt-2">Quick links to common admin tasks and reports.</p>

      <ul className="mt-4 space-y-2 text-sm text-slate-300">
        <li>- Reports (coming soon)</li>
        <li>- User role management (coming soon)</li>
        <li>- Data exports (coming soon)</li>
      </ul>
    </section>
  );
}
