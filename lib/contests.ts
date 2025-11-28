import { supabase } from "@/lib/supabaseClient";

export type ContestRecord = {
  id: string;
  title: string;
  description: string | null;
  metric_key: string;
  scope_level: string;
  status: string;
  start_date: string;
  end_date: string;
  target_value: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ContestProgressRecord = {
  id: string;
  contest_id: string;
  shop_number: string | null;
  progress_date: string;
  daily_total: number;
  recorded_by: string | null;
  created_at: string;
};

export type ContestLeaderboardEntry = {
  contest_id: string;
  shop_number: string | null;
  total_value: number;
  last_update: string | null;
};

export type ContestSummary = ContestRecord & {
  leaderboard: ContestLeaderboardEntry[];
};

export async function fetchActiveContests(limit = 3): Promise<ContestSummary[]> {
  const { data: contests, error } = await supabase
    .from("contests")
    .select("*")
    .in("status", ["active", "draft"])
    .order("start_date", { ascending: false })
    .limit(limit);

  const contestRows = (contests as ContestRecord[] | null) ?? [];

  if (error || !contestRows.length) {
    return [];
  }

  const contestIds = contestRows.map((contest) => contest.id);

  const { data: leaderboardRows } = await supabase
    .from("contest_leaderboard_vw")
    .select("*")
    .in("contest_id", contestIds);

  const leaderboardByContest = new Map<string, ContestLeaderboardEntry[]>();
  (leaderboardRows as ContestLeaderboardEntry[] | null)?.forEach((row) => {
    const list = leaderboardByContest.get(row.contest_id) ?? [];
    list.push(row);
    leaderboardByContest.set(row.contest_id, list);
  });

  return contestRows.map((contest) => ({
    ...contest,
    leaderboard: leaderboardByContest.get(contest.id) ?? [],
  }));
}

export async function fetchContestById(contestId: string): Promise<ContestSummary | null> {
  const { data, error } = await supabase
    .from("contests")
    .select("*")
    .eq("id", contestId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const { data: leaderboardRows } = await supabase
    .from("contest_leaderboard_vw")
    .select("*")
    .eq("contest_id", contestId);

  return {
    ...(data as ContestRecord),
    leaderboard: (leaderboardRows as ContestLeaderboardEntry[] | null) ?? [],
  };
}

export async function createContest(payload: {
  title: string;
  description?: string;
  metric_key: string;
  scope_level: string;
  start_date: string;
  end_date: string;
  target_value?: number;
  created_by: string;
}) {
  return supabase.from("contests").insert({
    title: payload.title,
    description: payload.description ?? null,
    metric_key: payload.metric_key,
    scope_level: payload.scope_level,
    start_date: payload.start_date,
    end_date: payload.end_date,
    target_value: payload.target_value ?? null,
    created_by: payload.created_by,
    status: "active",
  });
}

export async function recordContestProgress(payload: {
  contest_id: string;
  shop_number: string;
  progress_date: string;
  daily_total: number;
  recorded_by: string;
}) {
  return supabase.from("contest_progress").insert(payload);
}

export function subscribeToContestStream(
  onContestChange: (contest: ContestRecord) => void,
  onProgress?: (progress: ContestProgressRecord) => void
) {
  const channel = supabase
    .channel("contest-stream")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "contests" },
      (payload) => {
        if (payload.new) {
          onContestChange(payload.new as ContestRecord);
        }
      }
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "contests" },
      (payload) => {
        if (payload.new) {
          onContestChange(payload.new as ContestRecord);
        }
      }
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "contest_progress" },
      (payload) => {
        if (payload.new && onProgress) {
          onProgress(payload.new as ContestProgressRecord);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
