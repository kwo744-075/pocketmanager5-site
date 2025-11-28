"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type HierarchySummary = {
  scope_level: string | null;
};

type MetricLeader = {
  metric: string;
  value: string;
  shop: string;
};

type ShopRow = {
  rank: number;
  shop: string;
  met: number;
  missed: number;
  performance: number;
};

type DistrictRow = {
  district: string;
  aro: { act: string; var: string };
  big4: { act: string; var: string };
  coolants: { act: string; var: string };
  diffs: { act: string; var: string };
  mobil1: { act: string; var: string };
  donations: { act: string; var: string };
};

const metricLeaders: MetricLeader[] = [
  { metric: "Cars", value: "132", shop: "#18 Bluebonnet" },
  { metric: "Sales ($)", value: "$48K", shop: "Gulf Coast" },
  { metric: "ARO ($)", value: "$128", shop: "#34 Uptown" },
  { metric: "Big 4 (%)", value: "108%", shop: "Baton Rouge South" },
  { metric: "Coolants (%)", value: "42%", shop: "#11 BR East" },
  { metric: "Diffs (%)", value: "31%", shop: "#42 Lafayette" },
  { metric: "Mobil1 (%)", value: "26%", shop: "#18 Bluebonnet" },
  { metric: "Donations ($)", value: "$2.4K", shop: "#07 Airline" },
];

const topShops: ShopRow[] = [
  { rank: 1, shop: "#18 Bluebonnet", met: 6, missed: 1, performance: 96 },
  { rank: 2, shop: "#34 Uptown", met: 5, missed: 2, performance: 92 },
  { rank: 3, shop: "#11 BR East", met: 5, missed: 2, performance: 90 },
  { rank: 4, shop: "#42 Lafayette", met: 4, missed: 3, performance: 84 },
];

const districtRows: DistrictRow[] = [
  {
    district: "Baton Rouge South",
    aro: { act: "$112", var: "+4" },
    big4: { act: "107%", var: "+3" },
    coolants: { act: "38%", var: "+2" },
    diffs: { act: "29%", var: "+1" },
    mobil1: { act: "24%", var: "+2" },
    donations: { act: "$1.2K", var: "+150" },
  },
  {
    district: "Gulf Coast",
    aro: { act: "$104", var: "-2" },
    big4: { act: "101%", var: "+1" },
    coolants: { act: "33%", var: "0" },
    diffs: { act: "27%", var: "-1" },
    mobil1: { act: "22%", var: "+1" },
    donations: { act: "$980", var: "-80" },
  },
];

export default function RankingsDetailPage() {
  const router = useRouter();
  const [scopeLevel, setScopeLevel] = useState<string | null>(null);
  const [loadingScope, setLoadingScope] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const loginEmail = window.localStorage.getItem("loginEmail");
    if (!loginEmail) {
      setLoadingScope(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const { data, error } = await supabase
          .from("hierarchy_summary_vw")
          .select("scope_level")
          .eq("login", loginEmail.trim().toLowerCase())
          .maybeSingle();

        if (!cancelled) {
          if (error) {
            console.error("Rankings detail hierarchy error", error);
          } else {
            setScopeLevel((data as HierarchySummary | null)?.scope_level ?? null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Rankings detail hierarchy exception", err);
        }
      } finally {
        if (!cancelled) {
          setLoadingScope(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  const isRegionalDirector = useMemo(
    () => (scopeLevel ?? "").toUpperCase() === "REGION",
    [scopeLevel]
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
        <div className="flex items-center justify-between text-sm text-slate-400">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-emerald-400"
          >
            ← Back
          </button>
          <Link href="/pulse-check5" className="text-xs text-emerald-300 hover:underline">
            Pulse Check dashboard
          </Link>
        </div>

        <section className="rounded-3xl border border-slate-900 bg-slate-950/70 p-5 shadow-inner shadow-black/40">
          <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-400">Rankings</p>
          <h1 className="text-3xl font-semibold text-white">Top performers by metric</h1>
          <p className="text-sm text-slate-300">Performance analysis and outlier detection</p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metricLeaders.map((leader) => (
            <div key={leader.metric} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{leader.metric}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{leader.value}</p>
              <p className="text-sm text-emerald-300">{leader.shop}</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => router.push("/rankings/zero-shops")}
          className="flex items-center justify-between rounded-2xl border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-100 transition hover:border-amber-300 hover:bg-amber-400/20"
        >
          <span>ZERO Shops (12) • Shops with zeros in key KPIs</span>
          <span className="text-xs font-semibold">View list →</span>
        </button>

        <section className="rounded-3xl border border-slate-900 bg-slate-950/70 p-5 shadow-inner shadow-black/40">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Top performing shops</h2>
              <p className="text-sm text-slate-400">Ranked by goals met and performance score</p>
            </div>
            <span className="text-xs text-slate-500">Tap a shop to open its Pulse summary</span>
          </div>

          <ul className="mt-4 space-y-3">
            {topShops.map((row) => (
              <li
                key={row.rank}
                className={`rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 ${
                  row.rank === 1 ? "ring-2 ring-emerald-400/60" : ""
                }`}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => {
                    router.push(
                      `/pulse-check5/shop-summary?shopName=${encodeURIComponent(row.shop)}&shopNumber=${encodeURIComponent(row.shop.replace(/[^0-9]/g, ""))}`
                    );
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="h-10 w-10 rounded-full bg-slate-800 text-center text-lg font-semibold text-white flex items-center justify-center">
                      {row.rank}
                    </span>
                    <div>
                      <p className="text-base font-semibold text-white">
                        {row.shop} {row.rank === 1 && <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-200">Leader</span>}
                      </p>
                      <div className="mt-1 flex gap-2 text-xs">
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-200">{row.met} Met</span>
                        <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-rose-200">{row.missed} Missed</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-lg font-semibold text-emerald-300">{row.performance}%</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {isRegionalDirector && (
          <section className="space-y-3 rounded-3xl border border-slate-900 bg-slate-950/70 p-5 shadow-inner shadow-black/40">
            <div>
              <h2 className="text-2xl font-semibold text-white">District rankings</h2>
              <p className="text-sm text-slate-400">Act vs variance on key KPIs</p>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-sky-900/40 text-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">District</th>
                    {['ARO', 'Big 4', 'Cool', 'Diffs', 'Mobil1', 'Donations'].map((col) => (
                      <th key={col} className="px-3 py-2 text-left font-semibold">
                        {col} <span className="text-xs text-slate-300">(Act / Var)</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {districtRows.map((row) => (
                    <tr key={row.district} className="odd:bg-slate-900/40">
                      <td className="px-3 py-2 font-semibold text-white">{row.district}</td>
                      {renderVarianceCell(row.aro)}
                      {renderVarianceCell(row.big4)}
                      {renderVarianceCell(row.coolants)}
                      {renderVarianceCell(row.diffs)}
                      {renderVarianceCell(row.mobil1)}
                      {renderVarianceCell(row.donations)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {loadingScope && (
          <p className="text-center text-xs text-slate-500">Resolving your scope…</p>
        )}
      </div>
    </main>
  );
}

function renderVarianceCell(pair: { act: string; var: string }) {
  const varianceNumber = Number(pair.var.replace(/[^0-9-]/g, ""));
  const isPositive = !Number.isNaN(varianceNumber) && varianceNumber >= 0;
  const color = isPositive ? "text-emerald-300" : "text-rose-300";
  return (
    <td className="px-3 py-2">
      <p className="font-semibold text-white">{pair.act}</p>
      <p className={`text-xs ${color}`}>{pair.var}</p>
    </td>
  );
}
