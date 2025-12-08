"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DailyWorkflowSidebar from "./DailyWorkflowSidebar";
import GENERATED_CADENCE_TASKS from "./generated-cadence-tasks";
import DmListPanel from "./DmListPanel";

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

// client-side DM list will be fetched from the cadence API

export const DAYS: Array<"Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday"> = [
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

type AlignmentMembership = { role?: string | null };

export const CADENCE_TASKS: Record<string, CadenceTask[]> = {
  Monday: [
    { id: "m01", label: "All Shops Open", category: "core" },
    { id: "m02", label: "Labor Verification", category: "core", linkHref: "/pocket-manager5/features/labor", linkLabel: "Open Labor Sheet" },
    { id: "m03", label: "KPI’s & #’s Communication to Team", category: "core" },
    { id: "m04", label: "Deposit Verification", category: "core", linkHref: "/pocket-manager5/features/deposit-verification", linkLabel: "Verify Deposits" },
    { id: "m05", label: "Car Defecit Report", category: "admin" },
    { id: "m06", label: "Corrigo", category: "admin" },
    { id: "m07", label: "WorkVivo", category: "admin", linkHref: "https://drivenbrands.workvivo.com/", linkLabel: "Open Workvivo", external: true },
    { id: "m08", label: "Workday – check applications", category: "admin" },
    { id: "m09", label: "Zendesk Follow-up", category: "admin" },
    { id: "m10", label: "Update 5-8 Tracker", category: "admin" },
    { id: "m11", label: "Daily Check-ins 12, 2:30, 5", category: "core" },
    { id: "m12", label: "Training Reports & Communication", category: "people" },
    { id: "m13", label: "Inventory Report & Communication", category: "admin" },
    { id: "m14", label: "Validation of Previous Week Supplemental Orders", category: "admin" },
    { id: "m15", label: "Achievers Recognition & Boosting", category: "people" },
    { id: "m16", label: "Regional Meeting – Goal Setting & AORs", category: "admin" },
    { id: "m17", label: "District Meeting", category: "admin" },
    { id: "m18", label: "People Review & Schedule Interviews for Week", category: "people" },
    { id: "m19", label: "Update Expense Report", category: "admin" },
  ],
  Tuesday: [
    { id: "t01", label: "All Shops Open", category: "core" },
    { id: "t02", label: "Labor Verification", category: "core" },
    { id: "t03", label: "KPI’s & #’s Communication to Team", category: "core" },
    { id: "t04", label: "Deposit Verification", category: "core" },
    { id: "t05", label: "Car Defecit Report", category: "admin" },
    { id: "t06", label: "Corrigo", category: "admin" },
    { id: "t07", label: "WorkVivo", category: "admin" },
    { id: "t08", label: "Workday – check applications", category: "admin" },
    { id: "t09", label: "Zendesk Follow-up", category: "admin" },
    { id: "t10", label: "Visit Prep", category: "visit" },
    { id: "t11", label: "Update 5-8 Tracker", category: "admin" },
    { id: "t12", label: "Daily Check-ins 12, 2:30, 5", category: "core" },
    { id: "t13", label: "Schedule Review & Posting (Before you leave the house/office)", category: "admin" },
    { id: "t14", label: "Fleet Dashboard", category: "admin" },
    { id: "t15", label: "Shop Visits*", category: "visit" },
    { id: "t16", label: "Prep for Tomorrow Claims Call", category: "admin" },
  ],
  Wednesday: [
    { id: "w01", label: "All Shops Open", category: "core" },
    { id: "w02", label: "Labor Verification (OT)", category: "core" },
    { id: "w03", label: "KPI’s & #’s Communication to Team", category: "core" },
    { id: "w04", label: "Deposit Verification", category: "core" },
    { id: "w05", label: "Car Defecit Report", category: "admin" },
    { id: "w06", label: "Corrigo", category: "admin" },
    { id: "w07", label: "WorkVivo", category: "admin" },
    { id: "w08", label: "Workday – check applications", category: "admin" },
    { id: "w09", label: "Zendesk Follow-up", category: "admin" },
    { id: "w10", label: "Visit Prep", category: "visit" },
    { id: "w11", label: "Update 5-8 Tracker", category: "admin" },
    { id: "w12", label: "Daily Check-ins 12, 2:30, 5", category: "core" },
    { id: "w13", label: "Claims Call", category: "admin" },
    { id: "w14", label: "NPS Comment Review", category: "admin" },
    { id: "w15", label: "Training Reports & Communication", category: "people" },
    { id: "w16", label: "Overtime Notes", category: "admin" },
    { id: "w17", label: "Shop Visits*", category: "visit" },
  ],
  Thursday: [
    { id: "th01", label: "All Shops Open", category: "core" },
    { id: "th02", label: "Labor Verification (OT)", category: "core" },
    { id: "th03", label: "KPI’s & #’s Communication to Team", category: "core" },
    { id: "th04", label: "Deposit Verification", category: "core" },
    { id: "th05", label: "Car Defecit Report", category: "admin" },
    { id: "th06", label: "Corrigo", category: "admin" },
    { id: "th07", label: "WorkVivo", category: "admin" },
    { id: "th08", label: "Workday – check applications", category: "admin" },
    { id: "th09", label: "Zendesk Follow-up", category: "admin" },
    { id: "th10", label: "Visit Prep", category: "visit" },
    { id: "th11", label: "Update 5-8 Tracker", category: "admin" },
    { id: "th12", label: "Daily Check-ins 12, 2:30, 5", category: "core" },
    { id: "th13", label: "Labor Comments added by Noon", category: "admin" },
    { id: "th14", label: "Training Reports & Communication", category: "people" },
    { id: "th15", label: "Training Validation – Meet & Greet", category: "people" },
    { id: "th16", label: "Shop Visits*", category: "visit" },
  ],
  Friday: [
    { id: "f01", label: "All Shops Open", category: "core" },
    { id: "f02", label: "Labor Verification (OT)", category: "core" },
    { id: "f03", label: "KPI’s & #’s Communication to Team", category: "core" },
    { id: "f04", label: "Deposit Verification", category: "core" },
    { id: "f05", label: "Car Defecit Report", category: "admin" },
    { id: "f06", label: "Corrigo", category: "admin" },
    { id: "f07", label: "WorkVivo", category: "admin" },
    { id: "f08", label: "Workday – check applications", category: "admin" },
    { id: "f09", label: "Zendesk Follow-up", category: "admin" },
    { id: "f10", label: "Visit Prep", category: "visit" },
    { id: "f11", label: "Update 5-8 Tracker", category: "admin" },
    { id: "f12", label: "Daily Check-ins 12, 2:30, 5", category: "core" },
    { id: "f13", label: "Full Throttle Friday Visits", category: "visit" },
  ],
  Saturday: [
    { id: "s01", label: "All Shops Open", category: "core" },
    { id: "s02", label: "Labor Verification (OT)", category: "core" },
    { id: "s03", label: "KPI’s & #’s Communication to Team", category: "core" },
    { id: "s04", label: "Update 5-8 Tracker", category: "admin" },
    { id: "s05", label: "Daily Check-ins 12, 2:30, 5", category: "core" },
    { id: "s06", label: "Visit Prep if Weekend Visit Day", category: "visit" },
  ],
  Sunday: [],
};

export function CadenceWorkflow() {
  const [dmFilter, setDmFilter] = useState<"All" | "Open" | "Completed">("All");
  const [activeDay, setActiveDay] = useState<typeof DAYS[number]>("Monday");
  const router = useRouter();

  const [dmItems, setDmItems] = useState<DmListItem[]>([]);
  const [loadingDm, setLoadingDm] = useState(false);
  const [dmError, setDmError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const POLL_INTERVAL_MS = 30000; // 30s
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Fetch DM list with loading/error handling. Refetch when filter/page changes.
  const fetchDmList = useCallback(
    async (signal?: AbortSignal) => {
    setLoadingDm(true);
    setDmError(null);
    try {
      // Request a single page from the server using limit/offset
      const offset = (page - 1) * PAGE_SIZE;
      const res = await fetch(`/api/cadence/dm-list?limit=${PAGE_SIZE}&offset=${offset}`, { credentials: "same-origin", signal });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `Fetch failed (${res.status})`);
      }
      const json = await res.json();
      const raw: unknown[] = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);

      // Normalize incoming rows to the DmListItem shape used by the UI
      const normalized: DmListItem[] = raw.map((r) => {
        const rec = (r as Record<string, unknown>) || {};
        const idVal = rec['id'] ?? rec['_id'] ?? Math.random().toString(36).slice(2, 9);
        const createdAtVal = rec['created_at'] ?? rec['createdAt'] ?? new Date().toISOString();
        const shopNameVal = rec['shop_name'] ?? rec['shopName'] ?? rec['shop'] ?? 'Shop';
        const shopNumberVal = rec['shop_id'] ?? rec['shopId'] ?? rec['shopNumber'] ?? '-';
        const messageVal = rec['message'] ?? rec['msg'] ?? '';
        const categoryVal = (rec['category'] as DmListItem['category']) ?? 'Other';
        const priorityVal = (rec['priority'] as DmListItem['priority']) ?? 'Normal';
        const statusRaw = rec['status'] ?? rec['state'] ?? 'pending';
        const statusVal = String(statusRaw).toLowerCase().includes('comp') ? 'Completed' : 'Open';

        return {
          id: String(idVal),
          createdAt: String(createdAtVal),
          shopName: String(shopNameVal),
          shopNumber: String(shopNumberVal),
          message: String(messageVal),
          category: categoryVal,
          priority: priorityVal,
          status: statusVal as DmListItem['status'],
        } as DmListItem;
      });

      // apply client-side filter
      const filtered = normalized.filter((it) => {
        if (dmFilter === "All") return true;
        if (dmFilter === "Open") return it.status === "Open";
        return it.status === "Completed";
      });

        // server already paginated; use filtered results directly
        setDmItems(filtered);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Failed to load DM list", err);
        const message = err instanceof Error ? err.message : "Failed to load DM list";
        setDmError(message);
      } finally {
        setLoadingDm(false);
      }
    },
    [PAGE_SIZE, dmFilter, page],
  );

  // initial load + when filter/page changes
  useEffect(() => {
    const ctrl = new AbortController();
    fetchDmList(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchDmList]);

  // polling for freshness
  useEffect(() => {
    const id = setInterval(() => {
      fetchDmList();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchDmList]);

  const [selectedItem, setSelectedItem] = useState<DmListItem | null>(null);
  const [resolutionType, setResolutionType] = useState<"complete" | "called_in" | "ordered">("complete");

  // Prefer canonical in-code cadence tasks over generated placeholders so DMs see live defaults
  const TASKS = { ...GENERATED_CADENCE_TASKS, ...CADENCE_TASKS };

  // tasksByDay: prefer DB-provided templates; fall back to compiled TASKS
  const [tasksByDay, setTasksByDay] = useState<Record<string, CadenceTask[]>>(() => {
    const init: Record<string, CadenceTask[]> = {};
    Object.keys(TASKS).forEach((d) => {
      init[d] = (TASKS as Record<string, CadenceTask[]>)[d] ?? [];
    });
    return init;
  });

  // permission to edit templates (RD / VP / ADMIN only)
  const [canEditCadence, setCanEditCadence] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const sRes = await fetch('/api/session/role');
        if (!sRes.ok) return;
        const sJson = await sRes.json();
        const alignment = sJson?.alignment ?? null;
        const memberships: AlignmentMembership[] = Array.isArray(alignment?.memberships) ? alignment.memberships : [];
        const rolesLower = memberships.map((membership) => String(membership?.role ?? '').toLowerCase());
        const isAdmin = rolesLower.some((r) => r.includes('admin') || r.includes('administrator') || r.includes('super'));
        const isVP = rolesLower.some((r) => r.includes('vp'));
        const isRD = rolesLower.some((r) => r.includes('rd') || r.includes('regional'));
        if (mounted) setCanEditCadence(isAdmin || isVP || isRD);
      } catch {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Fetch cadence templates from server and merge (server overrides defaults)
  useEffect(() => {
    let mounted = true;
    async function loadTemplates() {
      try {
        const res = await fetch('/api/cadence/templates');
        if (!res.ok) return;
        const json = await res.json();
        const map: Record<string, string[]> = json?.data ?? {};
        if (mounted) {
          setTasksByDay((prev) => {
            const next: Record<string, CadenceTask[]> = { ...prev };
            Object.entries(map).forEach(([day, arr]) => {
              if (!Array.isArray(arr)) return;
              next[day] = arr.map((label, i) => ({ id: `db-${day}-${i}`, label }));
            });
            return next;
          });
        }
      } catch {
        // ignore, keep defaults
      }
    }
    loadTemplates();
    return () => { mounted = false; };
  }, []);

  async function markItemComplete(id: string, resolution: string) {
    // optimistic update: remove locally first
    const prevItems = dmItems;
    setDmItems((items) => items.filter((i) => String(i.id) !== String(id)));
    setSelectedItem(null);
    try {
      const res = await fetch(`/api/cadence/dm-list?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", resolutionType: resolution }),
      });
      if (!res.ok) throw new Error("Update failed");
      // re-sync from server
      await fetchDmList();
      setStatusMessage("Item marked complete");
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.error("Failed to mark complete", err);
      // rollback
      setDmItems(prevItems);
      setDmError("Failed to update item");
      setStatusMessage("Failed to mark item complete");
      setTimeout(() => setStatusMessage(null), 4000);
    }
  }

  async function setItemPending(id: string, resolution?: string) {
    // optimistic: set item status locally, then call server
    const prevItems = dmItems;
    setDmItems((items) => items.map((i) => (String(i.id) === String(id) ? { ...i, status: "Open" } : i)));
    setSelectedItem(null);
    try {
      const res = await fetch(`/api/cadence/dm-list?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending", resolutionType: resolution }),
      });
      if (!res.ok) throw new Error("Update failed");
      await fetchDmList();
      setStatusMessage("Item set to pending");
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.error("Failed to set pending", err);
      setDmItems(prevItems);
      setDmError("Failed to update item");
      setStatusMessage("Failed to update item");
      setTimeout(() => setStatusMessage(null), 4000);
    }
  }

  return (
    <section>
      <div className="mb-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800/40"
        >
          ← Back
        </button>
      </div>

      {/* Top: Overview + KPI grid (wrapped in a shaded container so content is left-aligned) */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-1 rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
          <h2 className="text-lg font-semibold text-white">Cadence Overview</h2>
          <p className="text-sm text-slate-300">Daily + weekly task templates with auto-tracking for DM compliance.</p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {KPI_MOCK.map((k) => (
              <div key={k.id} className="rounded-lg border border-slate-800/40 bg-slate-900/40 p-4">
                <div className="text-sm text-slate-400">{k.label}</div>
                <div className="mt-2 text-2xl font-bold text-white">{k.value}</div>
              </div>
            ))}
          </div>

          {/* Today's deposit & cash summary (still inside shaded container) */}
          <div className="mt-8 rounded-lg border border-slate-800/40 bg-slate-900/40 p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Today&apos;s Deposit & Cash Summary</h3>
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
                    <td className="py-2">Alignment Shop 18</td>
                    <td className="text-center">✅</td>
                    <td className="text-right">+$12.00</td>
                  </tr>
                  <tr className="border-t border-slate-800/40">
                    <td className="py-2">Alignment Shop 447</td>
                    <td className="text-center">❌</td>
                    <td className="text-right">-$4.50</td>
                  </tr>
                  <tr className="border-t border-slate-800/40">
                    <td className="py-2">Alignment Shop 448</td>
                    <td className="text-center">✅</td>
                    <td className="text-right">+$29.50</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column: compact stack for DM List + Daily Workflow (top-aligned, fills half page) */}
        <div className="md:col-span-1 flex flex-col gap-4">
          <DmListPanel
            items={dmItems}
            filter={dmFilter}
            setFilter={(f) => {
              setDmFilter(f);
              setPage(1);
            }}
            loading={loadingDm}
            error={dmError}
            onSelect={(it) => setSelectedItem(it)}
            onRefresh={() => fetchDmList()}
            page={page}
            setPage={(n) => setPage(n)}
          />

          <div className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold text-white">Daily Workflow</div>
                <div className="text-xs text-slate-400">Quick checklist for the selected day</div>
              </div>
              {canEditCadence && (
                <div className="flex items-center gap-2">
                  {!editing ? (
                    <button onClick={() => {
                      const lines = (tasksByDay[activeDay] ?? []).map((t) => t.label).join('\n');
                      setEditText(lines);
                      setEditing(true);
                    }} className="px-2 py-1 rounded-md text-xs bg-emerald-600/30">Edit Templates</button>
                  ) : (
                    <>
                      <button onClick={() => setEditing(false)} className="px-2 py-1 rounded-md text-xs bg-slate-700/40">Cancel</button>
                      <button onClick={async () => {
                        const lines = editText.split('\n').map((s) => s.trim()).filter(Boolean);
                        const next = { ...tasksByDay, [activeDay]: lines.map((l, i) => ({ id: `db-${activeDay}-${i}`, label: l })) };
                        setTasksByDay(next);
                        try {
                          await fetch('/api/cadence/templates', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ scope: 'company', scopeId: null, day: activeDay, tasks: lines }),
                          });
                        } catch {
                          // ignore
                        }
                        setEditing(false);
                      }} className="px-2 py-1 rounded-md text-xs bg-emerald-600/60">Save</button>
                    </>
                  )}
                </div>
              )}
            </div>

            {editing ? (
              <div>
                <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full min-h-[120px] bg-slate-900 text-white p-2 rounded-md border border-slate-800" />
                <div className="mt-2 text-xs text-slate-400">One task per line. Save will persist company-scoped template.</div>
              </div>
            ) : (
              <DailyWorkflowSidebar activeDay={activeDay} setActiveDay={setActiveDay} tasks={tasksByDay} />
            )}
          </div>
        </div>
      </div>

      {/* Modal for updating a DM list item */}
      {selectedItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-md bg-slate-900 p-6">
            <h3 className="text-lg font-semibold text-white">Update Request</h3>
            <div className="mt-3 text-sm text-slate-300">
              <div><strong>Shop:</strong> {selectedItem?.shopName ?? selectedItem?.shopNumber ?? '—'}</div>
              <div className="mt-2"><strong>Message:</strong> {selectedItem?.message}</div>
              <div className="mt-2 text-xs text-slate-400">Created: {new Date(selectedItem?.createdAt ?? Date.now()).toLocaleString()}</div>
            </div>

            <div className="mt-4">
              <div className="text-sm text-slate-300">Resolution Type</div>
              <div className="mt-2 flex gap-2">
                <label className={`px-3 py-1 rounded-md ${resolutionType === 'complete' ? 'bg-emerald-600/40' : 'bg-slate-800/30'}`}>
                  <input className="mr-2" type="radio" name="resolution" checked={resolutionType === 'complete'} onChange={() => setResolutionType('complete')} /> Complete
                </label>
                <label className={`px-3 py-1 rounded-md ${resolutionType === 'called_in' ? 'bg-emerald-600/40' : 'bg-slate-800/30'}`}>
                  <input className="mr-2" type="radio" name="resolution" checked={resolutionType === 'called_in'} onChange={() => setResolutionType('called_in')} /> Called in
                </label>
                <label className={`px-3 py-1 rounded-md ${resolutionType === 'ordered' ? 'bg-emerald-600/40' : 'bg-slate-800/30'}`}>
                  <input className="mr-2" type="radio" name="resolution" checked={resolutionType === 'ordered'} onChange={() => setResolutionType('ordered')} /> Ordered
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setSelectedItem(null)} className="rounded-md border border-slate-700 px-4 py-2 text-sm">Cancel</button>
              <button onClick={() => selectedItem && setItemPending(selectedItem.id, resolutionType)} className="rounded-md bg-yellow-600 px-4 py-2 text-sm">Pending</button>
              <button onClick={() => selectedItem && markItemComplete(selectedItem.id, resolutionType)} className="rounded-md bg-emerald-600 px-4 py-2 text-sm">Mark as Complete</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Status message (simple transient toast substitute) */}
      {statusMessage ? (
        <div className="fixed right-6 top-24 z-50 rounded-md bg-slate-800/80 px-4 py-2 text-sm text-white">{statusMessage}</div>
      ) : null}
    </section>
  );
}

export default CadenceWorkflow;

