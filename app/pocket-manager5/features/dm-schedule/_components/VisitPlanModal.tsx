"use client";

import { useEffect, useMemo, useState } from "react";
import { getRetailPeriodInfo } from "@/app/pocket-manager5/components/dmScheduleUtils";
import { supabase } from "@/lib/supabaseClient";

type VisitPlanModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string | null;
  shopNumber: string | null;
  initialVisit?: { visitType?: string; notes?: string };
  onSaved?: () => void;
};

const VISIT_TYPES = [
  "Night Visit",
  "Plan To Win",
  "Standard Visit",
  "Quarterly Audit",
  "Training Visit",
  "1 on 1",
  "Admin",
  "Off",
  "Project Day",
  "Discussion Visit",
  "In Person",
  "Teams meet",
  "RDO Visit",
];

export function VisitPlanModal({ open, onOpenChange, date, shopNumber, initialVisit, onSaved }: VisitPlanModalProps) {
  const [visitType, setVisitType] = useState<string>(initialVisit?.visitType ?? "Standard Visit");
  const [shop, setShop] = useState<string>(shopNumber ?? "");
  const [notes, setNotes] = useState<string>(initialVisit?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const canSubmit = Boolean(date && shop);

  useEffect(() => {
    setVisitType(initialVisit?.visitType ?? "Standard Visit");
    setNotes(initialVisit?.notes ?? "");
  }, [initialVisit?.notes, initialVisit?.visitType, open]);

  useEffect(() => {
    setShop(shopNumber ?? "");
  }, [shopNumber, open]);

  const periodId = useMemo(() => {
    if (!date) return null;
    const info = getRetailPeriodInfo(new Date(date));
    return `P${info.period}-${info.startDate.getFullYear()}`;
  }, [date]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await supabase.from("dm_schedule").upsert({
        period_id: periodId,
        visit_date: date,
        shop_number: Number(shop),
        visit_type: visitType,
        notes,
        source: "manual",
      });
      onSaved?.();
      onOpenChange(false);
      setNotes("");
    } catch (err) {
      console.error("visit plan save failed", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${open ? "fixed" : "hidden"} inset-0 z-[999] flex items-center justify-center bg-black/60`}>
      <div className="w-[420px] max-w-[94vw] rounded-2xl border border-white/15 bg-slate-950 p-4 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">Visit plan</p>
            <p className="text-sm text-white">{date ? new Date(date).toLocaleDateString() : "Select a day"}</p>
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
          <label className="block text-white/80">
            <span className="text-xs uppercase tracking-[0.2em] text-white/60">Shop</span>
            <input
              value={shop}
              onChange={(e) => setShop(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-300"
              placeholder="Shop number"
            />
          </label>

          <label className="block text-white/80">
            <span className="text-xs uppercase tracking-[0.2em] text-white/60">Visit type</span>
            <select
              value={visitType}
              onChange={(e) => setVisitType(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-300"
            >
              {VISIT_TYPES.map((v) => (
                <option key={v} value={v} className="bg-slate-900 text-white">
                  {v}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-white/80">
            <span className="text-xs uppercase tracking-[0.2em] text-white/60">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-300"
              placeholder="Optional notes"
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="rounded-full border border-emerald-400/70 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save visit"}
          </button>
        </div>
      </div>
    </div>
  );
}
