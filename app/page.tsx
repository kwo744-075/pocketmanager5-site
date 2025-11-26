"use client";

// app/page.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { HierarchyStamp } from "@/app/components/HierarchyStamp";

type RetailStampState = {
  quarter: string;
  period: string;
  week: string;
  dateLabel: string;
};


type MetricCardProps = {
  label: string;
  value: string;
  note: string;
};

function MetricCard({ label, value, note }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-center">
      <p className="text-[11px] text-slate-400 mb-1">{label}</p>
      <p className="text-lg font-semibold text-emerald-300 break-words">
        {value}
      </p>
      <p className="text-[10px] text-slate-500 mt-1">{note}</p>
    </div>
  );
}

function RetailCalendarStamp({
  quarter,
  period,
  week,
  dateLabel,
}: RetailStampState) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
      <span className="rounded-full bg-blue-500/90 px-3 py-1 text-white uppercase tracking-wide">
        {quarter}
      </span>
      <span className="rounded-full bg-emerald-500/90 px-3 py-1 text-white uppercase tracking-wide">
        {period}
      </span>
      <span className="rounded-full bg-orange-500/90 px-3 py-1 text-white uppercase tracking-wide">
        {week}
      </span>
      <span className="text-sm font-semibold text-slate-100">{dateLabel}</span>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("loggedIn") === "true";
  });
  const [retailStamp, setRetailStamp] = useState<RetailStampState>(() => {
    const today = new Date();
    const dateLabel = today.toISOString().slice(0, 10);
    return { quarter: "Q?", period: "P?", week: "Wk?", dateLabel };
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "loggedIn") {
        setIsLoggedIn(event.newValue === "true");
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchRetailCalendar = async () => {
      const today = new Date();
      const todayISO = today.toISOString().slice(0, 10);

      try {
        // NOTE: This uses the same Supabase tables as the Pocket Manager5 & Pulse Check5 apps.
        const { data, error } = await supabase
          .from("retail_calendar")
          .select("quarter, period_no, weeks, start_date, end_date")
          .lte("start_date", todayISO)
          .gte("end_date", todayISO)
          .order("start_date", { ascending: false })
          .maybeSingle();

        if (error) {
          console.error("Retail calendar fetch error:", error);
          return;
        }

        if (data && isMounted) {
          const startDate = new Date(data.start_date);
          const cleanToday = new Date(todayISO);
          const diffMs = cleanToday.getTime() - startDate.getTime();
          const diffDays = Math.floor(diffMs / 86400000);
          const rawWeek = Math.floor(diffDays / 7) + 1;
          const maxWeeks = Number(data.weeks ?? 1);
          const weekNumber = Math.min(Math.max(rawWeek, 1), maxWeeks || 1);

          setRetailStamp({
            quarter: data.quarter ? `Q${data.quarter}` : "Q?",
            period: data.period_no ? `P${data.period_no}` : "P?",
            week: `Wk${weekNumber}`,
            dateLabel: todayISO,
          });
        }
      } catch (err) {
        console.error("Unexpected retail calendar error:", err);
      }
    };

    fetchRetailCalendar();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleAuthClick = () => {
    router.push(isLoggedIn ? "/logout" : "/login");
  };
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        {/* Header */}
        <header className="space-y-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <RetailCalendarStamp {...retailStamp} />

            <div className="flex flex-col items-start md:items-end gap-2">
              <button
                onClick={handleAuthClick}
                className="inline-flex items-center justify-center rounded-full border border-emerald-400/80 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
              >
                {isLoggedIn ? "Logout" : "Login"}
              </button>
              <HierarchyStamp />
            </div>
          </div>

          <div className="text-center space-y-3">
            <p className="text-[10px] tracking-[0.3em] uppercase text-emerald-400">
              Pocket Manager5 • Pulse Check5
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold">
              <span className="text-red-500">P</span>ocket&nbsp;Manager{" "}
              <span className="text-red-500">5</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto">
              Your central hub for shop performance, visits, coaching, and KPIs –
              pulling together Pocket Manager5 and Pulse Check5 into one view.
            </p>
          </div>
        </header>

        {/* Main dashboard: left KPIs / center 4x3 grid / right KPIs */}
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_minmax(0,1.1fr)] items-start">
          {/* LEFT COLUMN – CURRENT ACTIVITY (stacked KPI boxes) */}
          <div className="space-y-4">
            <MetricCard
              label="Current contests"
              value="2"
              note="Region Big 4 push; Zero Zeros challenge (placeholder)"
            />
            <MetricCard
              label="Challenges done today / WTD"
              value="3 / 11"
              note="Completed challenges (placeholder)"
            />
            {/* extra placeholders on left */}
            <MetricCard
              label="Inventory saved/exported today"
              value="12"
              note="Inventory files saved or exported (placeholder)"
            />
            <MetricCard
              label="Cadence completion daily / WTD"
              value="86% / 93%"
              note="Daily / WTD cadence completion (placeholder)"
            />
            <MetricCard
              label="Games / flashcards played today"
              value="18"
              note="Pocket Manager games or flashcards played (placeholder)"
            />
          </div>

          {/* CENTER COLUMN – SUMMARY ROLLUP (4x3 grid) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-lg shadow-black/30 space-y-4">
            <p className="text-[10px] tracking-[0.25em] uppercase text-emerald-400 text-center">
              Summary rollup (Pocket Manager5 + Pulse Check5)
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 text-xs">
              {/* 12 metrics, now 4 columns x 3 rows on xl */}
              <MetricCard
                label="Shops checked in today"
                value="12 / 14"
                note="Live from Pulse Check5 (placeholder)"
              />
              <MetricCard
                label="Cars"
                value="186"
                note="Today (placeholder)"
              />
              <MetricCard
                label="Sales"
                value="$24,580"
                note="PTD sales (placeholder)"
              />
              <MetricCard
                label="Big 4 performance (PTD)"
                value="103.8%"
                note="Region rollup (placeholder)"
              />
              <MetricCard
                label="Coolants"
                value="15 / 35.2%"
                note="Units sold PTD / mix % (placeholder)"
              />
              <MetricCard
                label="Diffs"
                value="12 / 28.9%"
                note="Units sold PTD / mix % (placeholder)"
              />

              {/* middle row reordered: labor, cash, employees, training */}
              <MetricCard
                label="Current labor hours +/-"
                value="+3.2"
                note="Vs. target (placeholder)"
              />
              <MetricCard
                label="Cash +/-"
                value="+$21.34"
                note="Over / short today (placeholder)"
              />
              <MetricCard
                label="Employees +/-"
                value="+1 / -0"
                note="Staffing changes (placeholder)"
              />
              <MetricCard
                label="Training compliance"
                value="92%"
                note="Shop-wide (placeholder)"
              />

              <MetricCard
                label="Staffed %"
                value="94%"
                note="Scheduled vs. ideal (placeholder)"
              />
              <MetricCard
                label="Average tenure"
                value="3.2 yrs"
                note="Average SM/ASM tenure (placeholder)"
              />
            </div>

            <p className="text-[10px] text-slate-500 mt-1 text-center">
              These values are static for now. Next step is wiring them to your
              existing Supabase views for Pocket Manager5 and Pulse Check5.
            </p>
          </div>

          {/* RIGHT COLUMN – OTHER STATS (stacked KPI boxes) */}
          <div className="space-y-4">
            <MetricCard
              label="Current staffed %"
              value="94%"
              note="Of target labor hours (placeholder)"
            />
            <MetricCard
              label="Meetings today / WTD"
              value="2 / 7"
              note="Shop visits / meetings (placeholder)"
            />
            <MetricCard
              label="Claims submitted today / WTD"
              value="1 / 3"
              note="Warranty / damage claims (placeholder)"
            />
            <MetricCard
              label="Turned cars today"
              value="7 / $849.56"
              note="Count / est. loss (turned x ARO, placeholder)"
            />
            {/* extra placeholder on right */}
            <MetricCard
              label="Manual W/Os"
              value="15 / $1784.00"
              note="Manual work orders saved #/$"
            />
          </div>
        </section>

        {/* Two app tiles */}
        <section className="grid md:grid-cols-2 gap-8">
          {/* Pocket Manager5 card */}
          <a
            href="/pocket-manager5"
            className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between hover:border-emerald-400/80 hover:bg-slate-900 transition"
          >
            <div>
              <h2 className="text-xl font-semibold mb-2 flex items-center justify-between">
                <span>Pocket Manager5</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-400">
                  Daily ops
                </span>
              </h2>
              <p className="text-sm text-slate-300 mb-4">
                Mobile-first toolkit for shop managers and DMs: visits, labor,
                coaching, training, and quick references – designed to live in
                your pocket.
              </p>
              <ul className="text-xs text-slate-300 space-y-2 mb-4">
                <li>• Daily management cadence in your hand</li>
                <li>• Drill down from region → district → shop</li>
                <li>• Ties into your existing Pocket Manager5 app data</li>
              </ul>
            </div>
            <button className="mt-2 inline-flex items-center justify-center rounded-xl border border-emerald-400/70 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-300 group-hover:bg-emerald-500/20">
              Go to Pocket Manager5 →
            </button>
          </a>

          {/* Pulse Check5 card */}
          <a
            href="/pulse-check5"
            className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between hover:border-emerald-400/80 hover:bg-slate-900 transition"
          >
            <div>
              <h2 className="text-xl font-semibold mb-2 flex items-center justify-between">
                <span>Pulse Check5</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-400">
                  Live KPIs
                </span>
              </h2>
              <p className="text-sm text-slate-300 mb-4">
                High-level dashboards for RDs and DMs: shop-by-shop status,
                Big 4, labor, and trends so you know where to coach today.
              </p>
              <ul className="text-xs text-slate-300 space-y-2 mb-4">
                <li>• Region heartbeat in one view</li>
                <li>• Daily &amp; weekly KPI rollups</li>
                <li>• Built to plug into your current Supabase schema</li>
              </ul>
            </div>
            <button className="mt-2 inline-flex items-center justify-center rounded-xl border border-emerald-400/70 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-300 group-hover:bg-emerald-500/20">
              Go to Pulse Check5 →
            </button>
          </a>
        </section>
      </div>
    </main>
  );
}



