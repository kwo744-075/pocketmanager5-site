"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Clue = { id: string; question: string; answer: string };
type Category = { id: string; title: string; cluesA: Clue[]; cluesB: Clue[] };

export default function JeopardyEditor({ year, period, defaultKind = 'A' }: { year: number; period: string; defaultKind?: string }) {
  const [kind, setKind] = useState<string>(defaultKind);
  const [categories, setCategories] = useState<Category[]>(() => {
    const base: Category[] = [];
    for (let i = 0; i < 4; i++) {
      base.push({ id: String(i), title: `Category ${i + 1}`, cluesA: [{ id: 'a1', question: '', answer: '' }, { id: 'a2', question: '', answer: '' }], cluesB: [{ id: 'b1', question: '', answer: '' }, { id: 'b2', question: '', answer: '' }] });
    }
    return base;
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // load existing set
    let mounted = true;
    (async () => {
      const { data } = await supabase.from('jeopardy_sets').select('payload').eq('year', year).eq('period', period).eq('kind', kind);
      if (!mounted) return;
      if (data && data.length) {
        try {
          const payload = data[0].payload as { categories?: Category[] };
          setCategories(payload.categories ?? categories);
        } catch (e) {
          // ignore
        }
      }
    })();
    return () => { mounted = false; };
  }, [year, period]);

  const save = async () => {
    setSaving(true);
    const payload = { categories };
    // perform update-or-insert to avoid TypeScript onConflict typing issues
    const existing = await supabase.from('jeopardy_sets').select('id').eq('year', year).eq('period', period).eq('kind', kind).limit(1).maybeSingle();
    if (existing?.data) {
      const upd = await supabase.from('jeopardy_sets').update({ payload }).eq('id', existing.data.id);
      if (upd.error) setMessage(String(upd.error.message)); else setMessage('Saved');
    } else {
      const ins = await supabase.from('jeopardy_sets').insert([{ year, period, kind, payload }]);
      if (ins.error) setMessage(String(ins.error.message)); else setMessage('Saved');
    }
    setSaving(false);
  };

  return (
    <div className="rounded-lg border border-slate-800/60 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white">Jeopardy Board Editor</div>
        <div className="text-xs text-slate-400">{year} / {period}</div>
      </div>
      <div className="mt-3">
        <label className="text-xs text-slate-400">Board kind</label>
        <select aria-label="Board kind" value={kind} onChange={(e) => setKind(e.target.value)} className="ml-2 rounded bg-slate-900 px-2 py-1 text-slate-200 text-sm">
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="FINAL">FINAL</option>
        </select>
      </div>
      <div className="mt-3 space-y-3">
        {categories.map((cat, ci) => (
          <div key={`${cat.id}-${ci}`} className="rounded-md border border-slate-800/50 p-3">
            <input aria-label={`Category title ${ci + 1}`} placeholder={`Category ${ci + 1}`} className="w-full rounded bg-slate-900 px-2 py-1 text-sm text-slate-200" value={cat.title} onChange={(e) => setCategories((s) => { const copy = [...s]; copy[ci] = { ...copy[ci], title: e.target.value }; return copy; })} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              {cat.cluesA.map((cl, idx) => (
                <div key={`${cat.id}-A-${cl.id}-${idx}`} className="space-y-1">
                  <input aria-label={`A Q${idx + 1} for ${cat.title}`} placeholder={`A Q${idx + 1}`} className="w-full rounded bg-slate-900 px-2 py-1 text-sm text-slate-200" value={cl.question} onChange={(e) => setCategories((s) => { const copy = [...s]; copy[ci].cluesA[idx] = { ...copy[ci].cluesA[idx], question: e.target.value }; return copy; })} />
                  <input aria-label={`A A${idx + 1} for ${cat.title}`} placeholder={`A A${idx + 1}`} className="w-full rounded bg-slate-900 px-2 py-1 text-sm text-slate-200" value={cl.answer} onChange={(e) => setCategories((s) => { const copy = [...s]; copy[ci].cluesA[idx] = { ...copy[ci].cluesA[idx], answer: e.target.value }; return copy; })} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button className="rounded border px-3 py-1 text-sm text-slate-200" onClick={() => window.location.reload()}>Reload</button>
        <button className="rounded bg-emerald-600 px-3 py-1 text-sm font-semibold text-white" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Board'}</button>
      </div>
      {message ? <div className="mt-2 text-xs text-slate-400">{message}</div> : null}
    </div>
  );
}
