"use client";

import { useState } from "react";

export default function SlotLockoutEditor() {
  const [slot, setSlot] = useState("");
  const [lockUntil, setLockUntil] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async () => {
    // placeholder: implement saving lockout times to admin route
    setMessage(`(stub) Locking slot ${slot} until ${lockUntil}`);
  };

  return (
    <section className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6">
      <h3 className="text-lg font-semibold text-white">Slot Lockouts</h3>
      <p className="text-sm text-slate-400 mt-2">Prevent late check-ins for specific time slots.</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <input className="col-span-1 rounded-md p-2 bg-slate-900/80 border border-slate-700/70" value={slot} onChange={(e) => setSlot(e.target.value)} placeholder="Time slot key" />
        <input className="col-span-1 rounded-md p-2 bg-slate-900/80 border border-slate-700/70" value={lockUntil} onChange={(e) => setLockUntil(e.target.value)} placeholder="Lock until (ISO datetime)" />
        <button className="rounded-md border border-emerald-400/70 px-3 py-1 text-sm" onClick={handleSave}>Save</button>
      </div>

      {message ? <div className="mt-3 text-sm text-emerald-200">{message}</div> : null}
    </section>
  );
}
