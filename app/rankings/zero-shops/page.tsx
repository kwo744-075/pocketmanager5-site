"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const metricFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type MetricFilter = "all" | "cars" | "sales" | "big4" | "coolants" | "diffs" | "mobil1" | "donations";

const metricFilterDefinitions: Array<{ key: MetricFilter; label: string; description: string }> = [
  { key: "all", label: "All metrics", description: "Every shop with at least one zero" },
  { key: "cars", label: "Cars", description: "No car count recorded" },
  { key: "sales", label: "Sales", description: "$0 sales in slot" },
  { key: "big4", label: "Big 4", description: "Big 4 conversion at zero" },
  { key: "coolants", label: "Coolants", description: "Coolant upsells missing" },
  { key: "diffs", label: "Diffs", description: "Diff services at zero" },
  { key: "mobil1", label: "Mobil 1", description: "Mobil 1 attachment missing" },
  { key: "donations", label: "Donations", description: "Donation entry not logged" },
];

type ZeroShopRow = {
  shopNumber: string;
  shopName: string;
  district: string;
  region: string;
  metric: Exclude<MetricFilter, "all">;
  missedSlots: string;
  consecutiveZeros: number;
  lastEntry: string;
  note: string;
};

const zeroShopsSeed: ZeroShopRow[] = [
  {
    shopNumber: "18",
    shopName: "Bluebonnet",
    district: "Baton Rouge South",
    region: "Gulf Coast",
    metric: "cars",
    missedSlots: "5 PM, 8 PM",
    consecutiveZeros: 2,
    lastEntry: "2025-03-14T20:00:00",
    note: "Closing manager out sick; coverage pending",
  },
  {
    shopNumber: "07",
    shopName: "Airline",
    district: "Baton Rouge North",
    region: "Gulf Coast",
    metric: "donations",
    missedSlots: "12 PM, 2:30 PM",
    consecutiveZeros: 3,
    lastEntry: "2025-03-14T14:30:00",
    note: "Donation iPad offline — needs reboot",
  },
  {
    shopNumber: "34",
    shopName: "Uptown",
    district: "New Orleans",
    region: "Gulf Coast",
    metric: "big4",
    missedSlots: "5 PM",
    consecutiveZeros: 1,
    lastEntry: "2025-03-14T17:00:00",
    note: "Big 4 form left blank (coaching today)",
  },
  {
    shopNumber: "42",
    shopName: "Lafayette",
    district: "Acadiana",
    region: "Gulf Coast",
    metric: "coolants",
    missedSlots: "12 PM, 5 PM",
    consecutiveZeros: 4,
    lastEntry: "2025-03-13T17:00:00",
    note: "Tech turnover — refresher scheduled",
  },
  {
    shopNumber: "55",
    shopName: "Lake Charles",
    district: "Acadiana",
    region: "Gulf Coast",
    metric: "mobil1",
    missedSlots: "2:30 PM",
    consecutiveZeros: 2,
    lastEntry: "2025-03-14T14:30:00",
    note: "Mobil 1 tote empty — delivery ETA noon",
  },
  {
    shopNumber: "63",
    shopName: "Hammond",
    district: "Northshore",
    region: "Gulf Coast",
    metric: "diffs",
    missedSlots: "8 PM",
    consecutiveZeros: 3,
    lastEntry: "2025-03-13T20:00:00",
    note: "Diff machine pressure alert",
  },
];

const metricLabels: Record<Exclude<MetricFilter, "all">, string> = {
  cars: "Cars",
  sales: "Sales",
  big4: "Big 4",
  coolants: "Coolants",
  diffs: "Diffs",
  mobil1: "Mobil 1",
  donations: "Donations",
};

const metricSeverity: Record<Exclude<MetricFilter, "all">, string> = {
  cars: "bg-rose-500/20 text-rose-100",
  sales: "bg-rose-500/20 text-rose-100",
  big4: "bg-amber-400/20 text-amber-100",
  coolants: "bg-sky-500/20 text-sky-100",
  diffs: "bg-indigo-500/20 text-indigo-100",
  mobil1: "bg-emerald-500/20 text-emerald-100",
  donations: "bg-purple-500/20 text-purple-100",
};

const isMetricFilter = (value: string | null): value is MetricFilter =>
  metricFilterDefinitions.some((filter) => filter.key === value);

export default function ZeroShopsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFilter = searchParams ? searchParams.get("metric") : null;
  const [filter, setFilter] = useState<MetricFilter>(
    initialFilter && isMetricFilter(initialFilter) ? initialFilter : "all"
  );

  const filteredRows = useMemo(() => {
    if (filter === "all") {
      return zeroShopsSeed;
    }
    return zeroShopsSeed.filter((row) => row.metric === filter);
  }, [filter]);

  const metricCounts = useMemo(() => {
    return metricFilterDefinitions.reduce<Record<MetricFilter, number>>((acc, def) => {
      if (def.key === "all") {
        acc[def.key] = zeroShopsSeed.length;
      } else {
        acc[def.key] = zeroShopsSeed.filter((row) => row.metric === def.key).length;
      }
      return acc;
    }, {} as Record<MetricFilter, number>);
  }, []);

  const primaryShop = filteredRows[0];

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
          <Link href="/rankings/detail" className="text-xs text-emerald-300 hover:underline">
            Rankings detail
          </Link>
        </div>

        <section className="rounded-3xl border border-slate-900 bg-slate-950/70 p-5 shadow-inner shadow-black/40">
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300">Zero shops list</p>
          <h1 className="text-3xl font-semibold text-white">Shops with zeros in key KPIs</h1>
          <p className="text-sm text-slate-300">
            {filteredRows.length} shop{filteredRows.length === 1 ? "" : "s"} • filter to focus your follow-ups
          </p>
        </section>

        <div className="flex flex-wrap gap-2">
          {metricFilterDefinitions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                filter === option.key
                  ? "border-amber-400 bg-amber-500/10 text-amber-50"
                  : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600"
              }`}
            >
              <span>{option.label}</span>
              <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                {metricCounts[option.key] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {primaryShop && (
          <div className="rounded-3xl border border-slate-900 bg-slate-950/70 p-5 shadow-inner shadow-black/40">
            <p className="text-xs uppercase tracking-wide text-amber-300">Most urgent</p>
            <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  #{primaryShop.shopNumber} {primaryShop.shopName}
                </h2>
                <p className="text-sm text-slate-400">
                  {primaryShop.district} • {primaryShop.region}
                </p>
                <p className="mt-2 text-sm text-slate-300">{primaryShop.note}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-slate-500">Consecutive zeros</p>
                <p className="text-3xl font-semibold text-white">{primaryShop.consecutiveZeros}</p>
                <p className="text-xs text-slate-500">
                  Last entry {metricFormatter.format(new Date(primaryShop.lastEntry))}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className={`rounded-full px-3 py-1 ${metricSeverity[primaryShop.metric]}`}>
                {metricLabels[primaryShop.metric]}
              </span>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-200">
                Missed slots: {primaryShop.missedSlots}
              </span>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-3xl border border-slate-900 bg-slate-950/70 shadow-inner shadow-black/40">
          <div className="border-b border-slate-900 bg-slate-900/40 px-4 py-3 text-xs text-slate-400">
            Tap a row to open the shop&apos;s Pulse summary screen
          </div>
          <div className="divide-y divide-slate-900">
            {filteredRows.map((row) => (
              <button
                key={row.shopNumber + row.metric}
                type="button"
                onClick={() =>
                  router.push(
                    `/pulse-check5/shop-summary?shopName=${encodeURIComponent(row.shopName)}&shopNumber=${encodeURIComponent(row.shopNumber)}`
                  )
                }
                className="flex w-full flex-col gap-2 px-4 py-4 text-left transition hover:bg-slate-900/60 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-base font-semibold text-white">
                    #{row.shopNumber} {row.shopName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {row.district} • {row.region}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-full px-3 py-1 ${metricSeverity[row.metric]}`}>
                    {metricLabels[row.metric]}
                  </span>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-200">
                    Missed: {row.missedSlots}
                  </span>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-200">
                    {row.consecutiveZeros} zero slot{row.consecutiveZeros === 1 ? "" : "s"}
                  </span>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-200">
                    Last • {metricFormatter.format(new Date(row.lastEntry))}
                  </span>
                </div>
              </button>
            ))}
            {!filteredRows.length && (
              <p className="px-4 py-6 text-center text-sm text-slate-500">
                No shops with zeros for this metric — great job!
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-900 bg-slate-950/70 p-4 text-xs text-slate-400">
          <p className="font-semibold text-slate-200">Next actions</p>
          <ul className="mt-2 list-disc pl-5">
            <li>Assign coverage for shops with 2+ consecutive zero slots.</li>
            <li>Log coaching notes once the gap is resolved to remove from this list.</li>
            <li>Use the Pulse summary screen to submit back-dated entries when appropriate.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
