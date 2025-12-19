"use client";

import { useMemo, useState } from "react";
import { getRetailPeriodInfo } from "@/app/pocket-manager5/components/dmScheduleUtils";

type WeekAssumptions = {
  weekIndex: number;
  daysOff: string[];
  adminDays: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (payload: {
    periodId: string;
    assumptions: {
      weeks: WeekAssumptions[];
      maxVisitsPerDay: number;
      allowDouble: boolean;
      preferEarlyAudit: boolean;
      proximityGroups: Array<{ label: string; shops: number[] }>;
    };
  }) => Promise<void>;
};

export function AIScheduleAssumptionsModal({ open, onOpenChange, onGenerate }: Props) {
  const period = useMemo(() => getRetailPeriodInfo(new Date()), []);
  const [maxVisitsPerDay, setMaxVisitsPerDay] = useState(2);
  const [allowDouble, setAllowDouble] = useState(false);
  const [preferEarlyAudit, setPreferEarlyAudit] = useState(true);
  const [proximityText, setProximityText] = useState("");
  const [weeks, setWeeks] = useState<WeekAssumptions[]>(
    Array.from({ length: period.weeksInPeriod }, (_, idx) => ({
      weekIndex: idx + 1,
      daysOff: [],
      adminDays: [],
    })),
  );
  const [saving, setSaving] = useState(false);

  const addDate = (weekIndex: number, field: keyof WeekAssumptions, value: string) => {
    if (!value) return;
    setWeeks((prev) =>
      prev.map((w) =>
        w.weekIndex === weekIndex
          ? { ...w, [field]: Array.from(new Set([...(w[field] as string[]), value])) }
          : w,
      ),
    );
  };

  const removeDate = (weekIndex: number, field: keyof WeekAssumptions, value: string) => {
    setWeeks((prev) =>
      prev.map((w) =>
        w.weekIndex === weekIndex ? { ...w, [field]: (w[field] as string[]).filter((d) => d !== value) } : w,
      ),
    );
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const proximityGroups =
        proximityText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line, idx) => {
            const parts = line.split(":");
            const label = parts[0]?.trim() || `Cluster ${idx + 1}`;
            const shops = (parts[1] ?? parts[0])
              .split(",")
              .map((s) => parseInt(s.trim(), 10))
              .filter((n) => !Number.isNaN(n));
            return { label, shops };
          }) ?? [];

      await onGenerate({
        periodId: `P${period.period}-${period.startDate.getFullYear()}`,
        assumptions: {
          weeks,
          maxVisitsPerDay,
          allowDouble,
          preferEarlyAudit,
          proximityGroups,
        },
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${open ? "fixed" : "hidden"} inset-0 z-[999] flex items-center justify-center bg-black/60`}>
      <div className="w-[520px] max-w-[94vw] rounded-2xl border border-white/15 bg-slate-950 p-5 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">AI Schedule</p>
            <p className="text-sm text-white">Assumptions by week (Period {period.period})</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full border border-white/15 px-2 py-1 text-xs text-white/80 hover:border-white/30"
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-white/80">
              <span className="text-xs uppercase tracking-[0.2em] text-white/60">Max visits per day</span>
              <input
                type="number"
                min={1}
                max={5}
                value={maxVisitsPerDay}
                onChange={(e) => setMaxVisitsPerDay(Number(e.target.value) || 1)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-300"
              />
            </label>
            <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2">
              <input type="checkbox" checked={allowDouble} onChange={(e) => setAllowDouble(e.target.checked)} />
              <span className="text-xs uppercase tracking-[0.2em] text-white/80">Allow double-visits same day</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 md:col-span-2">
              <input
                type="checkbox"
                checked={preferEarlyAudit}
                onChange={(e) => setPreferEarlyAudit(e.target.checked)}
              />
              <span className="text-xs uppercase tracking-[0.2em] text-white/80">Prefer quarterly audits early</span>
            </div>
          </div>

          <div className="space-y-2">
            {weeks.map((week) => (
              <div key={week.weekIndex} className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">Week {week.weekIndex}</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <div className="space-y-1 text-xs text-white/80">
                    <div className="flex items-center justify-between gap-2">
                      <span>Days off</span>
                      <input
                        type="date"
                        onChange={(e) => {
                          addDate(week.weekIndex, "daysOff", e.target.value);
                          e.target.value = "";
                        }}
                        className="rounded-lg border border-white/15 bg-slate-900 px-2 py-1 text-white"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {week.daysOff.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => removeDate(week.weekIndex, "daysOff", d)}
                          className="rounded-full border border-white/20 px-2 py-0.5 text-[11px] text-white/80 hover:border-white/40"
                        >
                          {d}
                        </button>
                      ))}
                      {!week.daysOff.length && <span className="text-[11px] text-white/50">None</span>}
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-white/80">
                    <div className="flex items-center justify-between gap-2">
                      <span>Admin day(s)</span>
                      <input
                        type="date"
                        onChange={(e) => {
                          addDate(week.weekIndex, "adminDays", e.target.value);
                          e.target.value = "";
                        }}
                        className="rounded-lg border border-white/15 bg-slate-900 px-2 py-1 text-white"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {week.adminDays.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => removeDate(week.weekIndex, "adminDays", d)}
                          className="rounded-full border border-white/20 px-2 py-0.5 text-[11px] text-white/80 hover:border-white/40"
                        >
                          {d}
                        </button>
                      ))}
                      {!week.adminDays.length && <span className="text-[11px] text-white/50">None</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/15 bg-slate-900/50 p-3 text-sm text-white/80">
            <p className="text-xs uppercase tracking-[0.25em] text-white/70">Proximity clusters</p>
            <p className="text-[12px] text-white/60">Example: Cluster A: 1501,1502,1503</p>
            <textarea
              value={proximityText}
              onChange={(e) => setProximityText(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-white/15 bg-slate-900 px-2 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-300"
              placeholder="Cluster A: 1501,1502&#10;Cluster B: 1503,1504"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-full border border-emerald-400/70 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition disabled:opacity-60"
          >
            {saving ? "Generating…" : "Generate AI schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
