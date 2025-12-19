"use client";

import React, { useEffect } from 'react';
import type { ShowThemeId } from '@/lib/recognitionShowThemes';
import styles from './PrintPreviewModal.module.css';

export default function PrintPreviewModal({ open, onClose, filter, theme }: { open: boolean; onClose: () => void; filter: any; theme: ShowThemeId }) {
  useEffect(() => {
    if (open) {
      // small delay to allow content to render
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl bg-slate-900/90 rounded p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Print preview</h3>
          <button onClick={onClose} className="text-sm text-slate-300">Close</button>
        </div>
        <div className="mt-4 space-y-6">
          {/* Render a simple slide per selected filter - in a real implementation this would render the real one-pager */}
          <section className={`${styles.slide} rounded border border-slate-800/60 bg-slate-950/60 p-6`}>
            <h2 className="text-2xl text-white">Demo Slide</h2>
            <p className="text-sm text-slate-400">Filter: {JSON.stringify(filter)}</p>
            <div className="mt-4 text-white">Theme: {theme}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
