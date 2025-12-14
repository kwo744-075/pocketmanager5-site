"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getDefaultRetailPeriod, getRetailPeriods } from "@/lib/retailPeriod";

type Props = {
  year?: number;
  period?: string | number;
  participants?: string[];
  defaultKind?: string;
};

export default function JeopardyShow({ year: propYear, period: propPeriod, participants, defaultKind = "A" }: Props) {
  const [kind, setKind] = useState<string>(defaultKind);
  const [setPayload, setSetPayload] = useState<any>(null);
  const [used, setUsed] = useState<string[]>([]);
  const [sequence, setSequence] = useState<Array<string>>([]);

  const [curYear, setCurYear] = useState<number | null>(propYear ?? null);
  const [curPeriod, setCurPeriod] = useState<number | null>(propPeriod != null ? Number(propPeriod) : null);
  const [warning, setWarning] = useState<string | null>(null);
  const [periodsList, setPeriodsList] = useState<Array<{ year: number; period_no: number }>>([]);

  const [presentationMode, setPresentationMode] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [breakClueIndex, setBreakClueIndex] = useState(0);
  const [revealQuestion, setRevealQuestion] = useState(false);
  const [revealAnswer, setRevealAnswer] = useState(false);

  // Default year/period from retail calendar when not provided
  useEffect(() => {
    let mounted = true;
    (async () => {
      const periods = await getRetailPeriods();
      if (!mounted) return;
      setPeriodsList(periods.map((p) => ({ year: p.year, period_no: p.period_no })));

      // If props provided, respect them (but ensure they exist in calendar)
      if (propYear != null && propPeriod != null) {
        setCurYear(propYear);
        setCurPeriod(Number(propPeriod));
        return;
      }

      // compute default (previous) and prefer calendar match
      const r = await getDefaultRetailPeriod();
      if (!mounted) return;
      const found = periods.find((p) => p.year === r.year && p.period_no === r.period_no);
      if (found) {
        setCurYear(found.year);
        setCurPeriod(found.period_no);
      } else if (periods.length > 0) {
        // pick most recent calendar entry but warn
        setCurYear(periods[0].year);
        setCurPeriod(periods[0].period_no);
        if (!r.fromCalendar) setWarning(r.message ?? "");
      } else {
        // fallback to default helper
        setCurYear(r.year);
        setCurPeriod(r.period_no);
        if (!r.fromCalendar) setWarning(r.message ?? "No retail calendar rows found.");
      }
    })();
    return () => { mounted = false; };
  }, [propYear, propPeriod]);

  const year = curYear;
  const period = curPeriod;

  // Load board + used state when year/period/kind available
  useEffect(() => {
    if (!year || !period || !kind) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase.from("jeopardy_sets").select("kind,payload").eq("year", year).eq("period", period).eq("kind", kind);
      if (!mounted) return;
      if (data && data.length) setSetPayload(data[0].payload);

      const s = await supabase.from("jeopardy_show_state").select("used_clue_ids").eq("year", year).eq("period", period).eq("kind", kind).maybeSingle();
      if (s && (s.data as any)) setUsed((s.data as any).used_clue_ids ?? []);
    })();
    return () => { mounted = false; };
  }, [year, period, kind]);

  // Validate board shape
  const isValidBoard = useMemo(() => {
    if (!setPayload) return false;
    if (!Array.isArray(setPayload.categories)) return false;
    for (const c of setPayload.categories) {
      if (typeof c.title !== "string") return false;
      // clues can be cluesA/cluesB/cluesFinal depending on kind
      if (!Array.isArray(c.cluesA) && !Array.isArray(c.cluesB) && !Array.isArray(c.cluesFinal)) return false;
    }
    return true;
  }, [setPayload]);

  // Helper to persist used ids (year/period/kind must be provided)
  const markUsed = async (id: string, markKind?: string) => {
    const k = markKind ?? kind;
    const next = Array.from(new Set([...used, id]));
    setUsed(next);
    if (!year || !period) return;
    const existing = await supabase.from("jeopardy_show_state").select("id").eq("year", year).eq("period", period).eq("kind", k).limit(1).maybeSingle();
    if (existing?.data) {
      await supabase.from("jeopardy_show_state").update({ used_clue_ids: next, updated_at: new Date().toISOString() }).eq("id", existing.data.id);
    } else {
      await supabase.from("jeopardy_show_state").insert([{ year, period, kind: k, used_clue_ids: next }]);
    }
  };

  // Build steps / sequence
  useEffect(() => {
    const pts = participants && participants.length ? participants : Array.from({ length: 8 }).map((_, i) => `DM ${i + 1}`);
    const seq: string[] = [];
    for (let i = 0; i < pts.length; i++) {
      seq.push(pts[i]);
      if ((i + 1) % 2 === 0) seq.push(`Jeopardy Break ${Math.ceil((i + 1) / 2)}`);
    }
    seq.push("Final Jeopardy");
    setSequence(seq);
  }, [participants]);

  // Compute next unused clues for a kind (returns array of { id, question, answer })
  const getNextUnusedClues = (k: string, limit = 2) => {
    if (!setPayload || !Array.isArray(setPayload.categories)) return [];
    const flat: Array<{ id: string; question: string; answer: string }> = [];
    for (let ci = 0; ci < setPayload.categories.length; ci++) {
      const cat = setPayload.categories[ci];
      const clues = k === "A" ? (cat.cluesA ?? []) : k === "B" ? (cat.cluesB ?? []) : (cat.cluesFinal ?? []);
      for (let idx = 0; idx < (clues || []).length; idx++) {
        const cl = clues[idx];
        const id = `cat${ci}-${k}-${idx}`;
        if (!used.includes(id)) flat.push({ id, question: cl?.question ?? "", answer: cl?.answer ?? "" });
        if (flat.length >= limit) break;
      }
      if (flat.length >= limit) break;
    }
    return flat;
  };

  // Presentation helpers
  const steps = sequence;
  const currentStep = steps[stepIndex] ?? null;

  const inBreak = currentStep && currentStep.startsWith("Jeopardy Break");
  const breakNumber = inBreak ? Number(currentStep.split(" ")[2]) : null;
  const kindForThisBreak = inBreak ? (breakNumber === 1 ? "A" : breakNumber === 2 ? "B" : "A") : (currentStep === "Final Jeopardy" ? "FINAL" : kind);

  // clues currently selected for the running break
  const breakClues = inBreak ? getNextUnusedClues(kindForThisBreak, 2) : [];

  const startPresentation = () => {
    if (!isValidBoard || !year || !period) {
      setWarning("Please select a valid Year and Period from the calendar and ensure a valid board is loaded.");
      return;
    }
    setPresentationMode(true);
    setStepIndex(0);
    setBreakClueIndex(0);
    setRevealQuestion(false);
    setRevealAnswer(false);
  };

  const advanceStep = () => {
    setBreakClueIndex(0);
    setRevealQuestion(false);
    setRevealAnswer(false);
    setStepIndex((s) => Math.min(s + 1, steps.length - 1));
  };

  const presentNextQuestionInBreak = () => {
    setBreakClueIndex((i) => i + 1);
    setRevealQuestion(false);
    setRevealAnswer(false);
  };

  if (!setPayload) return <div className="text-sm text-slate-400">No jeopardy board configured.</div>;

  return (
    <div className="rounded-lg border border-slate-800/60 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-white">Jeopardy Show</div>
          <div className="mt-1 text-xs text-slate-400">Insert Jeopardy breaks after every 2 participants; each break uses 2 questions. Final Jeopardy at end.</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">Year / Period</div>
          <div className="mt-1">
            <select
              value={year && period ? `${year}-${period}` : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) {
                  setCurYear(null);
                  setCurPeriod(null);
                  return;
                }
                const [y, p] = v.split("-");
                setCurYear(Number(y));
                setCurPeriod(Number(p));
                setWarning(null);
              }}
              className="rounded bg-slate-900 px-2 py-1 text-slate-200 text-sm"
            >
              <option value="">Select period</option>
              {periodsList.map((pp) => (
                <option key={`${pp.year}-${pp.period_no}`} value={`${pp.year}-${pp.period_no}`}>{`${pp.year} - P${pp.period_no}`}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {warning ? (
        <div className="mt-3 rounded-md border border-amber-700/40 bg-amber-900/10 p-3 text-sm text-amber-200">{warning}</div>
      ) : null}

      <div className="mt-3 flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={presentationMode} onChange={(e) => setPresentationMode(e.target.checked)} disabled={!isValidBoard || !year || !period} />
          Presentation Mode
        </label>
        <button className="rounded border px-3 py-1 text-sm text-white bg-emerald-700/10" onClick={startPresentation} disabled={!isValidBoard || !year || !period}>Start</button>
        {!isValidBoard ? <div className="text-xs text-rose-400">Board JSON invalid — Presentation disabled.</div> : null}
        {(!year || !period) ? <div className="text-xs text-rose-400">Select Year/Period (calendar-driven) to enable Presentation.</div> : null}
      </div>

      {presentationMode && (
        <div className="mt-4">
          <div className="text-sm text-slate-300">Step {stepIndex + 1} of {steps.length}</div>
          <div className="mt-2 rounded border border-slate-800/40 bg-slate-900/40 p-4">
            {currentStep && !inBreak && currentStep !== "Final Jeopardy" && (
              <div>
                <div className="text-xl font-semibold text-white">{currentStep} presenting</div>
                <div className="mt-2 text-sm text-slate-400">(Placeholder slide for presenter)</div>
                <div className="mt-3 flex gap-2">
                  <button className="px-3 py-1 rounded bg-emerald-600 text-white" onClick={advanceStep}>Next</button>
                </div>
              </div>
            )}

            {inBreak && (
              <div>
                <div className="text-lg font-semibold text-white">{currentStep} — Break ({kindForThisBreak})</div>
                <div className="mt-2 text-sm text-slate-400">Two questions from kind {kindForThisBreak}</div>

                {breakClues.length === 0 ? (
                  <div className="mt-3 text-sm text-slate-400">No unused clues available for this kind.</div>
                ) : (
                  <div className="mt-3">
                    {breakClues.map((clue, idx) => (
                      <div key={clue.id} className={`p-3 mb-3 rounded ${used.includes(clue.id) ? 'bg-slate-900/30 text-slate-500' : 'bg-slate-900/10'}`}>
                        <div className="text-sm text-slate-300">{revealQuestion ? clue.question : 'Question hidden'}</div>
                        <div className="mt-2 text-sm font-semibold text-white">{revealAnswer ? clue.answer : (revealQuestion ? 'Answer hidden' : '')}</div>
                        <div className="mt-3 flex gap-2">
                          <button className="px-2 py-1 rounded bg-slate-800 text-slate-200 text-xs" onClick={() => setRevealQuestion(true)}>Reveal Question</button>
                          <button className="px-2 py-1 rounded bg-slate-800 text-slate-200 text-xs" onClick={() => setRevealAnswer(true)}>Reveal Answer</button>
                          {!used.includes(clue.id) ? (
                            <button className="px-2 py-1 rounded bg-emerald-600 text-white text-xs" onClick={() => markUsed(clue.id, kindForThisBreak)}>Mark Used</button>
                          ) : (
                            <button className="px-2 py-1 rounded border text-xs text-slate-400" disabled>Used</button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button className="px-3 py-1 rounded bg-emerald-600 text-white" onClick={() => { presentNextQuestionInBreak(); }}>Next Question</button>
                      <button className="px-3 py-1 rounded border text-white" onClick={() => { advanceStep(); }}>Resume Show</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === "Final Jeopardy" && (
              <div>
                <div className="text-xl font-semibold text-white">Final Jeopardy</div>
                <div className="mt-2 text-sm text-slate-400">Present the final question here.</div>
                <div className="mt-3">
                  <button className="px-3 py-1 rounded bg-emerald-600 text-white" onClick={() => advanceStep()}>Finish</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin/editor collapsed by default */}
      <div className="mt-6">
        <details>
          <summary className="cursor-pointer text-sm text-slate-300">Editor / Admin (advanced)</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {(setPayload.categories ?? []).map((cat: any, ci: number) => (
              <div key={ci} className="rounded border border-slate-800/50 p-3">
                <div className="text-sm font-medium text-slate-200">{cat.title}</div>
                <div className="mt-2 space-y-1">
                  {(cat.cluesA ?? []).map((cl: any, idx: number) => {
                    const id = `cat${ci}-A-${idx}`;
                    const isUsed = used.includes(id);
                    return (
                      <div key={id} className={`p-2 rounded ${isUsed ? 'bg-slate-900/30 text-slate-500' : 'bg-slate-900/10'}`}>
                        <div className="text-xs text-slate-300">{cl.question}</div>
                        <div className="text-sm font-semibold text-white">{cl.answer}</div>
                        {!isUsed ? <button className="mt-2 text-xs text-emerald-400" onClick={() => markUsed(id)}>Mark used</button> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
