"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchRetailContext, type RetailContext } from "@/lib/retailCalendar";
import { buildRetailTimestampLabel } from "@/lib/retailTimestamp";
import Chip from "@/app/components/Chip";

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

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-slate-200">
      <Chip label={q} tintColor="#0ea5e9" />
      <Chip label={p} tintColor="#10b981" />
      <Chip label={w} tintColor="#f59e0b" />
      <span className="text-[10px] uppercase tracking-wide text-slate-300" style={{ textShadow: "none" }}>
        {d}
      </span>
    </div>
  );
}
