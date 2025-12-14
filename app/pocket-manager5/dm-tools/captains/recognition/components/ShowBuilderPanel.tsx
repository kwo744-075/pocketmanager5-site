"use client";

import React, { useState } from 'react';
import type { ShowThemeId } from '@/lib/recognitionShowThemes';
import ThemePicker from './ThemePicker';
import SlideFilterBuilder from './SlideFilterBuilder';
import PrintPreviewModal from './PrintPreviewModal';

export default function ShowBuilderPanel({
  theme,
  onThemeChange,
  onPrintSelected,
  onExportPptx,
  onStartBroadcast,
}: {
  theme: ShowThemeId;
  onThemeChange: (id: ShowThemeId) => void;
  onPrintSelected: (opts: any) => Promise<boolean>;
  onExportPptx: (opts: any) => Promise<boolean>;
  onStartBroadcast: (opts?: any) => Promise<void> | void;
}) {
  const [filter, setFilter] = useState({ personId: undefined as string | undefined, district: undefined as string | undefined, includeCelebrations: true, includeOnePager: true, includeKpis: true });
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/70 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-slate-400 uppercase">Show Builder & Export (Backup)</p>
          <h4 className="text-lg font-semibold text-white">Build slides and broadcast</h4>
        </div>
        <div className="w-80">
          <ThemePicker value={theme} onChange={onThemeChange} />
        </div>
      </div>

      <SlideFilterBuilder value={filter} onChange={(v) => setFilter(v)} />

      <div className="mt-4 flex gap-3">
        <button type="button" onClick={async () => { setPreviewOpen(true); await onPrintSelected(filter); }} className="rounded-2xl border border-slate-700/70 px-4 py-2 text-sm text-slate-200">Print Selected</button>
        <button type="button" onClick={async () => await onExportPptx({ ...filter })} className="rounded-2xl border border-emerald-400/60 bg-emerald-600/20 px-4 py-2 text-sm font-semibold text-emerald-100">Export PPTX Backup</button>
        <button type="button" onClick={() => onStartBroadcast({})} className="rounded-2xl border border-sky-400/60 bg-sky-600/10 px-4 py-2 text-sm text-sky-200">Start Broadcast</button>
      </div>

      <PrintPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} filter={filter} theme={theme} />
    </div>
  );
}
