"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import { getActiveSession, getBoardTemplate, getLeaderboard, getMarks, mark, startSession, unmark } from "@/lib/contests/api";
import { subscribeToMarks } from "@/lib/contests/realtime";
import { getScopeContext } from "@/lib/contests/alignment";
import type { BingoSquare, LeaderboardEntry, MarkRow } from "@/lib/contests/types";

type MarkedState = Record<string, Set<string>>; // squareId -> set of shop_numbers

export default function BingoPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [squares, setSquares] = useState<BingoSquare[]>([]);
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
      const session = await getActiveSession("bingo", scope.scope ?? null);
      if (session) {
        setSessionId(session.id);
      }
      const board = await getBoardTemplate("bingo");
      setSquares(board as BingoSquare[]);
      setLoading(false);
    };
    void init();
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let unsub: (() => void) | null = null;
    const load = async () => {
      const rows = await getMarks("bingo", sessionId);
      setMarks(buildMarkedState(rows));
      const lb = await getLeaderboard(sessionId);
      setLeaderboard(lb);
    };
    void load();
    unsub = subscribeToMarks(
      "bingo",
      sessionId,
      (row) => setMarks((prev) => applyMark(prev, row)),
      (row) => setMarks((prev) => removeMark(prev, row)),
    );
    return () => {
      if (unsub) unsub();
    };
  }, [sessionId]);

  const handleStart = async () => {
    const session = await startSession("bingo", "Bingo Contest", null);
    if (session) {
      setSessionId(session.id);
    }
  };

  const handleToggle = async (squareId: string) => {
    if (!sessionId || !shopNumber) return;
    const hasMark = marks[squareId]?.has(shopNumber);
    if (hasMark) {
      await unmark("bingo", sessionId, shopNumber, squareId);
    } else {
      await mark("bingo", sessionId, shopNumber, squareId);
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
            <h1 className="text-2xl font-semibold text-white">Bingo</h1>
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
          <p className="mt-2 text-sm text-slate-300">Squares completed: {markedCount}</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-4">
          {loading ? (
            <p className="text-slate-300 text-sm">Loading board...</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {squares.map((sq) => {
                const shopHas = shopNumber ? marks[sq.id]?.has(shopNumber) : false;
                return (
                  <button
                    key={sq.id}
                    type="button"
                    onClick={() => handleToggle(sq.id)}
                    className={`relative h-28 rounded-2xl border px-3 py-2 text-left transition ${
                      shopHas ? "border-emerald-400/60 bg-emerald-500/10" : "border-white/10 bg-slate-950/60"
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">{sq.label}</div>
                    <div className="absolute bottom-2 left-3 text-[10px] uppercase tracking-[0.3em] text-slate-400">
                      {marks[sq.id]?.size ?? 0} marked
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
    const targetId = row.square_id ?? row.objective_id;
    if (!targetId) return;
    if (!next[targetId]) next[targetId] = new Set();
    next[targetId].add(row.shop_number);
  });
  return next;
}

function applyMark(state: MarkedState, row: MarkRow): MarkedState {
  const targetId = row.square_id ?? row.objective_id;
  if (!targetId) return state;
  const next: MarkedState = { ...state };
  const set = new Set(next[targetId] ?? []);
  set.add(row.shop_number);
  next[targetId] = set;
  return next;
}

function removeMark(state: MarkedState, row: MarkRow): MarkedState {
  const targetId = row.square_id ?? row.objective_id;
  if (!targetId) return state;
  const next: MarkedState = { ...state };
  const set = new Set(next[targetId] ?? []);
  set.delete(row.shop_number);
  next[targetId] = set;
  return next;
}
