"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import { getActiveSession, getBoardTemplate, getLeaderboard, getMarks, mark, startSession, unmark } from "@/lib/contests/api";
import { subscribeToMarks } from "@/lib/contests/realtime";
import { getScopeContext } from "@/lib/contests/alignment";
import type { LeaderboardEntry, MarkRow, Objective } from "@/lib/contests/types";

type MarkedState = Record<string, Set<string>>;

export default function FightingBackPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [marks, setMarks] = useState<MarkedState>({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitiator, setIsInitiator] = useState(false);
  const [shopNumber, setShopNumber] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const scope = await getScopeContext();
      setShopNumber(scope.shopNumber ?? null);
      setIsInitiator(scope.scope === "DISTRICT" || scope.scope === "REGION" || scope.scope === "DIVISION");
      const session = await getActiveSession("fighting-back", scope.scope ?? null);
      if (session) setSessionId(session.id);
      const board = await getBoardTemplate("fighting-back");
      setObjectives(board as Objective[]);
      setLoading(false);
    };
    void init();
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let unsub: (() => void) | null = null;
    const load = async () => {
      const rows = await getMarks("fighting-back", sessionId);
      setMarks(buildMarkedState(rows));
      const lb = await getLeaderboard(sessionId);
      setLeaderboard(lb);
    };
    void load();
    unsub = subscribeToMarks(
      "fighting-back",
      sessionId,
      (row) => setMarks((prev) => applyMark(prev, row)),
      (row) => setMarks((prev) => removeMark(prev, row)),
    );
    return () => {
      if (unsub) unsub();
    };
  }, [sessionId]);

  const handleStart = async () => {
    const session = await startSession("fighting-back", "Fighting Back Contest", null);
    if (session) setSessionId(session.id);
  };

  const handleToggle = async (objectiveId: string) => {
    if (!sessionId || !shopNumber) return;
    const hasMark = marks[objectiveId]?.has(shopNumber);
    if (hasMark) {
      await unmark("fighting-back", sessionId, shopNumber, objectiveId);
    } else {
      await mark("fighting-back", sessionId, shopNumber, objectiveId);
    }
  };

  const markedCount = useMemo(() => {
    const shopMarks = Object.values(marks).filter((set) => shopNumber && set.has(shopNumber));
    return shopMarks.length;
  }, [marks, shopNumber]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href="/contests" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-sm text-emerald-200">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            <h1 className="text-2xl font-semibold text-white">Fighting Back</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            {sessionId ? <span className="rounded-full border border-emerald-400/40 px-3 py-1 text-emerald-100">Session active</span> : null}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200"
            >
              <RefreshCcw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Mode</p>
              <p className="text-lg font-semibold text-white">{isInitiator ? "Initiator" : "Shop"}</p>
            </div>
            {isInitiator && (
              <button
                type="button"
                onClick={handleStart}
                className="rounded-full border border-emerald-400/50 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-100 transition hover:border-emerald-300"
              >
                Start Session
              </button>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-300">Objectives completed: {markedCount}</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-4">
          {loading ? (
            <p className="text-slate-300 text-sm">Loading objectives...</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {objectives.map((obj) => {
                const shopHas = shopNumber ? marks[obj.id]?.has(shopNumber) : false;
                return (
                  <button
                    key={obj.id}
                    type="button"
                    onClick={() => handleToggle(obj.id)}
                    className={`relative h-28 rounded-2xl border px-3 py-2 text-left transition ${
                      shopHas ? "border-emerald-400/60 bg-emerald-500/10" : "border-white/10 bg-slate-950/60"
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">{obj.label}</div>
                    <div className="absolute bottom-2 left-3 text-[10px] uppercase tracking-[0.3em] text-slate-400">
                      {marks[obj.id]?.size ?? 0} marked
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Leaderboard</p>
            <span className="text-xs text-slate-300">Top 3 shops</span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {leaderboard.map((entry) => (
              <div key={entry.shop_number} className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
                <p className="text-sm font-semibold text-white">Shop {entry.shop_number}</p>
                <p className="text-xs text-slate-400">Marks: {entry.marks_count}</p>
              </div>
            ))}
            {!leaderboard.length ? <p className="text-sm text-slate-400">No marks yet.</p> : null}
          </div>
        </div>
      </div>
    </main>
  );
}

function buildMarkedState(rows: MarkRow[]): MarkedState {
  const next: MarkedState = {};
  rows.forEach((row) => {
    const targetId = row.objective_id;
    if (!targetId) return;
    if (!next[targetId]) next[targetId] = new Set();
    next[targetId].add(row.shop_number);
  });
  return next;
}

function applyMark(state: MarkedState, row: MarkRow): MarkedState {
  const targetId = row.objective_id;
  if (!targetId) return state;
  const next: MarkedState = { ...state };
  const set = new Set(next[targetId] ?? []);
  set.add(row.shop_number);
  next[targetId] = set;
  return next;
}

function removeMark(state: MarkedState, row: MarkRow): MarkedState {
  const targetId = row.objective_id;
  if (!targetId) return state;
  const next: MarkedState = { ...state };
  const set = new Set(next[targetId] ?? []);
  set.delete(row.shop_number);
  next[targetId] = set;
  return next;
}
