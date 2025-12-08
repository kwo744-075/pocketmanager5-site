"use client";

import { useState } from "react";

export default function MasterShops() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleAdd = async () => {
    // placeholder: implement admin route for creating master shops
    setMessage(`(stub) Would create shop: ${name}`);
  };

  return (
    <section className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6">
      <h3 className="text-lg font-semibold text-white">Master Shops</h3>
      <p className="text-sm text-slate-400 mt-2">Create and manage master shop records for the network.</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <input className="col-span-2 rounded-md p-2 bg-slate-900/80 border border-slate-700/70" value={name} onChange={(e) => setName(e.target.value)} placeholder="Shop name or number" />
        <button className="rounded-md border border-emerald-400/70 px-3 py-1 text-sm" onClick={handleAdd}>Add shop</button>
      </div>

      {message ? <div className="mt-3 text-sm text-emerald-200">{message}</div> : null}
    </section>
  );
}
