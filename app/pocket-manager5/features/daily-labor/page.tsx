"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import GENERATED from "../../../components/features/generated-cadence-tasks";

type Task = {
  id: string;
  label: string;
  category?: string;
  linkHref?: string;
  linkLabel?: string;
  allowedRoles?: string[];
};

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"] as const;

export default function DailyLaborLanding() {
  const [tasksByDay, setTasksByDay] = useState<Record<string, Task[]>>({});
  const [role, setRole] = useState<string>("Viewer");
  const [selectedDay, setSelectedDay] = useState<string>("Monday");
  const [weekStart, setWeekStart] = useState<string>(new Date().toISOString().split("T")[0]);
  const [shopInput, setShopInput] = useState<string>("");
  const [hours, setHours] = useState<Record<string, number | "">>({
    Sunday: "", Monday: "", Tuesday: "", Wednesday: "", Thursday: "", Friday: "", Saturday: "",
  });
  const [samplePreview, setSamplePreview] = useState<any>(null);
  const storageKey = "dailyLaborTasks_v1";

  useEffect(() => {
    // load generated tasks and any overrides from localStorage
    const gen = GENERATED as Record<string, Task[]>;
    const raw = localStorage.getItem(storageKey);
    let overrides: Record<string, Task[]> = {};
    try { overrides = raw ? JSON.parse(raw) : {}; } catch (e) { overrides = {}; }
    const merged: Record<string, Task[]> = {};
    for (const d of DAYS) {
      merged[d] = (overrides[d] && overrides[d].length > 0) ? overrides[d] : (gen[d] ?? []);
    }
    setTasksByDay(merged);
  }, []);

  function persist(data: Record<string, Task[]>) {
    localStorage.setItem(storageKey, JSON.stringify(data));
    setTasksByDay(data);
  }

  function addTask(day: string) {
    const label = prompt(`New task label for ${day}`)?.trim();
    if (!label) return;
    const curr = { ...tasksByDay };
    const id = `manual-${day.toLowerCase()}-${Date.now().toString(36).slice(2,8)}`;
    const t: Task = { id, label, category: 'core', allowedRoles: ['RD','VP','ADMIN'] };
    curr[day] = [...(curr[day] ?? []), t];
    persist(curr);
  }

  function editTask(day: string, task: Task) {
    if (!(task.allowedRoles ?? []).includes(role) && role !== 'RD' && role !== 'VP' && role !== 'ADMIN') {
      alert('You do not have permission to edit this task');
      return;
    }
    const newLabel = prompt('Edit task label', task.label)?.trim();
    if (!newLabel) return;
    const curr = { ...tasksByDay };
    curr[day] = curr[day].map(t => t.id === task.id ? { ...t, label: newLabel } : t);
    persist(curr);
  }

  function deleteTask(day: string, taskId: string) {
    if (!confirm('Delete this task?')) return;
    const curr = { ...tasksByDay };
    curr[day] = curr[day].filter(t => t.id !== taskId);
    persist(curr);
  }

  return (
    <div className="p-6">
      <div className="rounded-md border-l-4 border-emerald-500 bg-emerald-900/10 p-4 mb-6">
        <h1 className="text-2xl font-semibold">Daily Labor — Quick Entry</h1>
        <p className="mt-1 text-sm text-slate-300">Enter quick hours for the week (Sun–Sat). Saves will post an entry per day to the labor API for review.</p>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
            <h2 className="text-lg font-medium">Weekly Quick Entry</h2>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="text-sm">
                Week start (date)
                <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="mt-1 w-full rounded-md bg-slate-800/40 p-2 text-white" />
              </label>
              <label className="text-sm">
                Shop
                <input value={shopInput} onChange={(e) => setShopInput(e.target.value)} placeholder="Shop name or ID" className="mt-1 w-full rounded-md bg-slate-800/40 p-2 text-white" />
              </label>
              <div className="text-sm">
                Actions
                <div className="mt-1 flex gap-2">
                  <button onClick={async () => {
                    // fetch sample preview
                    try {
                      const res = await fetch('/api/samples/parse-labor');
                      const json = await res.json();
                      setSamplePreview(json);
                    } catch (e) {
                      setSamplePreview({ error: 'Fetch failed' });
                    }
                  }} className="rounded-md bg-emerald-600 px-3 py-1 text-sm">Load Sample Preview</button>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DAYS.map((d) => (
                <label key={d} className="text-sm">
                  {d}
                  <input type="number" min="0" step="0.25" value={hours[d] ?? ""} onChange={(e) => setHours(prev => ({ ...prev, [d]: e.target.value === '' ? '' : Number(e.target.value) }))} className="mt-1 w-full rounded-md bg-slate-800/40 p-2 text-white" />
                </label>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={async () => {
                if (!shopInput) { alert('Please enter a shop name or ID'); return; }
                const base = new Date(weekStart + 'T00:00:00');
                const entries: any[] = [];
                for (let i = 0; i < DAYS.length; i++) {
                  const day = DAYS[i];
                  const val = hours[day];
                  if (val === '' || val == null) continue;
                  const date = new Date(base);
                  date.setDate(base.getDate() + i);
                  entries.push({
                    date: date.toISOString().split('T')[0],
                    shopId: shopInput,
                    expectedLaborPct: null,
                    actualLaborPct: Number(val),
                    notes: `Quick entry: ${val} hours for ${day}`,
                  });
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
                  console.log('bulk save result', json);
                  alert('Saved entries for week (bulk)');
                } catch (err) {
                  console.error(err);
                  alert('Failed to save entries');
                }
              }} className="rounded-md bg-emerald-600 px-3 py-1 text-sm">Save Week</button>
              <button onClick={() => { setHours({ Sunday: "", Monday: "", Tuesday: "", Wednesday: "", Thursday: "", Friday: "", Saturday: "" }); }} className="rounded-md border px-3 py-1 text-sm">Clear</button>
            </div>

            {samplePreview ? (
              <div className="mt-4 rounded-md border border-slate-800/40 p-3 bg-slate-950/20 text-sm">
                <div><strong>Sample Preview:</strong></div>
                <pre className="mt-2 max-h-40 overflow-auto text-xs">{JSON.stringify(samplePreview, null, 2)}</pre>
              </div>
            ) : null}
          </div>
          <div className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Manage Tasks</h2>
              <div>
                <label className="text-sm text-slate-400 mr-2">Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-md bg-slate-800/30 px-2 py-1 text-sm">
                  <option>Viewer</option>
                  <option>RD</option>
                  <option>VP</option>
                  <option>ADMIN</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex gap-2 flex-wrap">
              {DAYS.map(d => (
                <button key={d} onClick={() => setSelectedDay(d)} className={`px-2 py-1 rounded-md ${selectedDay === d ? 'bg-emerald-600/40' : 'bg-slate-800/30'}`}>{d}</button>
              ))}
            </div>

            <div className="mt-4">
              <div className="mb-2 text-sm text-slate-400">Tasks for <strong>{selectedDay}</strong></div>
              <div className="space-y-2">
                {(tasksByDay[selectedDay] ?? []).map(t => (
                  <div key={t.id} className="flex items-center justify-between rounded-md border border-slate-800/40 bg-slate-950/30 p-2">
                    <div>{t.label}</div>
                    <div className="flex items-center gap-2">
                      {t.linkHref ? <Link href={t.linkHref} className="text-xs text-emerald-300">Open</Link> : null}
                      <button onClick={() => editTask(selectedDay, t)} className="text-xs px-2 py-1 rounded-md border" disabled={!((t.allowedRoles ?? []).includes(role))}>Edit</button>
                      <button onClick={() => deleteTask(selectedDay, t.id)} className="text-xs px-2 py-1 rounded-md border" disabled={!((t.allowedRoles ?? []).includes(role))}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3">
                <button onClick={() => addTask(selectedDay)} className="rounded-md bg-emerald-600 px-3 py-1 text-sm">Add Task</button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
            <h3 className="text-lg font-medium">Reference Files</h3>
            <p className="text-sm text-slate-400">Downloads and parsed structure:</p>
            <ul className="mt-2 list-disc pl-5 text-sm">
              <li><a className="text-emerald-300 hover:underline" href="/samples/DM%20Daily%20Cadence_.pdf" target="_blank">DM Daily Cadence_.pdf</a></li>
              <li><a className="text-emerald-300 hover:underline" href="/samples/GC%20Region%20Labor%2012.06.25.xlsx" target="_blank">GC Region Labor 12.06.25.xlsx</a> — <a className="text-emerald-300 hover:underline" href="/api/samples/parse-labor" target="_blank">View parsed structure</a></li>
            </ul>
          </div>
        </div>

        <div className="md:col-span-1">
          <div className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
            <h3 className="text-lg font-medium">Quick Links</h3>
            <div className="mt-2 flex flex-col gap-2">
              <Link href="/pocket-manager5/features/labor" className="text-emerald-300 text-sm">Open existing labor sheet</Link>
              <Link href="/pocket-manager5/features/daily-labor" className="text-emerald-300 text-sm">Daily Labor Landing</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
