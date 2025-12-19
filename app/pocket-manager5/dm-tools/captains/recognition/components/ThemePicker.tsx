"use client";

import React from 'react';
import type { ShowThemeId } from '@/lib/recognitionShowThemes';
import themeMap from '@/lib/recognitionShowThemes';

export default function ThemePicker({ value, onChange }: { value: ShowThemeId; onChange: (id: ShowThemeId) => void }) {
  // Generate small CSS classes for the swatches so we avoid inline `style={{}}` usage
  const swatchCss = Object.values(themeMap)
    .map((t) => `.__theme_swatch_${t.id} { background: ${t.background}; color: ${t.header}; }`)
    .join('\n');

  return (
    <div className="grid grid-cols-3 gap-3">
      <style>{swatchCss}</style>
      {Object.values(themeMap).map((t) => (
        <button key={t.id} type="button" onClick={() => onChange(t.id)} className={`rounded-lg p-3 text-left border ${value === t.id ? 'ring-2 ring-emerald-400' : 'border-slate-800/60'}`}>
          <div className={`h-12 rounded mb-2 __theme_swatch_${t.id}`} />
          <div className="text-sm font-semibold">{t.label}</div>
        </button>
      ))}
    </div>
  );
}
