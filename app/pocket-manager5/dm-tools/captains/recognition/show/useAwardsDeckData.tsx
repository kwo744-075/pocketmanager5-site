"use client";
import { useEffect, useState } from "react";

type Slide = { id: string; type: string; title?: string; payload?: any };

export function useAwardsDeckData({ year, period_no }: { year: number; period_no: number }) {
  const [deck, setDeck] = useState<Slide[] | null>(null);

  useEffect(() => {
    const key = `awards_deck:${year}:${period_no}`;
    try {
      const cached = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      if (cached) {
        setDeck(JSON.parse(cached));
        return;
      }
    } catch (e) {}

    // Minimal placeholder deck builder: in real app, build from dataset, winners, and jeopardy sets.
    const districts = Array.from({ length: 6 }).map((_, i) => ({ id: `district-${i + 1}`, title: `District ${i + 1}` }));
    const built: Slide[] = [];

    // cover
    built.push({ id: "cover", type: "cover", title: `Awards ${period_no}/${year}` });

    // Insert district slides and jeopardy breaks after every 2 districts (A/B alternating)
    let jeopardyKind: "A" | "B" = "A";
    for (let i = 0; i < districts.length; i++) {
      const d = districts[i];
      built.push({ id: d.id, type: "district", title: d.title });
      // after every 2 districts, add a jeopardy break
      if ((i + 1) % 2 === 0 && i !== districts.length - 1) {
        built.push({ id: `jeopardy-${jeopardyKind}-${Math.floor(i / 2) + 1}`, type: "jeopardy", title: `Jeopardy Break ${jeopardyKind}` });
        jeopardyKind = jeopardyKind === "A" ? "B" : "A";
      }
    }

    // final jeopardy at end
    built.push({ id: "final-jeopardy", type: "final", title: "Final Jeopardy" });
    setDeck(built);
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(built));
    } catch (e) {}
  }, [year, period_no]);

  return { deck };
}

export default useAwardsDeckData;
