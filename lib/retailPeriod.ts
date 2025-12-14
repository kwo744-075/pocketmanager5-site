import type { SupabaseClient } from "@supabase/supabase-js";

export async function getCurrentPeriod(supabaseClient: SupabaseClient) {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabaseClient
      .from("retail_calendar")
      .select("year,period_no,start_date,end_date")
      .lte("start_date", now)
      .gte("end_date", now)
      .limit(1)
      .single();
    if (error) return null;
    return data as { year: number; period_no: number } | null;
  } catch (e) {
    return null;
  }
}

export async function getDefaultAwardsPeriod(supabaseClient: SupabaseClient) {
  const current = await getCurrentPeriod(supabaseClient);
  if (!current) return null;
  let { year, period_no } = current;
  if (period_no === 1) {
    return { year: year - 1, period_no: 12 };
  }
  return { year, period_no: period_no - 1 };
}

export default getDefaultAwardsPeriod;
import { supabase } from "@/lib/supabaseClient";

export type RetailPeriod = {
  year: number;
  period_no: number;
  fromCalendar: boolean;
  message?: string;
};

export async function getDefaultRetailPeriod(): Promise<RetailPeriod> {
  const today = new Date().toISOString().slice(0, 10);

  // Try to find the retail period where today is between start_date and end_date
  const { data, error } = await supabase
    .from("public.retail_calendar")
    .select("year,period_no,start_date,end_date")
    .lte("start_date", today)
    .gte("end_date", today)
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      year: new Date().getFullYear(),
      period_no: 1,
      fromCalendar: false,
      message: `Retail calendar query failed: ${error.message}`,
    };
  }

  if (data && data.period_no != null && data.year != null) {
    let prevPeriod = Number(data.period_no) - 1;
    let y = Number(data.year);
    if (prevPeriod < 1) {
      prevPeriod = 12;
      y = y - 1;
    }
    return { year: y, period_no: prevPeriod, fromCalendar: true };
  }

  // Fallback: current year, period 1 with visible warning
  return {
    year: new Date().getFullYear(),
    period_no: 1,
    fromCalendar: false,
    message: "No matching retail period found; defaulting to period 1",
  };
}

export async function getRetailPeriods(): Promise<Array<{ year: number; period_no: number; start_date?: string; end_date?: string }>> {
  const { data, error } = await supabase
    .from("public.retail_calendar")
    .select("year,period_no,start_date,end_date")
    .order("year", { ascending: false })
    .order("period_no", { ascending: false });

  if (error || !data) return [];
  return (data as any[]).map((r) => ({ year: Number(r.year), period_no: Number(r.period_no), start_date: r.start_date, end_date: r.end_date }));
}
