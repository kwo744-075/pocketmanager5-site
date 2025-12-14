"use client";

import React from 'react';

export default function SlideFilterBuilder({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label className="text-xs text-slate-400">Person</label>
        <input className="mt-1 w-full rounded border px-2 py-1 bg-slate-900/40 text-white" placeholder="Search person (name)" value={value.personId ?? ''} onChange={(e) => onChange({ ...value, personId: e.target.value || undefined })} />
      </div>
      <div>
        <label className="text-xs text-slate-400">District</label>
        <input className="mt-1 w-full rounded border px-2 py-1 bg-slate-900/40 text-white" placeholder="District name" value={value.district ?? ''} onChange={(e) => onChange({ ...value, district: e.target.value || undefined })} />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs text-slate-400">Include</label>
        <div className="flex gap-2">
          <label className="text-xs"><input type="checkbox" checked={value.includeCelebrations ?? true} onChange={(e) => onChange({ ...value, includeCelebrations: e.target.checked })} /> Celebrations</label>
          <label className="text-xs"><input type="checkbox" checked={value.includeOnePager ?? true} onChange={(e) => onChange({ ...value, includeOnePager: e.target.checked })} /> One-pager winners</label>
          <label className="text-xs"><input type="checkbox" checked={value.includeKpis ?? true} onChange={(e) => onChange({ ...value, includeKpis: e.target.checked })} /> KPI blocks</label>
        </div>
      </div>
    </div>
  );
}
