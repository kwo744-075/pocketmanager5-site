import { supabase } from "@/lib/supabaseClient";
import type { GameType, MarkRow } from "./types";

type MarkListener = (mark: MarkRow) => void;

export function subscribeToMarks(gameType: GameType, sessionId: string, onInsert: MarkListener, onDelete?: MarkListener) {
  const table =
    gameType === "bingo"
      ? "bingo_marks"
      : gameType === "blackout"
      ? "blackout_marks"
      : "fightback_marks";
  const channel = supabase
    .channel(`${table}-session-${sessionId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table, filter: `session_id=eq.${sessionId}` },
      (payload) => {
        const newRow = payload.new as MarkRow;
        onInsert(newRow);
      },
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table, filter: `session_id=eq.${sessionId}` },
      (payload) => {
        const oldRow = payload.old as MarkRow;
        onDelete?.(oldRow);
      },
    )
    .subscribe((status) => {
      console.info(`[realtime] ${table} ${sessionId} -> ${status}`);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
