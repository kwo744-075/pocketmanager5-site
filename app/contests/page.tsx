"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  createContest,
  fetchActiveContests,
  fetchContestById,
  recordContestProgress,
  subscribeToContestStream,
  type ContestSummary,
} from "@/lib/contests";

const metricOptions = [
  { key: "cars", label: "Cars" },
  { key: "sales", label: "Sales $" },
  { key: "big4", label: "Big 4 %" },
  { key: "coolants", label: "Coolants %" },
  { key: "diffs", label: "Diffs %" },
  { key: "mobil1", label: "Mobil 1 %" },
  { key: "donations", label: "Donations" },
];

const scopeOptions = [
  { key: "SHOP", label: "Shop" },
  { key: "DISTRICT", label: "District" },
  { key: "REGION", label: "Region" },
];

const todayISO = () => new Date().toISOString().split("T")[0];
const nextWeekISO = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().split("T")[0];
};

export default function ContestPortalPage() {
  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loggingProgress, setLoggingProgress] = useState(false);

  const [contestForm, setContestForm] = useState({
    title: "",
    description: "",
    metric_key: "cars",
    scope_level: "SHOP",
    target_value: "",
    start_date: todayISO(),
    end_date: nextWeekISO(),
  });

  const [progressForm, setProgressForm] = useState({
    shop_number: "",
    daily_total: "",
    progress_date: todayISO(),
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("loginEmail");
      if (stored) {
        setLoginEmail(stored);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchActiveContests(15)
      .then((records) => {
        if (!cancelled) {
          setContests(records);
        }
      })
      .catch((err) => {
        console.error("contest fetch error", err);
        setStatusMessage("Unable to load contests right now.");
      });

    const unsubscribe = subscribeToContestStream(
      (contest) => {
        fetchContestById(contest.id).then((summary) => {
          if (summary && !cancelled) {
            setContests((prev) => upsertContestList(prev, summary, 20));
          }
        });
      },
      (progress) => {
        fetchContestById(progress.contest_id).then((summary) => {
          if (summary && !cancelled) {
            setContests((prev) => upsertContestList(prev, summary, 20));
          }
        });
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!selectedId && contests.length) {
      setSelectedId(contests[0].id);
    }
  }, [contests, selectedId]);

  const selectedContest = useMemo(() => {
    if (!contests.length) {
      return null;
    }
    return contests.find((contest) => contest.id === selectedId) ?? contests[0];
  }, [contests, selectedId]);

  const leaderboard = useMemo(() => {
    if (!selectedContest) {
      return [];
    }
    return [...selectedContest.leaderboard].sort((a, b) => (b.total_value ?? 0) - (a.total_value ?? 0));
  }, [selectedContest]);

  const handleCreateContest = async () => {
    if (!contestForm.title.trim()) {
      setStatusMessage("Please provide a title for the contest.");
      return;
    }
    setCreating(true);
    setStatusMessage(null);
    try {
      const { error } = await createContest({
        title: contestForm.title.trim(),
        description: contestForm.description.trim() || undefined,
        metric_key: contestForm.metric_key,
        scope_level: contestForm.scope_level,
        start_date: contestForm.start_date,
        end_date: contestForm.end_date,
        target_value: contestForm.target_value ? Number(contestForm.target_value) : undefined,
        created_by: (loginEmail ?? "web-portal@pulsecheck"),
      });
      if (error) {
        throw error;
      }
      setContestForm((prev) => ({
        ...prev,
        title: "",
        description: "",
        target_value: "",
      }));
      setStatusMessage("Contest created.");
    } catch (err) {
      console.error("create contest error", err);
      setStatusMessage("Unable to create contest right now.");
    } finally {
      setCreating(false);
    }
  };

  const handleProgress = async () => {
    if (!selectedContest) {
      setStatusMessage("Select a contest first.");
      return;
    }
    if (!progressForm.shop_number.trim() || !progressForm.daily_total.trim()) {
      setStatusMessage("Include a shop number and total.");
      return;
    }
    setLoggingProgress(true);
    setStatusMessage(null);
    try {
      const { error } = await recordContestProgress({
        contest_id: selectedContest.id,
        shop_number: progressForm.shop_number.trim(),
        daily_total: Number(progressForm.daily_total),
        progress_date: progressForm.progress_date,
        recorded_by: loginEmail ?? "web-portal@pulsecheck",
      });
      if (error) {
        throw error;
      }
      setProgressForm({ shop_number: "", daily_total: "", progress_date: todayISO() });
      setStatusMessage("Progress logged.");
    } catch (err) {
      console.error("progress insert error", err);
      setStatusMessage("Unable to log progress right now.");
    } finally {
      setLoggingProgress(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] text-emerald-400">Contest portal</p>
            <h1 className="text-3xl font-semibold text-white">Pulse Check contests</h1>
            <p className="text-sm text-slate-400">
              Launch region-wide pushes and sync daily results with the mobile app in real time.
            </p>
          </div>
          <Link
            href="/pulse-check5"
            className="rounded-full border border-emerald-400/70 px-4 py-1.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/10"
          >
            ← Back to Pulse Check
          </Link>
        </div>

        {statusMessage && (
          <p className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-sm text-slate-200">
            {statusMessage}
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
          <section className="space-y-4 rounded-3xl border border-slate-900 bg-slate-950/70 p-4 shadow-inner shadow-black/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-2xl font-semibold text-white">Live contests</h2>
                <p className="text-xs text-slate-400">Tap a contest to view its leaderboard and log daily totals.</p>
              </div>
              <span className="text-[11px] uppercase tracking-wide text-slate-500">{contests.length} active</span>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              {contests.map((contest) => (
                <button
                  key={contest.id}
                  type="button"
                  onClick={() => setSelectedId(contest.id)}
                  className={`rounded-2xl border px-3 py-3 text-left transition ${
                    contest.id === selectedContest?.id
                      ? "border-emerald-400/70 bg-emerald-500/5"
                      : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">{contest.metric_key}</p>
                  <p className="text-lg font-semibold text-white">{contest.title}</p>
                  <p className="text-xs text-slate-400">
                    {contest.start_date} → {contest.end_date}
                  </p>
                  <p className="text-xs text-emerald-300">{contest.status}</p>
                </button>
              ))}
              {!contests.length && <p className="text-sm text-slate-500">No contests yet. Create one on the right.</p>}
            </div>

            {selectedContest && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Selected contest</p>
                    <h3 className="text-xl font-semibold text-white">{selectedContest.title}</h3>
                    <p className="text-xs text-slate-400">{selectedContest.description ?? "No description"}</p>
                  </div>
                  {selectedContest.target_value && (
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200">
                      Target: {selectedContest.target_value}
                    </span>
                  )}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 text-sm">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Timeline</p>
                    <p className="text-slate-200">{selectedContest.start_date} to {selectedContest.end_date}</p>
                    <p className="text-xs text-slate-400">Scope: {selectedContest.scope_level}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 text-sm">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Status</p>
                    <p className="text-slate-200 capitalize">{selectedContest.status}</p>
                    <p className="text-xs text-slate-400">Metric: {selectedContest.metric_key}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="text-lg font-semibold text-white">Leaderboard</h4>
                  <div className="mt-2 overflow-hidden rounded-2xl border border-slate-800">
                    <table className="min-w-full divide-y divide-slate-800 text-sm">
                      <thead className="bg-slate-900/60 text-slate-400">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Rank</th>
                          <th className="px-3 py-2 text-left font-semibold">Shop</th>
                          <th className="px-3 py-2 text-left font-semibold">Total</th>
                          <th className="px-3 py-2 text-left font-semibold">Last update</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((entry, index) => (
                          <tr key={`${entry.contest_id}-${entry.shop_number}`} className={index % 2 ? "bg-slate-900/30" : ""}>
                            <td className="px-3 py-2 text-slate-400">{index + 1}</td>
                            <td className="px-3 py-2 font-semibold text-white">{entry.shop_number ?? "--"}</td>
                            <td className="px-3 py-2 text-emerald-300 font-semibold">{entry.total_value ?? 0}</td>
                            <td className="px-3 py-2 text-xs text-slate-500">{entry.last_update ?? "--"}</td>
                          </tr>
                        ))}
                        {!leaderboard.length && (
                          <tr>
                            <td colSpan={4} className="px-3 py-4 text-center text-sm text-slate-500">
                              No progress logged yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                  <p className="text-sm font-semibold text-white">Log daily totals</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <input
                      type="text"
                      placeholder="Shop #"
                      value={progressForm.shop_number}
                      onChange={(event) => setProgressForm((prev) => ({ ...prev, shop_number: event.target.value }))}
                      className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                    <input
                      type="number"
                      placeholder="Total"
                      value={progressForm.daily_total}
                      onChange={(event) => setProgressForm((prev) => ({ ...prev, daily_total: event.target.value }))}
                      className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                    <input
                      type="date"
                      value={progressForm.progress_date}
                      onChange={(event) => setProgressForm((prev) => ({ ...prev, progress_date: event.target.value }))}
                      className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleProgress}
                    disabled={loggingProgress}
                    className="mt-3 w-full rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {loggingProgress ? "Saving…" : "Submit progress"}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-900 bg-slate-950/70 p-4 shadow-inner shadow-black/30">
            <div>
              <h2 className="text-2xl font-semibold text-white">Start a contest</h2>
              <p className="text-xs text-slate-400">DMs and RDs can launch challenges that sync to the Pulse Check app instantly.</p>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Contest title"
                value={contestForm.title}
                onChange={(event) => setContestForm((prev) => ({ ...prev, title: event.target.value }))}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
              />
              <textarea
                placeholder="Description"
                value={contestForm.description}
                onChange={(event) => setContestForm((prev) => ({ ...prev, description: event.target.value }))}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
                rows={3}
              />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Metric</p>
                  <select
                    value={contestForm.metric_key}
                    onChange={(event) => setContestForm((prev) => ({ ...prev, metric_key: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white"
                  >
                    {metricOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Scope</p>
                  <select
                    value={contestForm.scope_level}
                    onChange={(event) => setContestForm((prev) => ({ ...prev, scope_level: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white"
                  >
                    {scopeOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Start date</p>
                  <input
                    type="date"
                    value={contestForm.start_date}
                    onChange={(event) => setContestForm((prev) => ({ ...prev, start_date: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">End date</p>
                  <input
                    type="date"
                    value={contestForm.end_date}
                    onChange={(event) => setContestForm((prev) => ({ ...prev, end_date: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Target (optional)</p>
                <input
                  type="number"
                  value={contestForm.target_value}
                  onChange={(event) => setContestForm((prev) => ({ ...prev, target_value: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </div>
              <button
                type="button"
                onClick={handleCreateContest}
                disabled={creating}
                className="w-full rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {creating ? "Publishing…" : "Launch contest"}
              </button>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
              <p className="font-semibold text-slate-100">How sync works</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Contests created here publish to the Pulse Check app instantly through Supabase realtime.</li>
                <li>When shops submit totals in the app, the leaderboard updates here without refresh.</li>
                <li>DMs can back-fill or correct totals by logging a manual daily value above.</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function upsertContestList(list: ContestSummary[], summary: ContestSummary, cap: number) {
  const next = [...list];
  const index = next.findIndex((contest) => contest.id === summary.id);
  if (index >= 0) {
    next[index] = summary;
  } else {
    next.unshift(summary);
  }
  if (next.length > cap) {
    next.length = cap;
  }
  return next;
}
