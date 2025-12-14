"use client";

import React from 'react';
import type { ShowThemeId } from '@/lib/recognitionShowThemes';
import themeMap from '@/lib/recognitionShowThemes';

export default function ThemePicker({ value, onChange }: { value: ShowThemeId; onChange: (id: ShowThemeId) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {Object.values(themeMap).map((t) => (
        <button key={t.id} type="button" onClick={() => onChange(t.id)} className={`rounded-lg p-3 text-left border ${value === t.id ? 'ring-2 ring-emerald-400' : 'border-slate-800/60'}`}>
          <div style={{ background: t.background, color: t.header }} className="h-12 rounded mb-2" />
          <div className="text-sm font-semibold">{t.label}</div>
        </button>
      ))}
    </div>
  );
}
