"use client";

import { useEffect, useState } from "react";
import { pulseSupabase } from "@/lib/supabaseClient";
import Link from "next/link";

type CheckInRow = {
  shop_id?: string | null;
  check_in_date?: string | null;
  time_slot: string | null;
  cars: number | null;
  sales: number | null;
  big4: number | null;
  coolants: number | null;
  diffs: number | null;
  fuel_filters?: number | null;
  donations: number | null;
  mobil1: number | null;
  temperature: string | null;
  is_submitted: boolean | null;
  submitted_at: string | null;
};

export default function DailyCheckinsViewer({ date }: { date: string }) {
  const [rows, setRows] = useState<CheckInRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { data, error } = await pulseSupabase
          .from("check_ins")
          .select("shop_id,check_in_date,time_slot,cars,sales,big4,coolants,diffs,fuel_filters,donations,mobil1,is_submitted,submitted_at")
          .eq("check_in_date", date)
          .order("shop_id", { ascending: true })
          .order("time_slot", { ascending: true });

        if (!mounted) return;
        if (error) {
          console.error("DailyCheckinsViewer fetch error", error);
          setError(error.message ?? "Unable to load check-ins");
          setRows([]);
        } else {
          setRows((data ?? []) as CheckInRow[]);
        }
      } catch (err) {
        console.error("DailyCheckinsViewer error", err);
        setError("Unexpected error loading check-ins");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [date]);

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Check-ins for {date}</h2>
        <Link href="/pulse-check5" className="text-sm text-emerald-300">Back</Link>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p className="text-rose-400">{error}</p>}

      {!loading && rows && rows.length === 0 && <p>No check-ins found for this date.</p>}

      {!loading && rows && rows.length > 0 && (
        <div className="overflow-auto">
          <table className="w-full text-sm table-auto border-collapse">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="p-2">Shop</th>
                <th className="p-2">Time</th>
                <th className="p-2">Cars</th>
                <th className="p-2">Sales</th>
                <th className="p-2">Big4</th>
                <th className="p-2">Coolants</th>
                <th className="p-2">Diffs</th>
                <th className="p-2">FF</th>
                <th className="p-2">Mobil1</th>
                <th className="p-2">Donations</th>
                <th className="p-2">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx} className="border-t border-white/6">
                  <td className="p-2">{r.shop_id ?? "-"}</td>
                  <td className="p-2">{r.time_slot ?? "-"}</td>
                  <td className="p-2">{r.cars ?? 0}</td>
                  <td className="p-2">{r.sales ?? 0}</td>
                  <td className="p-2">{r.big4 ?? 0}</td>
                  <td className="p-2">{r.coolants ?? 0}</td>
                  <td className="p-2">{r.diffs ?? 0}</td>
                  <td className="p-2">{r.fuel_filters ?? 0}</td>
                  <td className="p-2">{r.mobil1 ?? 0}</td>
                  <td className="p-2">{r.donations ?? 0}</td>
                  <td className="p-2">{r.is_submitted ? String(r.submitted_at ?? "submitted") : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
