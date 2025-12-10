"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import { usePocketHierarchy } from "@/hooks/usePocketHierarchy";
import { calculateHours, aggregateShifts, type ShiftRow } from "@/lib/scheduleUtils";

type Row = {
  id: string;
  staff_name: string | null;
  position: string | null;
  total_hours: number;
  overtime_hours: number;
  dayHours: Record<string, number>;
};

const startOfWeekISO = (d: Date) => {
  const copy = new Date(d);
  const day = copy.getDay();
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - day);
  return copy.toISOString().slice(0, 10);
};

const addDaysISO = (iso: string, n: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};



export default function EmployeeSchedulingTable() {
  const { needsLogin, shopMeta, hierarchy, hierarchyLoading } = usePocketHierarchy();
  const shopNumber = shopMeta?.shop_number ? String(shopMeta.shop_number) : null;

  const [weekStart, setWeekStart] = useState<string>(() => startOfWeekISO(new Date()));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const weekEnd = useMemo(() => addDaysISO(weekStart, 6), [weekStart]);

  useEffect(() => {
    if (!shopNumber) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopNumber, weekStart, page]);

  useEffect(() => {
    if (!shopNumber) return;
    let channel: any = null;
    try {
      channel = supabase
        .channel(`employee_shifts_changes_${shopNumber}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'employee_shifts', filter: `shop_id=eq.${shopNumber}` },
          () => {
            void load();
          }
        )
        .subscribe();
    } catch (err) {
      // ignore
    }

    return () => {
      try {
        if (channel) supabase.removeChannel(channel);
      } catch (e) {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopNumber]);

  async function load() {
    setLoading(true);
    try {
      // fetch shifts and staff and aggregate
      const offset = page * pageSize;
      const rangeStart = offset;
      const rangeEnd = offset + pageSize - 1;

      const [{ data: staffData, count }, { data: shiftData }] = await Promise.all([
        supabase
          .from("shop_staff")
          .select("id,staff_name,primary_role", { count: "exact" })
          .eq("shop_id", shopNumber)
          .order("staff_name")
          .range(rangeStart, rangeEnd),
        supabase
          .from("employee_shifts")
          .select("id,employee_id,date,start_time,end_time,break_minutes,kind")
          .eq("shop_id", shopNumber)
          .gte("date", weekStart)
          .lte("date", weekEnd)
          .limit(5000),
      ] as any);

      const staff = Array.isArray(staffData) ? staffData : [];
      const shifts = Array.isArray(shiftData) ? (shiftData as ShiftRow[]) : [];

      const byEmployee = aggregateShifts(shifts, weekStart, weekEnd);

      const rows: Row[] = staff.map((s: any) => {
        const agg = byEmployee.get(s.id) ?? { total: 0, overtime: 0, dayHours: {} };
        return {
          id: s.id,
          staff_name: s.staff_name ?? null,
          position: s.primary_role ?? null,
          total_hours: Math.round(agg.total * 10) / 10,
          overtime_hours: Math.round(agg.overtime * 10) / 10,
          dayHours: agg.dayHours ?? {},
        };
      });

      setRows(rows);
      setTotalCount(typeof count === "number" ? count : null);
      setMessage(null);
    } catch (err) {
      console.error("EmployeeSchedulingTable load error", err);
      setMessage("Failed to load schedules");
    } finally {
      setLoading(false);
    }
  }

  const exportCsv = () => {
    const dayCols = Array.from({ length: 7 }).map((_, i) => addDaysISO(weekStart, i));
    const header = ["Employee", "Position", ...dayCols.map((d) => d), "Total Hours", "Overtime Hours"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      const dayValues = dayCols.map((d) => String((r.dayHours?.[d] ?? 0).toFixed(1)));
      const line = [
        `"${(r.staff_name ?? "").replace(/"/g, '""')}"`,
        `"${(r.position ?? "").replace(/"/g, '""')}"`,
        ...dayValues,
        String(r.total_hours),
        String(r.overtime_hours),
      ];
      lines.push(line.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schedules_${shopNumber}_${weekStart}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mt-4 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Saved schedules</p>
          <h3 className="text-lg font-semibold text-white">Schedule table</h3>
          <p className="text-sm text-slate-400">Read-only roster view with CSV export.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className="rounded-md border border-slate-700/70 bg-slate-900/70 px-2 py-1 text-sm text-slate-100"
          />
          <button
            type="button"
            onClick={() => exportCsv()}
            disabled={rows.length === 0}
            className="rounded-md border border-emerald-400/70 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-100 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="mt-3 text-sm text-slate-400">
        {hierarchyLoading ? (
          <div>Loading scope…</div>
        ) : (
          <div>
            {hierarchy?.district_name || hierarchy?.region_name ? (
              <div className="text-sm text-slate-300">
                {hierarchy?.district_name ? <span>District: <strong className="text-white">{hierarchy?.district_name}</strong></span> : null}
                {hierarchy?.region_name ? <span className="ml-4">Region: <strong className="text-white">{hierarchy?.region_name}</strong></span> : null}
              </div>
            ) : (
              <div className="text-sm text-slate-500">Scoped to shop {shopMeta?.shop_number ?? "—"}</div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 overflow-x-auto">
        {loading ? (
          <div className="text-sm text-slate-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-400">No saved schedules for this week.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">Employee</th>
                <th className="px-3 py-2 text-left">Position</th>
                <th className="px-3 py-2 text-right">Hours</th>
                <th className="px-3 py-2 text-right">OT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-semibold text-white">{r.staff_name ?? "Unnamed"}</td>
                  <td className="px-3 py-2 text-slate-400">{r.position ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-semibold">{r.total_hours.toFixed(1)}h</td>
                  <td className="px-3 py-2 text-right text-amber-300">{r.overtime_hours.toFixed(1)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination controls */}
      <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
        <div>
          {totalCount !== null ? (
            <span>{Math.min(totalCount, pageSize * (page + 1))} of {totalCount} teammates</span>
          ) : (
            <span>{rows.length} teammates</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-md border border-slate-700/70 px-2 py-1 text-sm text-slate-200 disabled:opacity-50"
          >
            Prev
          </button>
          <div className="px-2">Page {page + 1}</div>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={totalCount !== null && (page + 1) * pageSize >= totalCount}
            className="rounded-md border border-slate-700/70 px-2 py-1 text-sm text-slate-200 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {message ? <div className="mt-2 text-sm text-rose-300">{message}</div> : null}
    </section>
  );
}
