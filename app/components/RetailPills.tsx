"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchRetailContext, type RetailContext } from "@/lib/retailCalendar";
import { buildRetailTimestampLabel } from "@/lib/retailTimestamp";

const formatRetailDate = (value: string | null | undefined): string => {
  if (!value) {
    return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = isoMatch
    ? new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export function RetailPills() {
  const [data, setData] = useState<RetailContext | null>(null);
  const fallback = useMemo(() => {
    const label = buildRetailTimestampLabel();
    const [phase, rawDate] = label.split(" ");
    const [quarterPart, periodPart, weekPart] = (phase ?? "").split("-");
    return {
      quarterLabel: quarterPart ?? "Q?",
      periodLabel: periodPart ?? "P?",
      weekLabel: weekPart ? weekPart.replace(/^W/, "Wk") : "Wk?",
      dateLabel: rawDate ?? new Date().toISOString().slice(0, 10),
    } satisfies RetailContext;
  }, []);

  useEffect(() => {
    const run = async () => {
      const context = await fetchRetailContext();
      if (context) {
        setData(context);
      }
    };

    run();
  }, []);

  const q = data?.quarterLabel ?? fallback.quarterLabel;
  const p = data?.periodLabel ?? fallback.periodLabel;
  const w = data?.weekLabel ?? fallback.weekLabel;
  const d = formatRetailDate(data?.dateLabel ?? fallback.dateLabel);

  const pillBase = "rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-white";

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-slate-200">
      <span className={`${pillBase} bg-blue-500/90`}>{q}</span>
      <span className={`${pillBase} bg-emerald-500/90`}>{p}</span>
      <span className={`${pillBase} bg-amber-500/90`}>{w}</span>
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{d}</span>
    </div>
  );
}
