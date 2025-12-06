"use client";

import { useState } from "react";
import Link from "next/link";

export default function LaborPage() {
  const [date] = useState(new Date().toISOString().split("T")[0]);
  const [shop, setShop] = useState("");
  const [expected, setExpected] = useState<number | "">("");
  const [actual, setActual] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!shop) {
      setMessage("Please enter a shop name or ID.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        date,
        shopId: shop,
        expectedLaborPct: expected === "" ? null : Number(expected),
        actualLaborPct: actual === "" ? null : Number(actual),
        notes,
      } as any;

      const res = await fetch(`/api/cadence/labor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Labor submit failed", json);
        setMessage(json?.error ?? "Failed to submit labor entry");
      } else {
        setMessage("Labor entry submitted");
        // clear reasonable fields
        setExpected("");
        setActual("");
        setNotes("");
      }
    } catch (err) {
      console.error(err);
      setMessage("Network error submitting labor entry");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Labor Verification</h1>
      <p className="text-sm text-slate-300">Enter today's labor and review this week at a glance.</p>

      <div className="mt-6">
        <div className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col text-sm">
                Date
                <input className="mt-1 rounded-md bg-slate-800/40 p-2 text-white" type="date" value={date} readOnly />
              </label>
              <label className="flex flex-col text-sm">
                Shop
                <input className="mt-1 rounded-md bg-slate-800/40 p-2 text-white" value={shop} onChange={(e) => setShop(e.target.value)} placeholder="Shop name or ID" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="text-sm">
                Expected Labor %
                <input type="number" className="mt-1 w-full rounded-md bg-slate-800/40 p-2 text-white" value={expected as any} onChange={(e) => setExpected(e.target.value === "" ? "" : Number(e.target.value))} />
              </label>
              <label className="text-sm">
                Actual Labor %
                <input type="number" className="mt-1 w-full rounded-md bg-slate-800/40 p-2 text-white" value={actual as any} onChange={(e) => setActual(e.target.value === "" ? "" : Number(e.target.value))} />
              </label>
              <div className="text-sm">
                Diff
                <div className="mt-1 rounded-md bg-slate-800/40 p-2 text-white">{expected === "" || actual === "" ? "—" : `${Number(actual) - Number(expected)}%`}</div>
              </div>
            </div>

            <div>
              <label className="flex flex-col text-sm">
                Notes
                <textarea className="mt-1 rounded-md bg-slate-800/40 p-2 text-white" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button disabled={loading} type="submit" className={`rounded-md px-4 py-2 text-sm font-semibold ${loading ? 'bg-slate-700/40' : 'bg-emerald-600'}`}>
                  {loading ? 'Submitting…' : 'Submit Labor Verification'}
                </button>
                <Link href="/pocket-manager5/features/cadence" className="rounded-md border border-slate-700 px-4 py-2 text-sm">Cancel / Back to Cadence</Link>
              </div>
              {message ? <div className="text-sm text-slate-300">{message}</div> : null}
            </div>
          </form>
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
        <h2 className="text-lg font-semibold text-white">Week View (Mock)</h2>
        <p className="text-sm text-slate-300">Mock 7-day summary — TODO: wire to GET /api/cadence/labor</p>
      </div>
    </main>
  );
}
