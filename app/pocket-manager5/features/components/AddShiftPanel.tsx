"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  shopNumber: string | null;
};

export default function AddShiftPanel({ shopNumber }: Props) {
  const [staff, setStaff] = useState<Array<{ id: string; staff_name?: string }>>([]);
  const [employeeId, setEmployeeId] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState<string>("09:00");
  const [endTime, setEndTime] = useState<string>("17:00");
  const [breakMinutes, setBreakMinutes] = useState<number>(30);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!shopNumber) return;
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.from("shop_staff").select("id, staff_name").eq("shop_id", shopNumber).order("staff_name");
        if (mounted && Array.isArray(data)) setStaff(data as any);
      } catch (err) {
        console.warn("Failed to load staff list", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [shopNumber]);

  const canSave = Boolean(shopNumber && employeeId && date && startTime && endTime);

  useEffect(() => {
    // simple autosave: save when form is complete
    if (!canSave) return;
    const t = setTimeout(() => {
      void saveShift();
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, date, startTime, endTime, breakMinutes]);

  async function saveShift() {
    if (!canSave) return;
    setSaving(true);
    setMessage(null);
    try {
      const resp = await fetch("/api/pocket-manager/employee-shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          payload: {
            shop_id: shopNumber,
            employee_id: employeeId,
            date,
            start_time: startTime,
            end_time: endTime,
            break_minutes: breakMinutes,
            kind: "shift",
          },
        }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setMessage(json?.error ?? "Unable to save");
      } else {
        setMessage("Saved");
      }
    } catch (err) {
      console.error(err);
      setMessage("Save failed");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 2000);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
      <p className="text-sm font-semibold text-white">Add shift</p>
      {!shopNumber ? (
        <p className="text-xs text-slate-400 mt-2">Select a shop to add shifts.</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="rounded-md border bg-slate-800/50 px-2 py-1 text-sm text-slate-100"
          >
            <option value="">Select teammate</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.staff_name ?? s.id}
              </option>
            ))}
          </select>

          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md border bg-slate-800/50 px-2 py-1 text-sm text-slate-100" />

          <div className="flex gap-2">
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded-md border bg-slate-800/50 px-2 py-1 text-sm text-slate-100" />
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="rounded-md border bg-slate-800/50 px-2 py-1 text-sm text-slate-100" />
          </div>

          <input type="number" min={0} value={breakMinutes} onChange={(e) => setBreakMinutes(Number(e.target.value) || 0)} className="rounded-md border bg-slate-800/50 px-2 py-1 text-sm text-slate-100" />

          <div className="sm:col-span-2">
            <button
              onClick={() => void saveShift()}
              disabled={!canSave || saving}
              className="rounded-md border border-emerald-400/60 px-3 py-1 text-sm font-semibold text-emerald-100 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {message ? <span className="ml-2 text-sm text-slate-300">{message}</span> : null}
          </div>
        </div>
      )}
    </div>
  );
}
