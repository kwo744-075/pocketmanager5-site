"use client";

import { useState } from "react";
import Link from "next/link";

export default function DepositVerificationPage() {
  const [date] = useState(new Date().toISOString().split("T")[0]);
  const [shop, setShop] = useState("");
  const [bankVisit, setBankVisit] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number | "">("");
  const [expectedAmount, setExpectedAmount] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!shop) {
      setMessage("Please enter a shop name or ID.");
      return;
    }
    if (!files || files.length === 0) {
      setMessage("Please attach at least one deposit slip photo.");
      return;
    }

      setLoading(true);
      try {
      // First upload files to server proxy which will store them with admin privileges
      const fd = new FormData();
      for (let i = 0; i < files.length; i++) {
        fd.append('files', files[i]);
      }

      const uploadRes = await fetch('/api/cadence/uploads', { method: 'POST', body: fd });
      const uploadJson = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        console.error('Upload proxy failed', uploadJson);
        setMessage(uploadJson?.error ?? 'Upload failed');
        setLoading(false);
        return;
      }

      // uploadJson.uploaded will be an array of objects { path, signedUrl, expiresAt }
      // or legacy public URL strings. Keep the returned shape to persist server-side.
      const uploadedUrls = Array.isArray(uploadJson?.uploaded) ? uploadJson.uploaded : [];

      const payload = {
        date,
        shopId: shop,
        bankVisitVerified: !!bankVisit,
        depositAmount: depositAmount === "" ? null : Number(depositAmount),
        expectedAmount: expectedAmount === "" ? null : Number(expectedAmount),
        cashOverShort: Number((Number(depositAmount || 0) - Number(expectedAmount || 0)).toFixed(2)),
        notes,
        files: uploadedUrls,
      } as any;

      const res = await fetch(`/api/cadence/deposits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Deposit submit failed", json);
        setMessage(json?.error ?? "Failed to submit deposit entry");
      } else {
        setMessage("Deposit entry submitted");
        setFiles(null);
        setDepositAmount("");
        setExpectedAmount("");
        setNotes("");
      }
    } catch (err) {
      console.error(err);
      setMessage("Network error submitting deposit entry");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Deposit Verification</h1>
      <p className="text-sm text-slate-300">Capture deposit slips, bank trips, and cash over/short for the week.</p>

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
                Bank Visit Verified?
                <div className="mt-1">
                  <label className="inline-flex items-center gap-2"><input type="checkbox" checked={bankVisit} onChange={(e) => setBankVisit(e.target.checked)} /> Yes</label>
                </div>
              </label>
              <label className="text-sm">
                Deposit Amount
                <input type="number" className="mt-1 w-full rounded-md bg-slate-800/40 p-2 text-white" value={depositAmount as any} onChange={(e) => setDepositAmount(e.target.value === "" ? "" : Number(e.target.value))} />
              </label>
              <label className="text-sm">
                System Expected
                <input type="number" className="mt-1 w-full rounded-md bg-slate-800/40 p-2 text-white" value={expectedAmount as any} onChange={(e) => setExpectedAmount(e.target.value === "" ? "" : Number(e.target.value))} />
              </label>
            </div>

            <div>
              <label className="flex flex-col text-sm">
                Cash Over/Short (editable)
                <input className="mt-1 rounded-md bg-slate-800/40 p-2 text-white" value={depositAmount === "" || expectedAmount === "" ? "" : String((Number(depositAmount || 0) - Number(expectedAmount || 0)).toFixed(2))} readOnly />
              </label>
            </div>

            <div>
              <label className="flex flex-col text-sm">
                Notes
                <textarea className="mt-1 rounded-md bg-slate-800/40 p-2 text-white" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
            </div>

            <div>
              <label className="flex flex-col text-sm">
                Deposit Slip Photo (required)
                <input type="file" accept="image/*" className="mt-1 text-sm text-slate-200" onChange={(e) => setFiles(e.target.files)} />
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button disabled={loading} className={`rounded-md px-4 py-2 text-sm font-semibold ${loading ? 'bg-slate-700/40' : 'bg-emerald-600'}`}> {loading ? 'Submitting…' : 'Submit Deposit Verification'}</button>
                <Link href="/pocket-manager5/features/cadence" className="rounded-md border border-slate-700 px-4 py-2 text-sm">Cancel / Back to Cadence</Link>
              </div>
              {message ? <div className="text-sm text-slate-300">{message}</div> : null}
            </div>
          </form>
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
        <h2 className="text-lg font-semibold text-white">Week View (Mock)</h2>
        <p className="text-sm text-slate-300">Mock week view — TODO: wire to GET /api/cadence/deposits</p>
      </div>
    </main>
  );
}
