"use client";
import React from "react";
import useAwardsShowRuntime from "./useAwardsShowRuntime";
import useAwardsDeckData from "./useAwardsDeckData";
import SlideRenderer from "./SlideRenderer";
import Reactions from "./reactions";
import { THEME_IDS, THEMES } from "./themes";
import { useSearchParams } from "next/navigation";

export default function AwardsShowPage({ searchParams }: { searchParams?: any }) {
  const params = useSearchParams?.() ?? new URLSearchParams(typeof window !== 'undefined' ? window.location.search : "");
  const mode = params.get?.("mode") ?? "audience";
  // minimal period detection: read from params or fallback to 2025/1
  const year = Number(params.get?.("year") ?? 2025);
  const period_no = Number(params.get?.("period_no") ?? 1);

  const { runtime, update } = useAwardsShowRuntime({ year, period_no, createIfMissing: mode === "host" });
  const { deck } = useAwardsDeckData({ year, period_no });

  const curIndex = runtime?.current_slide_index ?? 0;
  const slide = deck?.[curIndex] ?? { id: "empty", title: "No slides" };
  const nextSlide = deck?.[curIndex + 1];

  const setTheme = async (themeId: string) => {
    await update?.({ theme_id: themeId });
  };

  const next = async () => await update?.({ current_slide_index: (runtime?.current_slide_index ?? 0) + 1 });
  const prev = async () => await update?.({ current_slide_index: Math.max(0, (runtime?.current_slide_index ?? 0) - 1) });
  const start = async () => await update?.({ status: "live" });
  const end = async () => await update?.({ status: "ended" });

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl">Awards Show — {mode === "host" ? "Host" : "Audience"}</h1>
          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-300">Theme</div>
            <select aria-label="Awards show theme" value={runtime?.theme_id ?? "theme1"} onChange={(e) => void setTheme(e.target.value ?? "theme1")} className="bg-slate-900 text-white rounded-md px-2 py-1">
              {THEME_IDS.map((t) => <option key={t} value={t}>{THEMES[t].name}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-12 gap-6">
          <div className="col-span-9 h-[640px] bg-slate-800 rounded-md overflow-hidden">
            <SlideRenderer slide={slide} nextSlide={nextSlide} themeFrameClass={THEMES[(runtime?.theme_id ?? "theme1") as keyof typeof THEMES].frameClass} />
          </div>
          <div className="col-span-3">
            <div className="space-y-4">
              <div className="rounded-md p-4 bg-slate-900">
                <div className="flex gap-2">
                  {mode === "host" ? (
                    <>
                      <button onClick={() => void start()} className="px-3 py-2 bg-emerald-600 rounded">Start</button>
                      <button onClick={() => void end()} className="px-3 py-2 bg-rose-600 rounded">End</button>
                      <button onClick={() => void prev()} className="px-3 py-2 bg-slate-600 rounded">Prev</button>
                      <button onClick={() => void next()} className="px-3 py-2 bg-slate-600 rounded">Next</button>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="rounded-md p-4 bg-slate-900">
                <h4 className="text-sm mb-2">Reactions</h4>
                <Reactions year={year} period_no={period_no} />
              </div>

              <div className="rounded-md p-4 bg-slate-900">
                <h4 className="text-sm">Runtime</h4>
                <pre className="text-xs text-slate-300">{JSON.stringify(runtime, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
