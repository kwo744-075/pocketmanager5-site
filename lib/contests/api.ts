import { supabaseServer } from "@/lib/supabaseServer";
import type { GameType, ContestSession, LeaderboardEntry, BingoSquare, Objective, MarkRow } from "./types";

const supabase = supabaseServer;

export async function getActiveSession(gameType: GameType, scope?: string | null): Promise<ContestSession | null> {
  const { data, error } = await supabase
    .from("contest_sessions")
    .select("*")
    .eq("game_type", gameType)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("getActiveSession error", error);
    return null;
  }
  if (!data) return null;
  if (scope && data.scope && data.scope !== scope) return null;
  return data;
}

export async function startSession(gameType: GameType, title: string | null, scope?: string | null): Promise<ContestSession | null> {
  const { data, error } = await supabase
    .from("contest_sessions")
    .insert([{ game_type: gameType, title, scope }])
    .select()
    .maybeSingle();
  if (error) {
    console.error("startSession error", error);
    return null;
  }
  return data ?? null;
}

export async function getBoardTemplate(gameType: GameType): Promise<Array<BingoSquare | Objective>> {
  const table =
    gameType === "bingo"
      ? "bingo_squares"
      : gameType === "blackout"
      ? "blackout_objectives"
      : "fightback_objectives";
  const { data, error } = await supabase.from(table).select("*").order("sort_order", { ascending: true });
  if (error) {
    console.error("getBoardTemplate error", error);
    return [];
  }
  return data ?? [];
}

export async function getMarks(gameType: GameType, sessionId: string): Promise<MarkRow[]> {
  const table =
    gameType === "bingo"
      ? "bingo_marks"
      : gameType === "blackout"
      ? "blackout_marks"
      : "fightback_marks";
  const { data, error } = await supabase.from(table).select("*").eq("session_id", sessionId);
  if (error) {
    console.error("getMarks error", error);
    return [];
  }
  return data ?? [];
}

export async function mark(gameType: GameType, sessionId: string, shopNumber: string, targetId: string, payload?: Record<string, unknown>) {
  const table =
    gameType === "bingo"
      ? "bingo_marks"
      : gameType === "blackout"
      ? "blackout_marks"
      : "fightback_marks";
  const column = gameType === "bingo" ? "square_id" : "objective_id";
  const { error } = await supabase.from(table).insert([
    {
      session_id: sessionId,
      shop_number: shopNumber,
      [column]: targetId,
      payload: payload ?? null,
    },
  ]);
  if (error) console.error("mark error", error);
}

export async function unmark(gameType: GameType, sessionId: string, shopNumber: string, targetId: string) {
  const table =
    gameType === "bingo"
      ? "bingo_marks"
      : gameType === "blackout"
      ? "blackout_marks"
      : "fightback_marks";
  const column = gameType === "bingo" ? "square_id" : "objective_id";
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("session_id", sessionId)
    .eq("shop_number", shopNumber)
    .eq(column, targetId);
  if (error) console.error("unmark error", error);
}

export async function getLeaderboard(sessionId: string): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.from("contest_leaderboard_vw").select("*").eq("session_id", sessionId).order("rank", { ascending: true }).limit(3);
  if (error) {
    console.error("getLeaderboard error", error);
    return [];
  }
  return data ?? [];
}
