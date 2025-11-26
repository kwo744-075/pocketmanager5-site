"use client";

import { useEffect, useState } from "react";
import { supabase, pulseSupabase } from "@/lib/supabaseClient";

type RetailRow = {
  year?: number;
  period_no?: number;
  period?: number;
  week_no?: number;
  week?: number;
  week_start?: string;
  week_start_date?: string;
  start_date?: string;
  week_end?: string;
  week_end_date?: string;
  end_date?: string;
  quarter?: number;
  weeks?: number;
};

export function RetailPills() {
  const [data, setData] = useState<{
    quarterLabel: string;
    periodLabel: string;
    weekLabel: string;
    dateLabel: string;
  } | null>(null);

  useEffect(() => {
    const fetchRetail = async () => {
      const todayISO = new Date().toISOString().slice(0, 10);
      const clients = supabase === pulseSupabase ? [supabase] : [supabase, pulseSupabase];
      let row: RetailRow | null = null;

      for (const client of clients) {
        const { data, error } = await client
          .from("retail_calendar")
          .select(
            "quarter, period_no, period, week_no, week, week_start, week_start_date, start_date, week_end, week_end_date, end_date, weeks"
          )
          .lte("start_date", todayISO)
          .gte("end_date", todayISO)
          .order("start_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("retail_calendar fetch error", error);
          continue;
        }

        if (data) {
          row = data as RetailRow;
          break;
        }
      }

      if (!row) {
        console.warn("retail_calendar returned no row for today's date");
        return;
      }

      const period = row.period_no ?? row.period;
      let weekValue = row.week_no ?? row.week;
      const quarter = row.quarter;

      const weekStartCandidate =
        row.week_start ?? row.week_start_date ?? row.start_date ?? todayISO;

      if (!weekValue && weekStartCandidate) {
        const start = new Date(weekStartCandidate);
        const today = new Date(todayISO);
        const diffDays = Math.floor(
          (today.getTime() - start.getTime()) / 86_400_000
        );
        const computedWeek = Math.floor(diffDays / 7) + 1;
        const maxWeeks = row.weeks && row.weeks > 0 ? row.weeks : undefined;
        if (maxWeeks) {
          weekValue = Math.min(Math.max(computedWeek, 1), maxWeeks);
        } else {
          weekValue = Math.max(computedWeek, 1);
        }
      }

      setData({
        quarterLabel: quarter ? `Q${quarter}` : "Q?",
        periodLabel: period ? `P${period}` : "P?",
        weekLabel: weekValue ? `Wk${weekValue}` : "Wk?",
        dateLabel: weekStartCandidate,
      });
    };

    fetchRetail();
  }, []);

  const q = data?.quarterLabel ?? "Q?";
  const p = data?.periodLabel ?? "P?";
  const w = data?.weekLabel ?? "Wk?";
  const d = data?.dateLabel ?? new Date().toISOString().slice(0, 10);

  return (
    <div className="flex items-center gap-2 text-xs font-medium">
      <span className="rounded-full bg-blue-600/90 px-3 py-1 text-white shadow-sm">
        {q}
      </span>
      <span className="rounded-full bg-emerald-600/90 px-3 py-1 text-white shadow-sm">
        {p}
      </span>
      <span className="rounded-full bg-amber-500/90 px-3 py-1 text-white shadow-sm">
        {w}
      </span>
      <span className="text-slate-200">{d}</span>
    </div>
  );
}
