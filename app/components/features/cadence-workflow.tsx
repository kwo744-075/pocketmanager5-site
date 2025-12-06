"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Kpi = { id: string; label: string; value: string };

type DmListItem = {
  id: string;
  createdAt: string;
  shopName: string;
  shopNumber: string;
  category: "Ops" | "People" | "Inventory" | "HR" | "Other";
  message: string;
  priority: "Low" | "Normal" | "High";
  status: "Open" | "In Progress" | "Completed";
};

const KPI_MOCK: Kpi[] = [
  { id: "k1", label: "Weekly Completion %", value: "82%" },
  { id: "k2", label: "Days Completed This Week", value: "5 / 7" },
  { id: "k3", label: "Labor Verified Days", value: "7 / 7" },
  { id: "k4", label: "Deposits Verified Today", value: "41 / 52" },
  { id: "k5", label: "Total Cash Over/Short Today", value: "+$37" },
  { id: "k6", label: "Training Tasks Completed", value: "24" },
  { id: "k7", label: "Inventory Tasks Completed", value: "17" },
  { id: "k8", label: "Open Items", value: "6" },
];

const DM_LIST_MOCK: DmListItem[] = [
  {
    id: "d1",
    createdAt: new Date().toISOString(),
    shopName: "Northside Grill",
    shopNumber: "101",
    category: "Ops",
    message: "Need new fryer filters",
    priority: "Normal",
    status: "Open",
  },
  {
    id: "d2",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    shopName: "Sunset Diner",
    shopNumber: "212",
    category: "Inventory",
    message: "Short on napkins and sanitizer",
    priority: "High",
    status: "In Progress",
  },
  {
    id: "d3",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    shopName: "Riverfront Cafe",
    shopNumber: "055",
    category: "People",
    message: "Requesting additional training modules",
    priority: "Low",
    status: "Completed",
  },
];

const DAYS: Array<"Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday"> = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type CadenceTask = {
  id: string;
  label: string;
  category?: "core" | "visit" | "people" | "admin";
  linkHref?: string;
  linkLabel?: string;
  external?: boolean;
};

const CADENCE_TASKS: Record<string, CadenceTask[]> = {
  Monday: [
    { id: "t1", label: "Labor Verification", category: "core", linkHref: "/pocket-manager5/features/labor", linkLabel: "Open Labor Sheet" },
    { id: "t2", label: "Deposit Verification", category: "core", linkHref: "/pocket-manager5/features/deposit-verification", linkLabel: "Verify Deposits" },
    { id: "t3", label: "Inventory Captain Check", category: "visit", linkHref: "/pocket-manager5/features/inventory-captain", linkLabel: "Inventory Captain" },
    { id: "t4", label: "WorkVivo Check-in", category: "admin", linkHref: "https://drivenbrands.workvivo.com/", linkLabel: "Open Workvivo", external: true },
  ],
  Tuesday: [
    { id: "t5", label: "Claims / Repairs Check", category: "admin", linkHref: "/pocket-manager5/features/claims", linkLabel: "Claims Portal" },
  ],
  // Default for other days
  Sunday: [],
  Wednesday: [],
  Thursday: [],
  Friday: [],
  Saturday: [],
};

export function CadenceWorkflow() {
  const [dmFilter, setDmFilter] = useState<"All" | "Open" | "Completed">("All");
  const [tab, setTab] = useState<"daily" | "wtd">("daily");
  const [activeDay, setActiveDay] = useState<typeof DAYS[number]>("Monday");

  const dmItems = useMemo(() => {
    if (dmFilter === "All") return DM_LIST_MOCK;
    if (dmFilter === "Open") return DM_LIST_MOCK.filter((d) => d.status === "Open");
    return DM_LIST_MOCK.filter((d) => d.status === "Completed");
  }, [dmFilter]);

  return (
    <section>
      {/* Top: Overview + KPI grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold text-white">Cadence Overview</h2>
          <p className="text-sm text-slate-300">Daily + weekly task templates with auto-tracking for DM compliance.</p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {KPI_MOCK.map((k) => (
              <div key={k.id} className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
                <div className="text-sm text-slate-400">{k.label}</div>
                <div className="mt-2 text-2xl font-bold text-white">{k.value}</div>
              </div>
            ))}
          </div>

          {/* Today's deposit & cash summary */}
          <div className="mt-8 rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Today's Deposit & Cash Summary</h3>
                <p className="text-xs text-slate-300">Snapshot of deposits and cash over/short for today. (Mock data)</p>
              </div>
              <Link href="/pocket-manager5/features/deposit-verification" className="text-sm text-emerald-300 hover:underline">View All in Deposit Portal</Link>
            </div>

            <div className="mt-4 w-full overflow-auto">
              <table className="w-full table-fixed text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="w-1/2 text-left">Shop</th>
                    <th className="w-1/6">Deposit Verified</th>
                    <th className="w-1/6">Cash +/-</th>
                  </tr>
                </thead>
                <tbody className="mt-2">
                  <tr className="border-t border-slate-800/40">
                    <td className="py-2">Northside Grill</td>
                    <td className="text-center">✅</td>
                    <td className="text-right">+$12.00</td>
                  </tr>
                  <tr className="border-t border-slate-800/40">
                    <td className="py-2">Sunset Diner</td>
                    <td className="text-center">❌</td>
                    <td className="text-right">-$4.50</td>
                  </tr>
                  <tr className="border-t border-slate-800/40">
                    <td className="py-2">Riverfront Cafe</td>
                    <td className="text-center">✅</td>
                    <td className="text-right">+$29.50</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column: DM List Inbox */}
        <div>
          <div className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">DM List – Incoming Requests</h3>
                <p className="text-sm text-slate-300">Quick asks submitted by shops from Pocket Manager 5.</p>
              </div>
              <div className="flex items-center gap-2">
                <button className={`rounded-full px-3 py-1 text-sm ${dmFilter === 'All' ? 'bg-emerald-600/40' : 'bg-slate-800/30'}`} onClick={() => setDmFilter('All')}>All</button>
                <button className={`rounded-full px-3 py-1 text-sm ${dmFilter === 'Open' ? 'bg-emerald-600/40' : 'bg-slate-800/30'}`} onClick={() => setDmFilter('Open')}>Open</button>
                <button className={`rounded-full px-3 py-1 text-sm ${dmFilter === 'Completed' ? 'bg-emerald-600/40' : 'bg-slate-800/30'}`} onClick={() => setDmFilter('Completed')}>Completed</button>
              </div>
            </div>

            <div className="mt-4 max-h-64 overflow-auto">
              <ul className="space-y-3">
                {dmItems.map((item) => (
                  <li key={item.id} className="rounded-md border border-slate-800/50 bg-slate-950/30 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{item.shopName} <span className="text-xs text-slate-400">#{item.shopNumber}</span></div>
                        <div className="text-xs text-slate-300">{new Date(item.createdAt).toLocaleString()}</div>
                        <div className="mt-2 text-sm text-slate-200">{item.message}</div>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="text-xs text-slate-400">{item.category}</div>
                        <div className={`mt-2 rounded-full px-2 py-1 text-xs ${item.priority === 'High' ? 'bg-rose-600/40' : 'bg-slate-800/30'}`}>{item.priority}</div>
                        <div className="mt-2 text-xs text-slate-300">{item.status}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Daily vs WTD */}
      <div className="mt-8">
        <div className="flex items-center gap-2">
          <button onClick={() => setTab('daily')} className={`px-3 py-1 rounded-md ${tab === 'daily' ? 'bg-emerald-600/40' : 'bg-slate-800/30'}`}>Daily Workflow</button>
          <button onClick={() => setTab('wtd')} className={`px-3 py-1 rounded-md ${tab === 'wtd' ? 'bg-emerald-600/40' : 'bg-slate-800/30'}`}>WTD Summary</button>
        </div>

        {tab === 'daily' ? (
          <div className="mt-4 rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
            <div className="mb-3 flex gap-2 overflow-auto">
              {DAYS.map((d) => (
                <button key={d} onClick={() => setActiveDay(d)} className={`px-3 py-1 rounded-md ${activeDay === d ? 'bg-emerald-600/40' : 'bg-slate-800/30'}`}>{d}</button>
              ))}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white">{activeDay} Tasks</h4>
              <div className="mt-3 space-y-2">
                {(CADENCE_TASKS[activeDay] ?? []).map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-800/40 bg-slate-950/30 p-2">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" className="h-4 w-4" />
                      <div>
                        <div className="text-sm text-white">{task.label}</div>
                        {task.category ? <div className="text-xs text-slate-400">{task.category}</div> : null}
                      </div>
                    </div>
                    <div>
                      {task.linkHref ? (
                        task.external ? (
                          <a href={task.linkHref} target="_blank" rel="noreferrer" className="text-sm text-emerald-300 hover:underline">{task.linkLabel}</a>
                        ) : (
                          <Link href={task.linkHref} className="text-sm text-emerald-300 hover:underline">{task.linkLabel}</Link>
                        )
                      ) : null}
                    </div>
                  </div>
                ))}

                <div className="mt-4">
                  <h5 className="text-sm font-semibold text-white">Visit Standards</h5>
                  <ul className="mt-2 list-disc pl-5 text-sm text-slate-300">
                    <li>Brand Standards Walk</li>
                    <li>KPI board review</li>
                    <li>Team greet & quick coaching</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
            <h3 className="text-lg font-semibold text-white">WTD Summary (Mock)</h3>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-md border border-slate-800/40 p-3">Labor Verifications WTD<br /><span className="text-xl font-bold">52 / 52 shops</span></div>
              <div className="rounded-md border border-slate-800/40 p-3">Deposits Verified WTD<br /><span className="text-xl font-bold">312 / 312</span></div>
              <div className="rounded-md border border-slate-800/40 p-3">Total Cash Over/Short<br /><span className="text-xl font-bold">-$128</span></div>
              <div className="rounded-md border border-slate-800/40 p-3">Open DM List Items<br /><span className="text-xl font-bold">9</span></div>
            </div>

            <div className="mt-6 overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="text-left">Shop</th>
                    <th>Days Labor Verified</th>
                    <th>Days Deposit Verified</th>
                    <th className="text-right">Cash +/-</th>
                    <th className="text-right">Open DM Items</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-800/40">
                    <td className="py-2">Northside Grill</td>
                    <td className="text-center">7</td>
                    <td className="text-center">7</td>
                    <td className="text-right">+$12.00</td>
                    <td className="text-right">1</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default CadenceWorkflow;
