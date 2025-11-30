"use client";

// app/page.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HierarchyStamp } from "@/app/components/HierarchyStamp";
import { RetailPills } from "@/app/components/RetailPills";
import { BrandWordmark } from "@/app/components/BrandWordmark";
import { ExecutiveDashboard } from "@/app/components/ExecutiveDashboard";
import { supabase, pulseSupabase } from "@/lib/supabaseClient";
import { getCachedSummaryForLogin, normalizeLogin, writeHierarchySummaryCache } from "@/lib/hierarchyCache";
import { fetchRetailContext } from "@/lib/retailCalendar";
import { fetchShopTotals, type PulseTotalsResult, type PulseTotals } from "@/lib/pulseTotals";
import { fetchHierarchyRollups, type RollupSummary, type RollupSlice } from "@/lib/pulseRollups";
import { fetchActiveContests } from "@/lib/contests";

type HierarchySummary = {
  login: string;
  scope_level: string | null;
  division_name: string | null;
  region_name: string | null;
  district_name: string | null;
  shop_number: string | null;
};

type ShopMeta = {
  id: string;
  shop_number: number | null;
  shop_name: string | null;
  district_id: string | null;
  region_id: string | null;
};

type ContestHighlight = {
  activeCount: number;
  leadTitle: string | null;
  endsOn: string | null;
};

type HeroQuickActionVariant = "contest" | "rankings";

type HeroQuickAction = {
  key: HeroQuickActionVariant;
  title: string;
  eyebrow: string;
  primary: string;
  secondary: string;
  href: string;
  variant: HeroQuickActionVariant;
};


const integerFormatter = new Intl.NumberFormat("en-US");
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const todayISO = () => new Date().toISOString().split("T")[0];

const getWeekStartISO = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day;
  const first = new Date(now.setDate(diff));
  return first.toISOString().split("T")[0];
};

const EMPTY_ROLLUPS = {
  district: null as RollupSummary | null,
  region: null as RollupSummary | null,
  division: null as RollupSummary | null,
};

const formatPercent = (value: number | null) => {
  if (value === null || Number.isNaN(value)) {
    return "--";
  }
  return `${value.toFixed(1)}%`;
};

const buildSliceFromTotals = (totals: PulseTotals): RollupSlice => {
  const cars = totals.cars;
  const safePercent = (value: number) => (cars > 0 ? (value / cars) * 100 : null);
  return {
    cars,
    sales: totals.sales,
    aro: cars > 0 ? totals.sales / cars : null,
    big4Pct: safePercent(totals.big4),
    coolantsPct: safePercent(totals.coolants),
    diffsPct: safePercent(totals.diffs),
    mobil1Pct: safePercent(totals.mobil1),
    fuelFilters: totals.fuelFilters,
    donations: totals.donations,
  };
};

type GridMetric = {
  label: string;
  value: string;
  caption?: string;
  tone?: "default" | "success" | "warning";
  secondaryLabel?: string;
  secondaryValue?: string;
};

const formatCurrencyCompact = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return currencyFormatter.format(Math.round(value));
};

const formatIntegerCompact = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return integerFormatter.format(Math.round(value));
};

type LiveKpiConfig = {
  label: string;
  caption?: string;
  getter: (summary: RollupSummary) => string;
};

const LIVE_KPI_CONFIG: LiveKpiConfig[] = [
  { label: "Big 4 mix", caption: "Week mix", getter: (summary) => formatPercent(summary.weekly.big4Pct) },
  { label: "Coolants mix", caption: "Week mix", getter: (summary) => formatPercent(summary.weekly.coolantsPct) },
  { label: "Diffs mix", caption: "Week mix", getter: (summary) => formatPercent(summary.weekly.diffsPct) },
  { label: "Mobil 1 mix", caption: "Week mix", getter: (summary) => formatPercent(summary.weekly.mobil1Pct) },
];

const buildLiveKpiMetrics = (summary: RollupSummary | null): GridMetric[] => {
  const carsDaily = formatIntegerCompact(summary?.daily.cars ?? null);
  const carsWtd = formatIntegerCompact(summary?.weekly.cars ?? null);
  const salesDaily = formatCurrencyCompact(summary?.daily.sales ?? null);
  const salesWtd = formatCurrencyCompact(summary?.weekly.sales ?? null);
  const aroDaily = formatCurrencyCompact(summary?.daily.aro ?? null);
  const aroWtd = formatCurrencyCompact(summary?.weekly.aro ?? null);

  const baseline: GridMetric[] = [
    {
      label: "Cars",
      caption: "Daily / WTD",
      value: carsDaily,
      secondaryLabel: "WTD",
      secondaryValue: carsWtd,
    },
    {
      label: "Sales",
      caption: "Daily / WTD",
      value: salesDaily,
      secondaryLabel: "WTD",
      secondaryValue: salesWtd,
    },
    {
      label: "ARO",
      caption: "Daily / WTD",
      value: aroDaily,
      secondaryLabel: "WTD",
      secondaryValue: aroWtd,
    },
  ];

  const extended = LIVE_KPI_CONFIG.map(({ label, caption, getter }) => ({
    label,
    caption,
    value: summary ? getter(summary) : "--",
  }));

  const donationsMetric: GridMetric = {
    label: "Donations",
    caption: "Week to date",
    value: summary ? formatCurrencyCompact(summary.weekly.donations) : "--",
  };

  const orderedExtended: GridMetric[] = [extended[0], extended[1], extended[2], donationsMetric, extended[3]].filter(
    (metric): metric is GridMetric => Boolean(metric)
  );

  return [...baseline, ...orderedExtended];
};

const ADMIN_MANAGEMENT_METRICS: GridMetric[] = [
  {
    label: "Current contests",
    value: "2",
    caption: "Region Big 4 push; Zero Zeros challenge",
    tone: "warning",
  },
  {
    label: "Challenges today / WTD",
    value: "3 / 11",
    caption: "Completed challenges (placeholder)",
  },
  {
    label: "Inventory saved/exported",
    value: "12",
    caption: "Inventory files saved or exported (placeholder)",
  },
  {
    label: "Cadence completion",
    value: "86% / 93%",
    caption: "Daily / WTD cadence completion (placeholder)",
    tone: "success",
  },
  {
    label: "Games played",
    value: "18",
    caption: "Pocket Manager games or flashcards (placeholder)",
  },
  {
    label: "Current staffed %",
    value: "94%",
    caption: "Of target labor hours (placeholder)",
    tone: "success",
  },
  {
    label: "Employees +/-",
    value: "+1 / -0",
    caption: "Staffing changes (placeholder)",
  },
  {
    label: "Training compliance",
    value: "92%",
    caption: "Shop-wide training (placeholder)",
    tone: "success",
  },
  {
    label: "Staffed vs ideal",
    value: "94%",
    caption: "Scheduled vs ideal (placeholder)",
  },
  {
    label: "Average tenure",
    value: "3.2 yrs",
    caption: "Average SM/ASM tenure (placeholder)",
  },
  {
    label: "Meetings today / WTD",
    value: "2 / 7",
    caption: "Shop visits or meetings (placeholder)",
  },
  {
    label: "Claims submitted today / WTD",
    value: "1 / 3",
    caption: "Warranty or damage claims (placeholder)",
  },
];

const buildAdminManagementMetrics = (): GridMetric[] => ADMIN_MANAGEMENT_METRICS;

type TrendKpiKey = "cars" | "sales" | "aro" | "big4" | "coolants" | "diffs" | "mobil1" | "donations";
type TrendValueFormat = "number" | "currency" | "aro" | "percent";

const TREND_KPI_HEADERS: Array<{ key: TrendKpiKey; label: string; format: TrendValueFormat }> = [
  { key: "cars", label: "Cars", format: "number" },
  { key: "sales", label: "Sales", format: "currency" },
  { key: "aro", label: "ARO", format: "aro" },
  { key: "big4", label: "Big 4", format: "percent" },
  { key: "coolants", label: "Coolants", format: "percent" },
  { key: "diffs", label: "Diffs", format: "percent" },
  { key: "mobil1", label: "Mobil 1", format: "percent" },
  { key: "donations", label: "Donations", format: "currency" },
];

const TREND_KPI_TEMPLATE: Record<TrendKpiKey, { base: number; decay: number; min?: number }> = {
  cars: { base: 220, decay: 5, min: 120 },
  sales: { base: 48000, decay: 1200, min: 20000 },
  aro: { base: 215, decay: 2, min: 160 },
  donations: { base: 900, decay: 25, min: 250 },
  big4: { base: 48, decay: 0.6, min: 30 },
  coolants: { base: 24, decay: 0.3, min: 12 },
  diffs: { base: 9, decay: 0.2, min: 4 },
  mobil1: { base: 18, decay: 0.25, min: 8 },
};

const TREND_SCOPE_WEIGHTS: Record<RollupSummary["scope"], number> = {
  SHOP: 1,
  DISTRICT: 0.96,
  REGION: 0.92,
  DIVISION: 0.88,
};

const formatTrendValue = (value: number, format: TrendValueFormat): string => {
  switch (format) {
    case "currency":
      return currencyFormatter.format(Math.round(value));
    case "aro":
      return value <= 0 ? "--" : `$${value.toFixed(1)}`;
    case "percent":
      return `${value.toFixed(1)}%`;
    default:
      return integerFormatter.format(Math.round(value));
  }
};

type MetricsPanelProps = {
  title: string;
  eyebrow: string;
  metrics: GridMetric[];
  size?: "default" | "compact" | "micro" | "nano" | "pico" | "femto" | "zepto" | "yocto";
};

type PanelTone = "aurora" | "plasma" | "citrine" | "midnight";

const PANEL_TONES: Record<PanelTone, { container: string; overlay: string }> = {
  aurora: {
    container:
      "border-emerald-400/40 bg-gradient-to-br from-[#031628]/95 via-[#041128]/95 to-[#01050f]/98 shadow-[0_35px_90px_rgba(4,44,74,0.85)]",
    overlay: "bg-[radial-gradient(circle_at_top,_rgba(6,182,212,0.3),_transparent_55%)]",
  },
  plasma: {
    container:
      "border-fuchsia-400/40 bg-gradient-to-br from-[#1b0524]/95 via-[#0f0625]/95 to-[#050312]/98 shadow-[0_35px_90px_rgba(54,8,75,0.8)]",
    overlay: "bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.28),_transparent_55%)]",
  },
  citrine: {
    container:
      "border-amber-400/50 bg-gradient-to-br from-[#2b1705]/95 via-[#1b1005]/95 to-[#0d0501]/98 shadow-[0_35px_90px_rgba(75,45,8,0.8)]",
    overlay: "bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.22),_transparent_50%)]",
  },
  midnight: {
    container:
      "border-sky-400/40 bg-gradient-to-br from-[#030d1f]/95 via-[#040b1b]/96 to-[#01040c]/98 shadow-[0_35px_90px_rgba(10,25,55,0.85)]",
    overlay: "bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.24),_transparent_55%)]",
  },
};

const CARD_GRADIENTS = [
  "border-cyan-400/30 from-[#052538]/85 via-[#031625]/90 to-[#010a15]/95",
  "border-indigo-400/30 from-[#0c1440]/85 via-[#060b24]/90 to-[#02040f]/95",
  "border-emerald-400/30 from-[#022c22]/85 via-[#011a15]/90 to-[#000d0a]/95",
  "border-amber-400/30 from-[#3a1c05]/85 via-[#1f0d03]/90 to-[#0b0401]/95",
  "border-fuchsia-400/30 from-[#330222]/85 via-[#190111]/90 to-[#080009]/95",
  "border-sky-400/30 from-[#042535]/85 via-[#021520]/90 to-[#010a12]/95",
  "border-rose-400/30 from-[#360513]/85 via-[#1c0208]/90 to-[#090103]/95",
  "border-lime-400/30 from-[#1f3605]/85 via-[#102104]/90 to-[#070c01]/95",
  "border-orange-400/30 from-[#361705]/85 via-[#1d0c02]/90 to-[#0a0401]/95",
  "border-purple-400/30 from-[#2a0a3c]/85 via-[#150420]/90 to-[#090111]/95",
  "border-teal-400/30 from-[#03312b]/85 via-[#021c18]/90 to-[#010c0a]/95",
  "border-yellow-300/30 from-[#3a3205]/85 via-[#201b03]/90 to-[#0c0901]/95",
];

function MetricsPanel({ title, eyebrow, metrics, size = "default" }: MetricsPanelProps) {
  const sizeConfig = {
    default: {
      container: "rounded-[28px] border border-white/5 bg-[#050f24]/80 p-4 shadow-[0_25px_65px_rgba(1,6,20,0.7)] backdrop-blur space-y-3",
      title: "text-xl",
      gap: "gap-2",
      cols: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
    },
    compact: {
      container: "rounded-[12px] border border-white/5 bg-[#050f24]/85 p-1.5 shadow-[0_8px_20px_rgba(1,6,20,0.5)] backdrop-blur space-y-0.5",
      title: "text-[11px]",
      gap: "gap-0.5",
      cols: "grid-cols-2 sm:grid-cols-4",
    },
    micro: {
      container: "rounded-[10px] border border-white/5 bg-[#050f24]/90 p-1 shadow-[0_5px_12px_rgba(1,6,20,0.45)] backdrop-blur space-y-0.5",
      title: "text-[10px]",
      gap: "gap-0.5",
      cols: "grid-cols-2 sm:grid-cols-4",
    },
    nano: {
      container: "rounded-[8px] border border-white/5 bg-[#050f24]/95 p-0.5 shadow-[0_3px_10px_rgba(1,6,20,0.4)] backdrop-blur space-y-0",
      title: "text-[9px]",
      gap: "gap-0",
      cols: "grid-cols-2",
    },
    pico: {
      container: "rounded-[5px] border border-white/5 bg-[#050f24]/[0.985] p-0.25 shadow-[0_1px_4px_rgba(1,6,20,0.3)] backdrop-blur space-y-0",
      title: "text-[7px]",
      gap: "gap-0",
      cols: "grid-cols-2",
    },
    femto: {
      container: "rounded-[4px] border border-white/5 bg-[#050f24]/[0.995] p-0.25 shadow-[0_1px_3px_rgba(1,6,20,0.25)] backdrop-blur space-y-0",
      title: "text-[6px]",
      gap: "gap-0",
      cols: "grid-cols-2",
    },
    zepto: {
      container:
        "rounded-[3px] border border-white/15 bg-[#040a18]/[0.995] p-[0.15rem] shadow-[0_0_2px_rgba(1,6,20,0.3)] backdrop-blur-sm space-y-0",
      title: "text-[5px]",
      gap: "gap-[1px]",
      cols: "grid-cols-2",
    },
    yocto: {
      container:
        "rounded-[2px] border border-white/20 bg-[#020712]/[0.995] p-[0.08rem] shadow-none backdrop-blur-sm space-y-0",
      title: "text-[3.6px]",
      gap: "gap-[0.05rem]",
      cols: "grid-cols-2",
    },
  } as const;

  const variant = sizeConfig[size];

  return (
    <div className={`${variant.container}`}>
      <div className="text-center">
        <p
          className={`${
            size === "femto"
              ? "text-[5.5px]"
              : size === "pico"
              ? "text-[6px]"
              : size === "nano"
              ? "text-[8px]"
              : "text-[10px]"
          } uppercase tracking-[0.3em] text-emerald-200/80`}
        >
          {eyebrow}
        </p>
        <h3 className={`${variant.title} font-semibold text-white`}>{title}</h3>
      </div>
      <div className={`grid ${variant.cols} ${variant.gap}`}>
        {metrics.map((metric, index) => (
          <MetricGridCard key={metric.label} metric={metric} index={index} size={size} />
        ))}
      </div>
    </div>
  );
}

function MetricGridCard({ metric, index, size = "default" }: { metric: GridMetric; index: number; size: "default" | "compact" | "micro" | "nano" | "pico" | "femto" | "zepto" | "yocto" }) {
  const toneClass =
    metric.tone === "success"
      ? "text-emerald-200"
      : metric.tone === "warning"
      ? "text-amber-200"
      : "text-slate-100";
  const gradientClass = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const minHeightClass =
    size === "yocto"
      ? "min-h-[6px]"
      : size === "zepto"
      ? "min-h-[9px]"
      : size === "femto"
      ? "min-h-[11px]"
      : size === "pico"
      ? "min-h-[14px]"
      : size === "nano"
      ? "min-h-[20px]"
      : size === "micro"
      ? "min-h-[28px]"
      : size === "compact"
      ? "min-h-[36px]"
      : "min-h-[110px]";
  const paddingClass =
    size === "yocto"
      ? "px-[0.18rem] py-[0.02rem]"
      : size === "zepto"
      ? "px-[0.25rem] py-[0.05rem]"
      : size === "femto"
      ? "px-0.5 py-0"
      : size === "pico"
      ? "px-0.5 py-0"
      : size === "nano"
      ? "px-0.5 py-0"
      : size === "micro"
      ? "p-0.5"
      : size === "compact"
      ? "p-0.5"
      : "p-3";
  const labelText =
    size === "yocto"
      ? "text-[2.5px]"
      : size === "zepto"
      ? "text-[3.1px]"
      : size === "femto"
      ? "text-[3.75px]"
      : size === "pico"
      ? "text-[4.25px]"
      : size === "nano"
      ? "text-[5px]"
      : size === "micro"
      ? "text-[5.5px]"
      : size === "compact"
      ? "text-[6.5px]"
      : "text-[10px]";
  const captionText = labelText;
  const valueText =
    size === "yocto"
      ? "text-[4.2px]"
      : size === "zepto"
      ? "text-[5.25px]"
      : size === "femto"
      ? "text-[6.5px]"
      : size === "pico"
      ? "text-[7.5px]"
      : size === "nano"
      ? "text-[9px]"
      : size === "micro"
      ? "text-[10px]"
      : size === "compact"
      ? "text-[11px]"
      : "text-lg";
  const secondaryText =
    size === "yocto"
      ? "text-[3.1px]"
      : size === "zepto"
      ? "text-[3.9px]"
      : size === "femto"
      ? "text-[4.75px]"
      : size === "pico"
      ? "text-[5.25px]"
      : size === "nano"
      ? "text-[6px]"
      : size === "micro"
      ? "text-[7px]"
      : size === "compact"
      ? "text-[8px]"
      : "text-xs";
  const roundedClass =
    size === "yocto"
      ? "rounded-[2px]"
      : size === "zepto"
      ? "rounded-[3px]"
      : size === "femto"
      ? "rounded-[4px]"
      : size === "pico"
      ? "rounded-[5px]"
      : size === "nano"
      ? "rounded-[6px]"
      : size === "micro"
      ? "rounded-[8px]"
      : size === "compact"
      ? "rounded-[10px]"
      : "rounded-2xl";
  const shadowClass =
    size === "yocto"
      ? "shadow-none"
      : size === "zepto"
      ? "shadow-none"
      : size === "femto"
      ? "shadow-[0_0_2px_rgba(1,6,20,0.35)]"
      : size === "pico"
      ? "shadow-[0_1px_3px_rgba(1,6,20,0.35)]"
      : size === "nano"
      ? "shadow-[0_2px_6px_rgba(1,6,20,0.4)]"
      : size === "micro"
      ? "shadow-[0_4px_10px_rgba(1,6,20,0.45)]"
      : size === "compact"
      ? "shadow-[0_6px_16px_rgba(1,6,20,0.55)]"
      : "shadow-[0_18px_40px_rgba(1,6,20,0.75)]";
  const labelTracking =
    size === "yocto"
      ? "tracking-[0.09em]"
      : size === "zepto"
      ? "tracking-[0.12em]"
      : size === "femto"
      ? "tracking-[0.18em]"
      : size === "pico"
      ? "tracking-[0.2em]"
      : size === "nano"
      ? "tracking-[0.22em]"
      : "tracking-[0.25em]";
  const headerSpacing =
    size === "yocto"
      ? "space-y-[0.02rem]"
      : size === "zepto"
      ? "space-y-[0.04rem]"
      : "space-y-1";
  const valueSpacing =
    size === "yocto"
      ? "space-y-[0.02rem]"
      : size === "zepto"
      ? "space-y-[0.04rem]"
      : "space-y-1";

  return (
    <div
      className={`flex ${minHeightClass} flex-col items-center justify-between ${roundedClass} border bg-gradient-to-br ${gradientClass} ${paddingClass} text-center ${shadowClass}`}
    >
      <div className={headerSpacing}>
        <p className={`${labelText} uppercase ${labelTracking} text-slate-300`}>{metric.label}</p>
        {metric.caption && <p className={`${captionText} text-slate-500`}>{metric.caption}</p>}
      </div>
      <div className={`mt-auto ${valueSpacing}`}>
        <p className={`${valueText} font-semibold ${toneClass}`}>{metric.value}</p>
        {metric.secondaryValue && (
          <p className={`${secondaryText} text-slate-400`}>
            {metric.secondaryLabel ? `${metric.secondaryLabel}: ` : ""}
            {metric.secondaryValue}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [hierarchy, setHierarchy] = useState<HierarchySummary | null>(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(true);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);
  const [shopMeta, setShopMeta] = useState<ShopMeta | null>(null);
  const [pulseTotals, setPulseTotals] = useState<PulseTotalsResult | null>(null);
  const [pulseLoading, setPulseLoading] = useState(false);
  const [retailLabel, setRetailLabel] = useState("");
  const [storedShopName, setStoredShopName] = useState<string | null>(null);
  const [divisionId, setDivisionId] = useState<string | null>(null);
  const [rollups, setRollups] = useState(EMPTY_ROLLUPS);
  const [rollupsLoading, setRollupsLoading] = useState(false);
  const [rollupsError, setRollupsError] = useState<string | null>(null);
  const [activeScope, setActiveScope] = useState<RollupSummary["scope"]>("SHOP");
  const [contestHighlight, setContestHighlight] = useState<ContestHighlight>({
    activeCount: 0,
    leadTitle: null,
    endsOn: null,
  });
  const needsLogin = authChecked && !loginEmail;

  const syncAuthState = useCallback(() => {
    if (typeof window === "undefined") return;

    const storedLoggedIn = window.localStorage.getItem("loggedIn") === "true";
    const storedEmail = (window.localStorage.getItem("loginEmail") ?? "").trim().toLowerCase();

    if (!storedLoggedIn || !storedEmail) {
      setIsLoggedIn(false);
      setLoginEmail(null);
      setAuthChecked(true);
      router.replace("/login?redirect=/");
      return;
    }

    setIsLoggedIn(true);
    setLoginEmail(storedEmail);
    setAuthChecked(true);
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "loggedIn" || event.key === "loginEmail") {
        syncAuthState();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [syncAuthState]);

  useEffect(() => {
    syncAuthState();
  }, [syncAuthState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setStoredShopName(window.localStorage.getItem("shopUserName"));
  }, [loginEmail]);

  useEffect(() => {
    let cancelled = false;

    const loadContests = async () => {
      try {
        const contests = await fetchActiveContests(4);
        if (cancelled) {
          return;
        }

        if (!contests.length) {
          setContestHighlight({ activeCount: 0, leadTitle: null, endsOn: null });
          return;
        }

        const leadContest = contests[0];
        setContestHighlight({
          activeCount: contests.length,
          leadTitle: leadContest?.title ?? null,
          endsOn: leadContest?.end_date ?? null,
        });
      } catch (error) {
        if (!cancelled) {
          console.error("Home contest fetch error", error);
          setContestHighlight({ activeCount: 0, leadTitle: null, endsOn: null });
        }
      }
    };

    loadContests();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loginEmail) {
      setHierarchy(null);
      setHierarchyLoading(false);
      setHierarchyError(null);
      return;
    }

    let cancelled = false;
    const normalized = normalizeLogin(loginEmail);
    if (!normalized) {
      setHierarchy(null);
      setHierarchyLoading(false);
      setHierarchyError("Unable to load your hierarchy scope.");
      return;
    }

    const cachedSummary = getCachedSummaryForLogin(normalized);
    if (cachedSummary) {
      setHierarchy((cachedSummary as HierarchySummary) ?? null);
      setHierarchyError(null);
    }
    setHierarchyLoading(true);
    setHierarchyError(null);

    const run = async () => {
      try {
        const { data, error } = await supabase
          .from("hierarchy_summary_vw")
          .select("*")
          .eq("login", normalized)
          .maybeSingle();

        if (cancelled) {
          return;
        }

        if (error) {
          console.error("Home hierarchy_summary_vw error", error);
          if (!getCachedSummaryForLogin(normalized)) {
            setHierarchy(null);
            setHierarchyError("Unable to load your hierarchy scope.");
          }
        } else {
          const resolved = (data as HierarchySummary | null) ?? null;
          if (resolved) {
            setHierarchy(resolved);
            setHierarchyError(null);
            writeHierarchySummaryCache(resolved);
          } else {
            const fallback = getCachedSummaryForLogin(normalized);
            if (fallback) {
              setHierarchy((fallback as HierarchySummary) ?? null);
              setHierarchyError(null);
            } else {
              setHierarchy(null);
              setHierarchyError("Unable to load your hierarchy scope.");
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Home hierarchy fetch error", err);
          if (!getCachedSummaryForLogin(normalized)) {
            setHierarchy(null);
            setHierarchyError("Unable to load your hierarchy scope.");
          }
        }
      } finally {
        if (!cancelled) {
          setHierarchyLoading(false);
        }
      }
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [loginEmail]);

  useEffect(() => {
    if (!hierarchy?.shop_number) {
      setShopMeta(null);
      return;
    }

    const numericShop = Number(hierarchy.shop_number);
    if (Number.isNaN(numericShop)) {
      setShopMeta(null);
      return;
    }

    let cancelled = false;

    const fetchMeta = async () => {
      try {
        const clients = [pulseSupabase, supabase];
        let resolved: ShopMeta | null = null;
        let lastError: unknown = null;

        for (const client of clients) {
          try {
            const { data, error } = await client
              .from("shops")
              .select("id, shop_number, shop_name, district_id, region_id")
              .eq("shop_number", numericShop)
              .limit(1)
              .maybeSingle();

            if (error && error.code !== "PGRST116") {
              lastError = error;
              continue;
            }

            if (data) {
              resolved = data as ShopMeta;
              break;
            }
          } catch (clientErr) {
            lastError = clientErr;
          }
        }

        if (cancelled) {
          return;
        }

        if (resolved) {
          setShopMeta(resolved);
        } else {
          setShopMeta(null);
          if (lastError) {
            console.error("Home shop lookup error", lastError);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Home shop metadata error", err);
          setShopMeta(null);
        }
      }
    };

    fetchMeta();

    return () => {
      cancelled = true;
    };
  }, [hierarchy?.shop_number]);

  useEffect(() => {
    if (!shopMeta?.region_id) {
      setDivisionId(null);
      return;
    }

    let cancelled = false;

    const fetchDivision = async () => {
      try {
        const { data, error } = await pulseSupabase
          .from("regions")
          .select("division_id")
          .eq("id", shopMeta.region_id)
          .maybeSingle();

        if (cancelled) {
          return;
        }

        if (error && error.code !== "PGRST116") {
          console.error("regions lookup error", error);
          setDivisionId(null);
          return;
        }

        setDivisionId((data?.division_id as string | null) ?? null);
      } catch (err) {
        if (!cancelled) {
          console.error("regions lookup exception", err);
          setDivisionId(null);
        }
      }
    };

    fetchDivision();

    return () => {
      cancelled = true;
    };
  }, [shopMeta?.region_id]);

  useEffect(() => {
    if (!shopMeta?.id) {
      setPulseTotals(null);
      return;
    }

    let cancelled = false;
    setPulseLoading(true);

    fetchShopTotals(shopMeta.id)
      .then((result) => {
        if (!cancelled) {
          setPulseTotals(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Home pulse totals error", err);
          setPulseTotals(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPulseLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shopMeta?.id]);

  useEffect(() => {
    if (!shopMeta?.id) {
      setRollups(EMPTY_ROLLUPS);
      setRollupsError(null);
      return;
    }

    const districtId = shopMeta.district_id;
    const regionId = shopMeta.region_id;
    const divisionKey = divisionId;

    if (!districtId && !regionId && !divisionKey) {
      setRollups(EMPTY_ROLLUPS);
      setRollupsError(null);
      return;
    }

    let cancelled = false;
    setRollupsLoading(true);

    fetchHierarchyRollups({
      districtId,
      regionId,
      divisionId: divisionKey ?? undefined,
      districtLabel: hierarchy?.district_name ?? null,
      regionLabel: hierarchy?.region_name ?? null,
      divisionLabel: hierarchy?.division_name ?? null,
      dailyDate: todayISO(),
      weekStart: getWeekStartISO(),
    })
      .then((result) => {
        if (!cancelled) {
          setRollups(result);
          setRollupsError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Home rollups error", err);
          setRollups(EMPTY_ROLLUPS);
          setRollupsError("Unable to load hierarchy rollups right now.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRollupsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shopMeta?.id, shopMeta?.district_id, shopMeta?.region_id, divisionId, hierarchy?.district_name, hierarchy?.region_name, hierarchy?.division_name]);

  useEffect(() => {
    const run = async () => {
      const context = await fetchRetailContext();
      if (context) {
        setRetailLabel(`${context.quarterLabel}-${context.periodLabel}-${context.weekLabel} ${context.dateLabel}`);
      }
    };

    run();
  }, []);

  const handleAuthClick = () => {
    router.push(isLoggedIn ? "/logout" : "/login");
  };

  const shopSummary = useMemo(() => {
    if (!pulseTotals || !shopMeta?.id) return null;
    return {
      scope: "SHOP" as RollupSummary["scope"],
      label: shopMeta?.shop_name ?? (hierarchy?.shop_number ? `Shop #${hierarchy.shop_number}` : "Your shop"),
      daily: buildSliceFromTotals(pulseTotals.daily),
      weekly: buildSliceFromTotals(pulseTotals.weekly),
    } satisfies RollupSummary;
  }, [pulseTotals, shopMeta?.id, shopMeta?.shop_name, hierarchy?.shop_number]);

  const summaryOptions = useMemo(() => {
    const options: RollupSummary[] = [];
    if (shopSummary) options.push(shopSummary);
    if (rollups.district) options.push(rollups.district);
    if (rollups.region) options.push(rollups.region);
    if (rollups.division) options.push(rollups.division);
    return options;
  }, [shopSummary, rollups.district, rollups.region, rollups.division]);

  useEffect(() => {
    if (!summaryOptions.length) {
      return;
    }
    const current = summaryOptions.find((option) => option.scope === activeScope);
    if (!current) {
      setActiveScope(summaryOptions[0].scope);
    }
  }, [summaryOptions, activeScope]);

  const activeSummary = summaryOptions.find((option) => option.scope === activeScope) ?? null;
  const liveKpiCards = useMemo(() => buildLiveKpiMetrics(activeSummary ?? null), [activeSummary]);
  const adminManagementCards = useMemo(() => buildAdminManagementMetrics(), []);
  const trendGridRows = useMemo(() => {
    const resolvedScope = activeScope ?? "SHOP";
    const scopeWeight = TREND_SCOPE_WEIGHTS[resolvedScope] ?? 1;
    const scopeDescriptor =
      activeSummary?.label ??
      (resolvedScope === "SHOP" ? "Shop scope" : resolvedScope.toLowerCase());
    const now = new Date();

    return Array.from({ length: 13 }).map((_, index) => {
      const weekDate = new Date(now);
      weekDate.setDate(now.getDate() - index * 7);
      const label = weekDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const descriptor = `Week ending ${weekDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

      const metrics = TREND_KPI_HEADERS.reduce<Record<TrendKpiKey, string>>((acc, header) => {
        const template = TREND_KPI_TEMPLATE[header.key];
        let rawValue = template.base * scopeWeight - template.decay * index;
        if (header.format === "percent") {
          rawValue = Math.min(100, rawValue);
        }
        if (template.min !== undefined) {
          rawValue = Math.max(template.min, rawValue);
        }
        acc[header.key] = formatTrendValue(rawValue, header.format);
        return acc;
      }, {} as Record<TrendKpiKey, string>);

      return {
        id: `${resolvedScope}-${index}`,
        label,
        descriptor: `${descriptor} • ${scopeDescriptor}`,
        metrics,
      };
    });
  }, [activeScope, activeSummary]);
  const rollupSubtitle = retailLabel ? `${retailLabel} • All-day performance` : "All-day performance";
  const liveScopeLoading = activeSummary?.scope === "SHOP" ? pulseLoading : rollupsLoading;
  const livePanelEyebrow = activeSummary
    ? `${activeSummary.label} • ${
        activeSummary.scope === "SHOP" ? "shop scope" : activeSummary.scope.toLowerCase()
      }${liveScopeLoading ? " • refreshing" : ""}`
    : "Live scope";
  const contestEndsLabel = useMemo(() => {
    if (!contestHighlight.endsOn) {
      return "Sync daily progress";
    }
    const parsed = new Date(contestHighlight.endsOn);
    if (Number.isNaN(parsed.getTime())) {
      return "Sync daily progress";
    }
    return `Ends ${parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }, [contestHighlight.endsOn]);
  const rankingHighlight = useMemo(() => {
    const reference = rollups.district ?? rollups.region ?? rollups.division ?? shopSummary;
    if (!reference) {
      return {
        eyebrow: "Leaderboards",
        primary: "View standings",
        secondary: "Shop + district rankings",
      };
    }

    const label = reference.label ?? (reference.scope === "SHOP" ? "Shop" : reference.scope ?? "Scope");
    const percentValue =
      typeof reference.weekly.big4Pct === "number" && !Number.isNaN(reference.weekly.big4Pct)
        ? `${formatPercent(reference.weekly.big4Pct)} Big 4`
        : null;
    const carsValue =
      typeof reference.weekly.cars === "number" && !Number.isNaN(reference.weekly.cars)
        ? `${formatIntegerCompact(reference.weekly.cars)} cars`
        : null;

    return {
      eyebrow: reference.scope === "SHOP" ? "Shop scope" : `${reference.scope?.toLowerCase() ?? "scope"} view`,
      primary: percentValue ?? carsValue ?? "View standings",
      secondary: `${label} standings`,
    };
  }, [rollups.district, rollups.region, rollups.division, shopSummary]);
  const heroQuickActions = useMemo<HeroQuickAction[]>(
    () => [
      {
        key: "contest",
        title: "Contest portal",
        eyebrow: contestHighlight.activeCount ? `${contestHighlight.activeCount} live` : "Launch push",
        primary: contestHighlight.leadTitle ?? "Start a contest to push KPIs",
        secondary: contestEndsLabel,
        href: "/contests",
        variant: "contest",
      },
      {
        key: "rankings",
        title: "Rankings",
        eyebrow: rankingHighlight.eyebrow,
        primary: rankingHighlight.primary,
        secondary: rankingHighlight.secondary,
        href: "/rankings/detail",
        variant: "rankings",
      },
    ],
    [contestHighlight.activeCount, contestHighlight.leadTitle, contestEndsLabel, rankingHighlight],
  );
  const brandTileClasses =
    "inline-flex items-center justify-center gap-1.5 rounded-[18px] border border-white/5 bg-gradient-to-br from-[#0c1a36]/90 via-[#07142d]/90 to-[#030a18]/95 px-3 py-2 text-[10px] font-semibold text-slate-100 shadow-[0_12px_30px_rgba(1,6,20,0.75)] backdrop-blur transition hover:border-emerald-400/60 min-w-[120px]";
  const heroQuickBaseClasses =
    "relative flex min-w-[150px] max-w-[230px] flex-col gap-1 rounded-2xl border px-3 py-2 text-left text-sm shadow-[0_20px_45px_rgba(3,10,22,0.65)] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300";
  const heroQuickVariantClasses: Record<HeroQuickActionVariant, string> = {
    contest: "border-amber-400/50 bg-gradient-to-br from-amber-500/20 via-amber-500/5 to-[#050b1b]/90",
    rankings: "border-sky-400/50 bg-gradient-to-br from-sky-500/20 via-sky-500/5 to-[#050b1b]/90",
  };
  const heroQuickScaleClasses =
    "transform-gpu scale-[0.85] hover:scale-[0.9] focus-visible:scale-[0.9] transition-transform";
  const heroQuickCtaClasses: Record<HeroQuickActionVariant, string> = {
    contest: "text-amber-200",
    rankings: "text-sky-200",
  };
  const panelBaseClasses = (
    tone: PanelTone = "aurora",
    variant: "default" | "compact" = "default"
  ) => {
    const radius = variant === "compact" ? "rounded-[18px]" : "rounded-[28px]";
    const padding = variant === "compact" ? "p-2.5 sm:p-3.5" : "p-5";
    return `relative overflow-hidden ${radius} border ${padding} backdrop-blur ${PANEL_TONES[tone].container}`;
  };
  const panelOverlayClasses = (tone: PanelTone = "aurora") =>
    `pointer-events-none absolute inset-0 ${PANEL_TONES[tone].overlay}`;
  const scopePillClasses = (scope: RollupSummary["scope"], isActive: boolean) => {
    const palette: Record<string, { active: string; inactive: string }> = {
      SHOP: {
        active:
          "border-emerald-400/80 bg-gradient-to-r from-emerald-500/25 via-emerald-500/10 to-transparent text-emerald-100 shadow-[0_2px_8px_rgba(16,185,129,0.35)]",
        inactive:
          "border-emerald-500/30 text-emerald-100/80 hover:border-emerald-400/60 hover:bg-emerald-500/5",
      },
      DISTRICT: {
        active:
          "border-cyan-400/80 bg-gradient-to-r from-cyan-500/25 via-cyan-500/10 to-transparent text-cyan-100 shadow-[0_2px_8px_rgba(6,182,212,0.35)]",
        inactive:
          "border-cyan-500/30 text-cyan-100/80 hover:border-cyan-400/60 hover:bg-cyan-500/5",
      },
      REGION: {
        active:
          "border-violet-400/80 bg-gradient-to-r from-violet-500/25 via-violet-500/10 to-transparent text-violet-100 shadow-[0_2px_8px_rgba(124,58,237,0.35)]",
        inactive:
          "border-violet-500/30 text-violet-100/80 hover:border-violet-400/60 hover:bg-violet-500/5",
      },
      DIVISION: {
        active:
          "border-amber-400/80 bg-gradient-to-r from-amber-500/25 via-amber-500/10 to-transparent text-amber-100 shadow-[0_2px_8px_rgba(251,191,36,0.35)]",
        inactive:
          "border-amber-500/30 text-amber-100/80 hover:border-amber-400/60 hover:bg-amber-500/5",
      },
    };
    const tones = palette[scope] ?? {
      active:
        "border-slate-500/70 bg-gradient-to-r from-slate-500/20 via-slate-500/5 to-transparent text-slate-100 shadow-[0_2px_6px_rgba(148,163,184,0.25)]",
      inactive: "border-slate-600 text-slate-400 hover:border-emerald-400/50 hover:text-emerald-100",
    };

    return isActive ? tones.active : tones.inactive;
  };

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
        <p className="text-sm text-slate-400">Checking login status…</p>
      </main>
    );
  }

  if (needsLogin) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
        <p className="text-sm text-slate-400">Redirecting to login…</p>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <header className="space-y-2.5">
          <div className="space-y-2.5">
            <div className="space-y-1">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                <Link
                  href="/pocket-manager5"
                  className={`${brandTileClasses} justify-self-start`}
                  aria-label="Go to Pocket Manager5"
                >
                  <BrandWordmark
                    brand="pocket"
                    mode="dark"
                    showBadge={false}
                    className="text-[1.1rem] leading-none"
                  />
                </Link>
                <div className="text-center">
                  <h1 className="text-2xl sm:text-3xl font-bold">
                    <span className="text-red-500">P</span>ocket&nbsp;Manager
                    <span className="text-red-500">5</span>
                  </h1>
                </div>
                <Link
                  href="/pulse-check5"
                  className={`${brandTileClasses} justify-self-end`}
                  aria-label="Open Pulse Check5"
                >
                  <BrandWordmark
                    brand="pulse"
                    mode="dark"
                    showBadge={false}
                    className="text-[1.1rem] leading-none"
                  />
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex flex-col items-start gap-2">
                <RetailPills />
              </div>

              <div className="flex w-full flex-col gap-2 md:w-auto">
                <div className="flex w-full flex-wrap items-center gap-2">
                  <div className="flex min-w-[200px] flex-1 text-left">
                    {hierarchyLoading ? (
                      <p className="text-xs text-slate-500">Loading scope…</p>
                    ) : hierarchyError ? (
                      <p className="text-xs text-amber-300">Scope unavailable</p>
                    ) : (
                      <HierarchyStamp align="left" hierarchy={hierarchy} loginEmail={loginEmail} />
                    )}
                  </div>
                  <button
                    onClick={handleAuthClick}
                    className="rounded-full border border-emerald-400/80 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                  >
                    {isLoggedIn ? "Logout" : "Login"}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-stretch gap-3 pt-2 md:flex-nowrap md:items-center md:justify-between">
              {heroQuickActions.map((action) => {
                const ariaLabelParts = [action.title, action.primary, action.secondary].filter(Boolean);
                const ariaLabel = ariaLabelParts.length ? ariaLabelParts.join(". ") : `Open ${action.title}`;

                return (
                  <Link
                    key={action.key}
                    href={action.href}
                    className={`${heroQuickBaseClasses} ${heroQuickVariantClasses[action.variant]} ${heroQuickScaleClasses} flex-none w-full md:w-auto`}
                    aria-label={ariaLabel}
                  >
                    <p className="text-sm font-semibold text-white">{action.title}</p>
                    <span className={`text-xs font-semibold ${heroQuickCtaClasses[action.variant]}`}>Open →</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </header>

        {hierarchyError && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {hierarchyError}
          </div>
        )}

        {summaryOptions.length > 0 && activeSummary && (
          <section className={`${panelBaseClasses("plasma", "compact")} p-3 sm:p-4`}>
            <div className={panelOverlayClasses("plasma")} />
            <div className="relative space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  {summaryOptions.map((option) => (
                    <button
                      key={option.scope}
                      onClick={() => setActiveScope(option.scope)}
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${scopePillClasses(
                        option.scope,
                        option.scope === activeScope
                      )}`}
                    >
                      {option.scope === "SHOP" ? "Shop" : option.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{rollupSubtitle}</p>
              </div>
              {rollupsError && summaryOptions.length > 1 && (
                <p className="text-xs text-amber-300">{rollupsError}</p>
              )}
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
                <div className="rounded-[24px] border border-white/10 bg-slate-950/40 p-3 shadow-[0_25px_65px_rgba(1,6,20,0.6)]">
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300">13-week lookback</p>
                      <h3 className="text-base font-semibold text-white">{activeSummary.label ?? "Scope"} trend</h3>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#030b18]/70">
                      <div className="overflow-x-auto">
                        <div className="min-w-[680px]">
                          <div className="grid grid-cols-[1.4fr_repeat(8,minmax(0,1fr))] bg-white/5 text-[10px] uppercase tracking-[0.3em] text-slate-300">
                            <div className="px-3 py-2">Week</div>
                            {TREND_KPI_HEADERS.map((header) => (
                              <div key={header.key} className="px-3 py-2 text-center">
                                {header.label}
                              </div>
                            ))}
                          </div>
                          <div className="divide-y divide-white/5">
                            {trendGridRows.map((row, index) => (
                              <div
                                key={row.id}
                                className={`grid grid-cols-[1.4fr_repeat(8,minmax(0,1fr))] px-3 py-2 text-xs transition ${
                                  index === 0 ? "bg-emerald-500/5" : index % 2 ? "bg-slate-950/40" : "bg-slate-950/70"
                                }`}
                              >
                                <div>
                                  <p className="text-sm font-semibold text-white">{row.label}</p>
                                  <p className="text-[11px] text-slate-400">{row.descriptor}</p>
                                </div>
                                {TREND_KPI_HEADERS.map((header) => (
                                  <div key={`${row.id}-${header.key}`} className="px-3 py-2 text-[11px] text-slate-100">
                                    {row.metrics[header.key]}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <MetricsPanel
                    title="LIVE KPIs"
                    eyebrow={livePanelEyebrow}
                    metrics={liveKpiCards}
                    size="nano"
                  />
                  <MetricsPanel
                    title="Admin Management"
                    eyebrow="Coaching + compliance snapshot"
                    metrics={adminManagementCards}
                    size="nano"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        <section>
          <ExecutiveDashboard />
        </section>

      </div>
    </main>
  );
}



