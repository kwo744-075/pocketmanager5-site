"use client";

import Link from "next/link";
import { useState, useMemo } from "react";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"] as const;

type ShopRow = {
  id: string;
  shopId: string;
  hours: Record<string, number | "">;
};

export default function DailyLaborLanding() {
  const [weekStart, setWeekStart] = useState<string>(new Date().toISOString().split("T")[0]);
  const [rows, setRows] = useState<ShopRow[]>([
    { id: 'r1', shopId: 'Shop 1001', hours: { Sunday: '', Monday: '', Tuesday: '', Wednesday: '', Thursday: '', Friday: '', Saturday: '' } },
    { id: 'r2', shopId: 'Shop 1002', hours: { Sunday: '', Monday: '', Tuesday: '', Wednesday: '', Thursday: '', Friday: '', Saturday: '' } },
  ]);

  function addRow() {
    const id = `r-${Date.now().toString(36)}`;
    setRows(r => [...r, { id, shopId: '', hours: { Sunday: '', Monday: '', Tuesday: '', Wednesday: '', Thursday: '', Friday: '', Saturday: '' } }]);
  }

  function removeRow(id: string) {
    setRows(r => r.filter(x => x.id !== id));
  }

  function setShopId(id: string, shopId: string) {
    setRows(r => r.map(x => x.id === id ? { ...x, shopId } : x));
  }

  function setHour(id: string, day: string, value: string) {
    const parsed = value === '' ? '' : Number(value);
    setRows(r => r.map(x => x.id === id ? { ...x, hours: { ...x.hours, [day]: parsed } } : x));
  }

  async function saveGrid() {
    // build entries per shop per day
    const base = new Date(weekStart + 'T00:00:00');
    const entries: any[] = [];
    for (const row of rows) {
      if (!row.shopId) continue;
      for (let i = 0; i < DAYS.length; i++) {
        const day = DAYS[i];
        const val = row.hours[day];
        if (val === '' || val == null) continue;
        const date = new Date(base);
        date.setDate(base.getDate() + i);
        entries.push({
          date: date.toISOString().split('T')[0],
          shopId: row.shopId,
          expectedLaborPct: null,
          actualLaborPct: Number(val),
          notes: `Grid entry: ${val} hours for ${day}`,
        });
      }
    }
    if (entries.length === 0) { alert('No hours entered to save'); return; }

    try {
      const res = await fetch('/api/cadence/labor/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('Bulk save failed', json);
        alert(json?.error ?? 'Bulk save failed');
        return;
      }
      alert('Saved grid entries');
    } catch (err) {
      console.error(err);
      alert('Failed to save entries');
    }
  }

  const MIN_HOURS_WTD: Record<string, number> = {
    Sunday: 20,
    Monday: 45.3,
    Tuesday: 70.6,
    Wednesday: 95.93,
    Thursday: 121.23,
    Friday: 146.53,
    Saturday: 171.8,
  };

  // Compliance table component (inline) — computes OT% per district and region totals
  type DistrictCompliance = {
    name: string;
    checked: boolean;
    totalHrs: number | '';
    otHrs: number | '';
  };

  function ComplianceTable() {
    const initial: DistrictCompliance[] = ['Baton Rouge North','Baton Rouge South','Gulf Coast North','Lafayette','Gulf Coast West','NOLA North','NOLA South'].map((n) => ({ name: n, checked: false, totalHrs: '', otHrs: '' }));
    const [items, setItems] = useState<DistrictCompliance[]>(initial);

    const setChecked = (idx: number, v: boolean) => setItems(s => s.map((it, i) => i === idx ? { ...it, checked: v } : it));
    const setTotal = (idx: number, v: string) => setItems(s => s.map((it, i) => i === idx ? { ...it, totalHrs: v === '' ? '' : Number(v) } : it));
    const setOT = (idx: number, v: string) => setItems(s => s.map((it, i) => i === idx ? { ...it, otHrs: v === '' ? '' : Number(v) } : it));

    const totals = useMemo(() => {
      let totalH = 0;
      let totalOT = 0;
      for (const it of items) {
        if (typeof it.totalHrs === 'number') totalH += it.totalHrs;
        if (typeof it.otHrs === 'number') totalOT += it.otHrs;
      }
      const otPct = totalH > 0 ? (totalOT / totalH) * 100 : 0;
      return { totalH, totalOT, otPct };
    }, [items]);

    return (
      <div>
        <div className="grid gap-2">
          {items.map((it, idx) => (
            <div key={it.name} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={it.checked} onChange={(e) => setChecked(idx, e.target.checked)} />
              <div className="flex-1">{it.name}</div>
              <input value={it.totalHrs === '' ? '' : String(it.totalHrs)} onChange={(e) => setTotal(idx, e.target.value)} placeholder="Total Hrs" className="w-24 rounded-md bg-slate-800/40 p-1 text-white" />
              <input value={it.otHrs === '' ? '' : String(it.otHrs)} onChange={(e) => setOT(idx, e.target.value)} placeholder="OT Hrs" className="w-20 rounded-md bg-slate-800/40 p-1 text-white" />
              <div className="w-20 text-right">{typeof it.totalHrs === 'number' && it.totalHrs > 0 && typeof it.otHrs === 'number' ? `${((it.otHrs / it.totalHrs) * 100).toFixed(1)}%` : '--'}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 border-t pt-2 text-sm">
          <div className="flex justify-between"><div className="font-medium">Region Totals</div><div></div></div>
          <div className="flex justify-between mt-1"><div>Total Hours</div><div>{totals.totalH.toFixed(2)}</div></div>
          <div className="flex justify-between mt-1"><div>Total OT</div><div>{totals.totalOT.toFixed(2)}</div></div>
          <div className="flex justify-between mt-1"><div>OT %</div><div>{totals.otPct.toFixed(2)}%</div></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="rounded-md border-l-4 border-emerald-500 bg-emerald-900/10 p-4 mb-6">
        <h1 className="text-2xl font-semibold">Daily Labor — Landing</h1>
        <p className="mt-1 text-sm text-slate-300">High-level landing for labor views. Choose Region / District / DM / Shop / VP or open the Captains Portal.</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="col-span-1 rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
            <h3 className="text-lg font-medium">Region View</h3>
            <p className="text-sm text-slate-400">Overview for the entire region (as in the attached workbook).</p>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/pocket-manager5/features/daily-labor/region" className="text-emerald-300 text-sm">Open Region View</Link>
            </div>
          </div>

          <div className="col-span-1 rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
            <h3 className="text-lg font-medium">District (DM) View</h3>
            <p className="text-sm text-slate-400">District-level grid and summary for DMs.</p>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/pocket-manager5/features/daily-labor/district" className="text-emerald-300 text-sm">Open District View</Link>
            </div>
          </div>

          <div className="col-span-1 rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
            <h3 className="text-lg font-medium">Shop View</h3>
            <p className="text-sm text-slate-400">Shop-level hours and details.</p>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/pocket-manager5/features/daily-labor/shop" className="text-emerald-300 text-sm">Open Shop View</Link>
            </div>
          </div>

          <div className="col-span-1 rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
            <h3 className="text-lg font-medium">Captains Portal — Labor Captain</h3>
            <p className="text-sm text-slate-400">Placeholder for Labor Captain buildout: scheduled compliance, totals, OT calculations.</p>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/captains/labor-captain" className="text-emerald-300 text-sm">Open Labor Captain (placeholder)</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-4 overflow-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">District Labor</h2>
              <div className="flex items-center gap-2">
                <label className="text-sm">Week start
                  <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="ml-2 rounded-md bg-slate-800/40 p-1 text-white" />
                </label>
                <button onClick={addRow} className="rounded-md bg-emerald-600 px-3 py-1 text-sm">Add Shop Row</button>
              </div>
            </div>

            <div className="mt-4 w-full overflow-auto">
              <table className="w-full table-fixed border-collapse text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="p-2 border-b border-slate-800/40 w-48">Shop</th>
                    {DAYS.map(d => <th key={d} className="p-2 border-b border-slate-800/40">{d.slice(0,3)}</th>)}
                    <th className="p-2 border-b border-slate-800/40 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="align-top">
                      <td className="p-2 border-b border-slate-800/30">
                        <input value={r.shopId} onChange={(e) => setShopId(r.id, e.target.value)} placeholder="Shop name or ID" className="w-full rounded-md bg-slate-800/40 p-1 text-white" />
                      </td>
                      {DAYS.map(d => (
                        <td key={d} className="p-2 border-b border-slate-800/30">
                          <input type="number" min="0" step="0.25" value={r.hours[d] === '' ? '' : String(r.hours[d])} onChange={(e) => setHour(r.id, d, e.target.value)} className="w-full rounded-md bg-slate-800/40 p-1 text-white" />
                        </td>
                      ))}
                      <td className="p-2 border-b border-slate-800/30">
                        <div className="flex gap-2">
                          <button onClick={() => removeRow(r.id)} className="rounded-md border px-2 py-1 text-sm">Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={saveGrid} className="rounded-md bg-emerald-600 px-3 py-1 text-sm">Save Grid</button>
              <button onClick={() => setRows([])} className="rounded-md border px-3 py-1 text-sm">Clear All</button>
            </div>
          </div>
        </div>

        <div className="md:col-span-1 space-y-4">
          <div className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
            <h3 className="text-lg font-medium">Captains — Scheduled Compliance</h3>
            <p className="text-sm text-slate-400">Per-district scheduled compliance checks and totals. Enter Total Hours and OT Hours and OT% will be calculated.</p>
            <div className="mt-3">
              <ComplianceTable />
            </div>
          </div>

          <div className="rounded-lg border border-slate-800/60 bg-yellow-200/90 p-3">
            <h4 className="text-sm font-semibold">Min Hours WTD - KEY</h4>
            <div className="mt-2 text-sm">
              {Object.entries(MIN_HOURS_WTD).map(([day, v]) => (
                <div key={day} className="flex justify-between border-b border-slate-200/40 py-1">
                  <span className="font-medium">{day}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
