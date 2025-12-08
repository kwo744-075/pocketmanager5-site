import { supabase, pulseSupabase } from "@/lib/supabaseClient";

export type RetailContext = {
  quarterLabel: string;
  periodLabel: string;
  weekLabel: string;
  dateLabel: string;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export async function fetchRetailContext(targetDate?: string): Promise<RetailContext | null> {
  const date = targetDate ?? todayISO();
  const clients = supabase === pulseSupabase ? [supabase] : [supabase, pulseSupabase];

  type RetailRow = {
    quarter?: number;
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
    weeks?: number;
  };

  let row: RetailRow | null = null;

  for (const client of clients) {
    const { data, error } = await client
      .from("retail_calendar")
      .select(
        "quarter, period_no, period, week_no, week, week_start, week_start_date, start_date, week_end, week_end_date, end_date, weeks"
      )
      .lte("start_date", date)
      .gte("end_date", date)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("retail_calendar fetch warning", { message: error.message, hint: "falling back to secondary client" });
      continue;
    }

    if (data) {
      row = data as RetailRow;
      break;
    }
  }

  if (!row) {
    console.warn("retail_calendar returned no row for the provided date");
    return null;
  }

  const period = row.period_no ?? row.period;
  let weekValue = row.week_no ?? row.week;
  const quarter = row.quarter;
  const weekStartCandidate = row.week_start ?? row.week_start_date ?? row.start_date ?? date;

  if (!weekValue && weekStartCandidate) {
    const start = new Date(weekStartCandidate);
    const today = new Date(date);
    const diffDays = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
    const computedWeek = Math.floor(diffDays / 7) + 1;
    const maxWeeks = row.weeks && row.weeks > 0 ? row.weeks : undefined;
    if (maxWeeks) {
      weekValue = Math.min(Math.max(computedWeek, 1), maxWeeks);
    } else {
      weekValue = Math.max(computedWeek, 1);
    }
  }

  return {
    quarterLabel: quarter ? `Q${quarter}` : "Q?",
    periodLabel: period ? `P${period}` : "P?",
    weekLabel: weekValue ? `Wk${weekValue}` : "Wk?",
    dateLabel: weekStartCandidate,
  };
}
