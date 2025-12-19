export type GameType = "bingo" | "blackout" | "fighting-back";

export type ContestSession = {
  id: string;
  created_at: string;
  created_by: string | null;
  game_type: GameType;
  scope: string | null;
  district_name: string | null;
  region_name: string | null;
  title: string | null;
  status: string | null;
};

export type ContestParticipant = {
  id: string;
  session_id: string;
  shop_number: string;
  district_name: string | null;
  region_name: string | null;
  invited_at: string | null;
  joined_at: string | null;
};

export type BingoSquare = { id: string; label: string; sort_order: number; meta?: Record<string, unknown> | null };
export type Objective = { id: string; label: string; sort_order: number; meta?: Record<string, unknown> | null };

export type MarkRow = {
  id: string;
  session_id: string;
  shop_number: string;
  marked_by_user_id: string | null;
  marked_at: string;
  payload: Record<string, unknown> | null;
  square_id?: string;
  objective_id?: string;
};

export type LeaderboardEntry = {
  session_id: string;
  shop_number: string;
  marks_count: number;
  rank: number;
};

export type ScopeContext = {
  shopNumber?: string | null;
  district?: string | null;
  region?: string | null;
  userId?: string | null;
};
