"use client";

import { useState } from "react";

export default function CadenceEditor() {
  const [cadenceName, setCadenceName] = useState("");
  const [cron, setCron] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleCreate = async () => {
    // placeholder: implement cadence creation via admin route
    setMessage(`(stub) Created cadence ${cadenceName} (${cron})`);
  };

  return (
    <section className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6">
      <h3 className="text-lg font-semibold text-white">Cadence Editor</h3>
      <p className="text-sm text-slate-400 mt-2">Create and manage cadence schedules for DMs and rollups.</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <input className="col-span-1 rounded-md p-2 bg-slate-900/80 border border-slate-700/70" value={cadenceName} onChange={(e) => setCadenceName(e.target.value)} placeholder="Cadence name" />
        <input className="col-span-1 rounded-md p-2 bg-slate-900/80 border border-slate-700/70" value={cron} onChange={(e) => setCron(e.target.value)} placeholder="Cron or schedule expression" />
        <button className="rounded-md border border-emerald-400/70 px-3 py-1 text-sm" onClick={handleCreate}>Create</button>
      </div>

      {message ? <div className="mt-3 text-sm text-emerald-200">{message}</div> : null}
    </section>
  );
}
