"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  getSchedules,
  createShift,
  updateShift,
  deleteShift,
  subscribeToChanges,
} from "@/hooks/useEmployeeScheduling";

type Staff = {
  id: string;
  staff_name?: string | null;
  primary_role?: string | null;
};

type Shift = {
  id?: string;
  employee_id: string;
  shop_id: string;
  date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  kind?: string | null;
};

type Projections = {
  formulation_factor: number | null;
  sunday_cars: number | null;
  monday_cars: number | null;
  tuesday_cars: number | null;
  wednesday_cars: number | null;
  thursday_cars: number | null;
  friday_cars: number | null;
  saturday_cars: number | null;
};

type Props = {
  shopNumber: string | null;
};

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_FORMULATION = 0.79;

const toISODate = (d: Date) => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
};

const startOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
};

const addDays = (date: Date, n: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

const calculateHours = (start?: string | null, end?: string | null, breakMinutes?: number | null) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map((v) => Number(v) || 0);
  const [eh, em] = end.split(":").map((v) => Number(v) || 0);
  const startTotal = sh * 60 + sm;
  const endTotal = eh * 60 + em;
  let diff = endTotal - startTotal;
  if (diff < 0) diff += 24 * 60;
  return Math.max(0, (diff - (breakMinutes ?? 0)) / 60);
};

const fmt = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });

export default function SchedulerGridEditor({ shopNumber }: Props) {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [projections, setProjections] = useState<Projections | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [editorState, setEditorState] = useState<{
    employeeId: string;
    date: string;
    shiftId?: string;
    start: string;
    end: string;
    breakMinutes: number;
  } | null>(null);

  // Copy / Paste week state
  const [copyWeek, setCopyWeek] = useState<string | null>(null);
  const [pasteWeek, setPasteWeek] = useState<string | null>(null);
  const [copiedShifts, setCopiedShifts] = useState<Shift[]>([]);
  const [availableWeeks, setAvailableWeeks] = useState<Array<{ iso: string; label: string }>>([]);
  const [showPasteConfirm, setShowPasteConfirm] = useState(false);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, idx) => {
      const date = addDays(weekStart, idx);
      return { iso: toISODate(date), label: DAY_LABELS[idx], isToday: toISODate(date) === toISODate(new Date()) };
    });
  }, [weekStart]);

  const projectionHoursByDay = useMemo(() => {
    const factor = projections?.formulation_factor ?? DEFAULT_FORMULATION;
    const hours: Record<string, number> = {};
    DAY_KEYS.forEach((key, idx) => {
      const cars = projections?.[`${key}_cars` as const] ?? 0;
      const dayIso = weekDays[idx]?.iso;
      if (dayIso) hours[dayIso] = Math.round(cars * factor * 10) / 10;
    });
    return hours;
  }, [projections, weekDays]);

  const shiftByEmployeeDay = useMemo(() => {
    const map = new Map<string, Shift[]>();
    shifts.forEach((shift) => {
      if (shift.kind && shift.kind !== "shift") return;
      const key = `${shift.employee_id}-${shift.date}`;
      const arr = map.get(key) ?? [];
      arr.push(shift);
      map.set(key, arr);
    });
    return map;
  }, [shifts]);

  const weeklyHours = useMemo(() => {
    const totals = new Map<string, number>();
    staff.forEach((s) => totals.set(s.id, 0));
    shifts.forEach((shift) => {
      if (shift.kind && shift.kind !== "shift") return;
      const hours = calculateHours(shift.start_time, shift.end_time, shift.break_minutes);
      totals.set(shift.employee_id, (totals.get(shift.employee_id) ?? 0) + hours);
    });
    return totals;
  }, [shifts, staff]);

  const weekStartISO = toISODate(weekStart);
  const weekEndISO = toISODate(addDays(weekStart, 6));

  useEffect(() => {
    if (!shopNumber) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopNumber, weekStartISO]);

  // Keep the editor in sync with external changes (app or other browser)
  useEffect(() => {
    if (!shopNumber) return;
    const unsub = subscribeToChanges(shopNumber, () => void loadData());
    return () => {
      try {
        unsub();
      } catch (_err) {
        void _err;
      }
    };
    // intentionally depend on shopNumber only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopNumber]);

  // Build week options (-8 .. +8 from current)
  useEffect(() => {
    const weeks: Array<{ iso: string; label: string }> = [];
    const base = startOfWeek(new Date());
    for (let i = -8; i <= 8; i += 1) {
      const w = addDays(base, i * 7);
      const iso = toISODate(w);
      const label = `${iso.slice(5)} (${iso})`;
      weeks.push({ iso, label });
    }
    setAvailableWeeks(weeks);
  }, []);

  // Build available week options (-8 .. +8 weeks)
  useEffect(() => {
    const weeks: Array<{ iso: string; label: string }> = [];
    const base = startOfWeek(new Date());
    for (let i = -8; i <= 8; i++) {
      const w = addDays(base, i * 7);
      const iso = toISODate(w);
      const label = `${iso.slice(5, 7)}/${iso.slice(8)} · ${iso}`;
      weeks.push({ iso, label });
    }
    setAvailableWeeks(weeks);
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      if (shopNumber) {
        const { staff, shifts, projections } = await getSchedules(shopNumber, weekStartISO);
        setStaff(staff ?? []);
        setShifts(shifts ?? []);
        setProjections((projections as Projections) ?? null);
      }
    } catch (err) {
      console.error("Scheduler load error", err);
      setMessage("Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }

  const totalScheduled = useMemo(() => {
    return shifts.reduce((sum, shift) => sum + calculateHours(shift.start_time, shift.end_time, shift.break_minutes), 0);
  }, [shifts]);

  const totalAllowed = useMemo(() => Object.values(projectionHoursByDay).reduce((sum, h) => sum + h, 0), [projectionHoursByDay]);

  const handleOpenEditor = (employeeId: string, date: string, existing?: Shift) => {
    const defaultStart = existing?.start_time ?? "09:00";
    const defaultEnd = existing?.end_time ?? "17:00";
    const defaultBreak = existing?.break_minutes ?? 0;
    setEditorState({
      employeeId,
      date,
      shiftId: existing?.id,
      start: defaultStart,
      end: defaultEnd,
      breakMinutes: defaultBreak,
    });
    setMessage(null);
  };

  const handleSave = async () => {
    if (!shopNumber || !editorState) return;
    const payload = {
      id: editorState.shiftId,
      shop_id: shopNumber,
      employee_id: editorState.employeeId,
      date: editorState.date,
      start_time: editorState.start,
      end_time: editorState.end,
      break_minutes: editorState.breakMinutes,
      kind: "shift",
    } as Record<string, unknown>;

    setSaving(true);
    setMessage(null);
    try {
      if (editorState.shiftId) {
        await updateShift(payload);
      } else {
        await createShift(payload);
      }
      setMessage("Saved");
      setEditorState(null);
      await loadData();
    } catch (err) {
      console.error("Save shift failed", err);
      setMessage("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editorState?.shiftId) return;
    setSaving(true);
    try {
      await deleteShift(editorState.shiftId);
      setMessage("Deleted");
      setEditorState(null);
      await loadData();
    } catch (err) {
      console.error("Delete shift failed", err);
      setMessage("Delete failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyWeek = async () => {
    if (!copyWeek || !shopNumber) {
      setMessage("Select a week to copy");
      return;
    }

    try {
      setLoading(true);
      const end = toISODate(addDays(new Date(copyWeek), 6));
      const { data, error } = await supabase
        .from("employee_shifts")
        .select("*")
        .eq("shop_id", shopNumber)
        .gte("date", copyWeek)
        .lte("date", end);
      if (error) throw error;
      setCopiedShifts(Array.isArray(data) ? (data as Shift[]) : []);
      setMessage(`Copied ${Array.isArray(data) ? data.length : 0} shifts`);
    } catch (err) {
      console.error("Copy week failed", err);
      setMessage("Copy failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePasteWeek = async () => {
    if (!pasteWeek || !copyWeek || copiedShifts.length === 0 || !shopNumber) {
      setMessage("Select copy + paste weeks and copy shifts first");
      return;
    }

    setShowPasteConfirm(false);
    try {
      setSaving(true);
      const copyStart = new Date(copyWeek);
      const pasteStart = new Date(pasteWeek);
      const daysDiff = Math.floor((pasteStart.getTime() - copyStart.getTime()) / (1000 * 60 * 60 * 24));

      const newShifts = copiedShifts.map((s) => {
        const original = new Date(s.date);
        const newDate = toISODate(addDays(original, daysDiff));
        return {
          employee_id: s.employee_id,
          shop_id: shopNumber,
          date: newDate,
          start_time: s.start_time,
          end_time: s.end_time,
          break_minutes: s.break_minutes,
          kind: s.kind ?? "shift",
        } as Shift;
      });

      // Use server endpoint to perform bulk insert (safer for large writes / admin role)
      const resp = await fetch("/api/pocket-manager/employee-shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bulk_insert", payload: newShifts }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        throw new Error(json?.error ?? "Bulk insert failed");
      }
      setMessage(`Pasted ${json.inserted ?? newShifts.length} shifts`);
      if (pasteWeek === weekStartISO) await loadData();
    } catch (err) {
      console.error("Paste week failed", err);
      setMessage("Paste failed");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPasteConfirm = () => {
    if (!pasteWeek || !copyWeek || copiedShifts.length === 0) {
      setMessage("Select weeks and copy shifts before pasting");
      return;
    }
    setShowPasteConfirm(true);
  };

  const hourColor = (hours: number) => {
    if (hours > 40) return "text-rose-200";
    if (hours > 32) return "text-amber-200";
    return "text-emerald-200";
  };

  return (
    <section className="mt-4 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Week grid (editable)</p>
          <h3 className="text-xl font-semibold text-white">Schedule editor</h3>
          <p className="text-sm text-slate-400">Autosaves through the Pocket Manager API route with admin writes.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart((d) => addDays(d, -7))}
            className="rounded-md border border-slate-700/70 px-3 py-1 text-sm text-slate-200"
          >
            ← Prev
          </button>
          <div className="rounded-md border border-slate-700/70 px-3 py-1 text-sm text-slate-200">
            {weekStartISO} → {weekEndISO}
          </div>
          <button
            type="button"
            onClick={() => setWeekStart((d) => addDays(d, 7))}
            className="rounded-md border border-slate-700/70 px-3 py-1 text-sm text-slate-200"
          >
            Next →
          </button>
        </div>
      </div>

      {message ? <div className="mt-2 text-sm text-emerald-200">{message}</div> : null}
      {loading ? <div className="mt-3 text-sm text-slate-300">Loading…</div> : null}

      {!shopNumber ? (
        <p className="mt-4 text-sm text-slate-400">Select a shop to edit the schedule.</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-3">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Scheduled</p>
              <p className="text-xl font-semibold text-white">{fmt(totalScheduled)} hrs</p>
            </div>
            <div className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-3">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Allowed</p>
              <p className="text-xl font-semibold text-white">{fmt(totalAllowed)} hrs</p>
            </div>
            <div className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-3">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Variance</p>
              <p className="text-xl font-semibold text-white">{fmt(totalScheduled - totalAllowed)} hrs</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Copy & paste week</p>
                <p className="text-sm text-slate-300">Clone shifts from a source week to a target week.</p>
              </div>
              <div className="text-xs text-emerald-200">{copiedShifts.length} copied</div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <label className="text-xs text-slate-400">
                Week to copy
                <select
                  value={copyWeek ?? ""}
                  onChange={(e) => setCopyWeek(e.target.value || null)}
                  className="mt-1 w-full rounded-md border border-slate-700/70 bg-slate-900/70 px-2 py-1 text-sm text-slate-100"
                >
                  <option value="">Select week</option>
                  {availableWeeks.map((w) => (
                    <option key={w.iso} value={w.iso}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => void handleCopyWeek()}
                  disabled={!copyWeek || loading || saving}
                  className="w-full rounded-md border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-100 disabled:opacity-50"
                >
                  Copy week
                </button>
              </div>
              <label className="text-xs text-slate-400">
                Week to paste
                <select
                  value={pasteWeek ?? ""}
                  onChange={(e) => setPasteWeek(e.target.value || null)}
                  className="mt-1 w-full rounded-md border border-slate-700/70 bg-slate-900/70 px-2 py-1 text-sm text-slate-100"
                >
                  <option value="">Select week</option>
                  {availableWeeks.map((w) => (
                    <option key={w.iso} value={w.iso}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleOpenPasteConfirm}
                  disabled={!pasteWeek || !copyWeek || copiedShifts.length === 0 || saving || loading}
                  className="w-full rounded-md border border-emerald-400/60 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-50"
                >
                  Paste week
                </button>
              </div>
            </div>
          </div>

          {showPasteConfirm ? (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80">
              <div className="w-full max-w-md rounded-2xl border border-slate-800/80 bg-slate-950/95 p-6 shadow-2xl">
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Confirm paste</p>
                <h4 className="mt-2 text-xl font-semibold text-white">Paste {copiedShifts.length} shifts?</h4>
                <p className="mt-1 text-sm text-slate-300">
                  Copy week <span className="font-mono text-emerald-200">{copyWeek}</span> → Paste week <span className="font-mono text-emerald-200">{pasteWeek}</span>. Existing shifts remain.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPasteConfirm(false)}
                    className="rounded-md border border-slate-700/70 px-3 py-1.5 text-sm text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handlePasteWeek()}
                    disabled={saving}
                    className="rounded-md border border-emerald-400/70 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-100 disabled:opacity-60"
                  >
                    {saving ? "Pasting…" : "Confirm paste"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">Employee</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-right">Hours</th>
                  {weekDays.map((d) => (
                    <th key={d.iso} className="px-3 py-2 text-center">
                      <div className="text-slate-300">{d.label}</div>
                      <div className="text-xs text-slate-500">{d.iso.slice(5)}</div>
                      <div className="text-[11px] text-emerald-200">{fmt(projectionHoursByDay[d.iso] ?? 0)}h</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {staff.length === 0 ? (
                  <tr>
                    <td colSpan={3 + weekDays.length} className="px-3 py-4 text-sm text-slate-400">
                      No teammates found for this shop.
                    </td>
                  </tr>
                ) : (
                  staff.map((emp) => (
                    <tr key={emp.id}>
                      <td className="px-3 py-2 font-semibold text-white">{emp.staff_name ?? "Unnamed"}</td>
                      <td className="px-3 py-2 text-slate-400">{emp.primary_role ?? "—"}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${hourColor(weeklyHours.get(emp.id) ?? 0)}`}>
                        {fmt(weeklyHours.get(emp.id) ?? 0)}h
                      </td>
                      {weekDays.map((d) => {
                        const key = `${emp.id}-${d.iso}`;
                        const existing = shiftByEmployeeDay.get(key)?.[0];
                        const hours = existing ? calculateHours(existing.start_time, existing.end_time, existing.break_minutes) : 0;
                        const isToday = d.isToday;
                        return (
                          <td key={key} className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenEditor(emp.id, d.iso, existing)}
                              className={`w-full rounded-md border px-2 py-2 text-xs transition ${
                                existing
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100 hover:border-emerald-400/60"
                                  : "border-slate-700/70 bg-slate-900/60 text-slate-300 hover:border-slate-600/70"
                              } ${isToday ? "ring-1 ring-cyan-400/40" : ""}`}
                            >
                              {existing ? (
                                <div className="space-y-1">
                                  <div className="font-semibold">{existing.start_time} → {existing.end_time}</div>
                                  <div className="text-[11px] text-slate-200">{fmt(hours)}h · Break {existing.break_minutes}m</div>
                                </div>
                              ) : (
                                <div className="text-slate-400">Add shift</div>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {editorState ? (
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Edit shift</p>
                  <p className="text-sm text-slate-300">
                    {editorState.employeeId} • {editorState.date}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditorState(null)}
                  className="rounded-md border border-slate-700/70 px-3 py-1 text-sm text-slate-200"
                >
                  Close
                </button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-5">
                <label className="text-xs text-slate-400 sm:col-span-2">
                  Start
                  <input
                    type="time"
                    value={editorState.start}
                    onChange={(e) => setEditorState((prev) => (prev ? { ...prev, start: e.target.value } : prev))}
                    className="mt-1 w-full rounded-md border border-slate-700/70 bg-slate-900/80 px-2 py-1 text-sm text-slate-100"
                  />
                </label>
                <label className="text-xs text-slate-400 sm:col-span-2">
                  End
                  <input
                    type="time"
                    value={editorState.end}
                    onChange={(e) => setEditorState((prev) => (prev ? { ...prev, end: e.target.value } : prev))}
                    className="mt-1 w-full rounded-md border border-slate-700/70 bg-slate-900/80 px-2 py-1 text-sm text-slate-100"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Break (min)
                  <input
                    type="number"
                    min={0}
                    value={editorState.breakMinutes}
                    onChange={(e) => setEditorState((prev) => (prev ? { ...prev, breakMinutes: Number(e.target.value) || 0 } : prev))}
                    className="mt-1 w-full rounded-md border border-slate-700/70 bg-slate-900/80 px-2 py-1 text-sm text-slate-100"
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="rounded-md border border-emerald-400/70 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-100 disabled:opacity-60"
                >
                  {saving ? "Saving…" : editorState.shiftId ? "Update" : "Create"}
                </button>
                {editorState.shiftId ? (
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={saving}
                    className="rounded-md border border-rose-400/70 bg-rose-500/10 px-3 py-1 text-sm font-semibold text-rose-100 disabled:opacity-60"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
