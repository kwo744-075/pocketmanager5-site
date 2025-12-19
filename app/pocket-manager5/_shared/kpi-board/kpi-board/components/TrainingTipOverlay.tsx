"use client";

import { X } from "lucide-react";
import { CANONICAL_KPIS } from "../types";
import type { CanonicalKpiKey, TrainingTip } from "../types";

type TrainingTipOverlayProps = {
  activeKpi: CanonicalKpiKey | null;
  tips: Record<CanonicalKpiKey, TrainingTip>;
  onClose: () => void;
};

export function TrainingTipOverlay({ activeKpi, tips, onClose }: TrainingTipOverlayProps) {
  const tip = activeKpi ? tips[activeKpi] : null;
  const meta = activeKpi ? CANONICAL_KPIS.find((item) => item.key === activeKpi) : null;

  if (!tip || !meta) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/50 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="relative h-full w-full max-w-md border-l border-white/10 bg-slate-950/95 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.75)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-slate-200 transition hover:border-emerald-400/50"
          aria-label="Close training tips"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="text-[10px] uppercase tracking-[0.35em] text-emerald-300">Training mode</p>
        <h3 className="mt-2 text-2xl font-semibold text-white">{meta.label}</h3>
        <p className="mt-1 text-sm text-slate-300">Tip placeholders for SMEs to fill in later.</p>

        <div className="mt-5 space-y-4 text-sm text-slate-200">
          <TipBlock title="Where it's pulled from" content={tip.whereFrom} />
          <TipBlock title="How to improve it" content={tip.howToImprove} />
          <TipBlock title="Common mistakes" content={tip.commonMistakes} />
        </div>
      </div>
    </div>
  );
}

function TipBlock({ title, content }: { title: string; content: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3">
      <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">{title}</p>
      <p className="mt-2 text-sm text-slate-200">{content}</p>
    </div>
  );
}
