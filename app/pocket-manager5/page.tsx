"use client";

import Link from "next/link";
import { Component, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { BrandWordmark } from "@/app/components/BrandWordmark";
import { HierarchyStamp } from "@/app/components/HierarchyStamp";
import { RetailPills } from "@/app/components/RetailPills";
import {
  AlarmClock,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Building2,
  CalendarClock,
  CalendarDays,
  Calculator,
  Camera,
  CheckSquare,
  ClipboardCheck,
  FileCheck2,
  FileText,
  FileWarning,
  GraduationCap,
  ListChecks,
  Mail,
  NotebookPen,
  Package,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  TicketPercent,
  TrendingUp,
  UserCog,
  UserMinus,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  DM_FORM_SLUGS,
  FORM_REGISTRY,
  PEOPLE_FORM_SLUGS,
  type FormSlug,
} from "@/app/pocket-manager5/forms/formRegistry";
import { usePocketHierarchy, type HierarchySummary, type ShopMeta } from "@/hooks/usePocketHierarchy";
import { useMiniPosOverviewSuspense, useSnapshotSuspense } from "@/hooks/usePocketManagerData";
import { EMPTY_SNAPSHOT } from "@/lib/pocketManagerData";
import { formatPercent } from "@/lib/pulseFormatting";
import { pulseSupabase, supabase } from "@/lib/supabaseClient";

type QuickAction = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accent: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Daily Log",
    description: "Closeout workspace",
    href: "/pocket-manager5/features/daily-log",
    icon: FileText,
    accent: "from-emerald-500/30 via-emerald-500/5 to-transparent",
  },
  {
    label: "DM Schedule",
    description: "Visit planning + cadence",
    href: "/pocket-manager5/features/dm-schedule",
    icon: CalendarDays,
    accent: "from-cyan-500/30 via-cyan-500/5 to-transparent",
  },
  {
    label: "Mini POS",
    description: "Checkout shortcuts",
    href: "/pocket-manager5/features/mini-pos",
    icon: Calculator,
    accent: "from-pink-500/30 via-pink-500/5 to-transparent",
  },
  {
    label: "Labor Tracker",
    description: "Allowed vs used hours",
    href: "/pocket-manager5/features/labor-tracker",
    icon: BarChart3,
    accent: "from-violet-500/30 via-violet-500/5 to-transparent",
  },
  {
    label: "Training Tracker",
    description: "CTT + cadence",
    href: "/pocket-manager5/features/training-tracker",
    icon: GraduationCap,
    accent: "from-amber-500/30 via-amber-500/5 to-transparent",
  },
  {
    label: "Pulse Check 5",
    description: "District rollups",
    href: "/pulse-check5",
    icon: TrendingUp,
    accent: "from-sky-500/30 via-sky-500/5 to-transparent",
  },
];

const FORM_TITLE_LOOKUP = FORM_REGISTRY.reduce<Record<FormSlug, string>>((acc, form) => {
  acc[form.slug] = form.title;
  return acc;
}, {} as Record<FormSlug, string>);

const SECTION_ACCENTS: Record<
  string,
  { border: string; eyebrow: string; actionBorder: string; quickLinkBorder: string }
> = {
  emerald: {
    border: "border-emerald-500/30",
    eyebrow: "text-emerald-200",
    actionBorder: "border-emerald-400/60 text-emerald-100",
    quickLinkBorder: "border-emerald-400/40",
  },
  azure: {
    border: "border-cyan-400/30",
    eyebrow: "text-cyan-200",
    actionBorder: "border-cyan-300/60 text-cyan-100",
    quickLinkBorder: "border-cyan-300/40",
  },
  violet: {
    border: "border-violet-400/30",
    eyebrow: "text-violet-200",
    actionBorder: "border-violet-300/60 text-violet-100",
    quickLinkBorder: "border-violet-300/40",
  },
  amber: {
    border: "border-amber-400/30",
    eyebrow: "text-amber-200",
    actionBorder: "border-amber-300/60 text-amber-100",
    quickLinkBorder: "border-amber-300/40",
  },
  pink: {
    border: "border-pink-400/30",
    eyebrow: "text-pink-200",
    actionBorder: "border-pink-300/60 text-pink-100",
    quickLinkBorder: "border-pink-300/40",
  },
  cyan: {
    border: "border-cyan-400/30",
    eyebrow: "text-cyan-200",
    actionBorder: "border-cyan-300/60 text-cyan-100",
    quickLinkBorder: "border-cyan-300/40",
  },
  default: {
    border: "border-slate-800/70",
    eyebrow: "text-slate-400",
    actionBorder: "border-slate-600/80 text-slate-200",
    quickLinkBorder: "border-slate-700/60",
  },
};

const integerFormatter = new Intl.NumberFormat("en-US");

const formatFeatureLabel = (slug: string) =>
  slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const buildFeatureHref = (slug: string) => `/pocket-manager5/features/${slug}`;

type SectionCardProps = {
  title: string;
  eyebrow?: string;
  accent?: string;
  actionHref?: string;
  actionLabel?: string;
  quickLinks?: string[];
  formSlugs?: FormSlug[] | undefined;
  children: ReactNode;
};

function SectionCard({
  title,
  eyebrow,
  accent = "default",
  actionHref,
  actionLabel = "Open workspace",
  quickLinks,
  formSlugs,
  children,
}: SectionCardProps) {
  const accentTheme = SECTION_ACCENTS[accent] ?? SECTION_ACCENTS.default;

  return (
    <section className={`rounded-3xl border ${accentTheme.border} bg-slate-950/80 p-6 shadow-xl shadow-black/20`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {eyebrow && (
            <p className={`text-[10px] uppercase tracking-[0.3em] ${accentTheme.eyebrow}`}>{eyebrow}</p>
          )}
          <h2 className="text-xl font-semibold text-white">{title}</h2>
        </div>
        {actionHref && (
          <Link
            href={actionHref}
            className={`inline-flex items-center gap-1 rounded-full border ${accentTheme.actionBorder} px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] transition hover:bg-white/5`}
          >
            {actionLabel}
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {quickLinks?.length ? (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Feature shortcuts">
          {quickLinks.map((slug) => (
            <Link
              key={slug}
              href={buildFeatureHref(slug)}
              className={`inline-flex items-center gap-1 rounded-full border ${accentTheme.quickLinkBorder} bg-slate-900/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-emerald-400/60`}
            >
              {formatFeatureLabel(slug)}
            </Link>
          ))}
        </div>
      ) : null}

      {formSlugs?.length ? (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Form shortcuts">
          {formSlugs.map((slug) => (
            <Link
              key={slug}
              href={`/pocket-manager5/forms/${slug}`}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-100 transition hover:bg-emerald-500/20"
            >
              {FORM_TITLE_LOOKUP[slug] ?? formatFeatureLabel(slug)}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-5">{children}</div>
    </section>
  );
}

type SectionStatusProps = {
  message: string;
  tone?: "default" | "error";
};

function SectionStatus({ message, tone = "default" }: SectionStatusProps) {
  const toneStyles =
    tone === "error"
      ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
      : "border-slate-700/60 bg-slate-900/40 text-slate-200";
  return <div className={`rounded-2xl border px-4 py-3 text-sm ${toneStyles}`}>{message}</div>;
}

type ShopHrefAppender = (href: string) => string | null;

function useShopHrefAppender(): ShopHrefAppender {
  const [shopStore, setShopStore] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncStore = () => {
      const nextValue = window.localStorage.getItem("shopStore");
      setShopStore(nextValue && nextValue.trim().length ? nextValue.trim() : null);
    };

    syncStore();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "shopStore") {
        syncStore();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return useCallback<ShopHrefAppender>(
    (href) => {
      if (!shopStore || !href) {
        return null;
      }
      if (href.includes("shop=")) {
        return href;
      }
      const hasQuery = href.includes("?");
      const separator = hasQuery ? "&" : "?";
      return `${href}${separator}shop=${encodeURIComponent(shopStore)}`;
    },
    [shopStore],
  );
}

function QuickActionsRail() {
  const appendShopHref = useShopHrefAppender();
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {QUICK_ACTIONS.map((action) => (
        <QuickActionLink key={action.label} {...action} href={appendShopHref(action.href) ?? action.href} />
      ))}
    </div>
  );
}

function QuickActionLink({ icon: Icon, label, description, href, accent }: QuickAction) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-slate-900/70 bg-slate-950/80 p-4 shadow-xl shadow-black/20 transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300"
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent}`} />
      <div className="relative flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900/60 text-emerald-200">
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="text-base font-semibold text-white">{label}</p>
          <p className="text-xs text-slate-400">{description}</p>
        </div>
        <ArrowUpRight className="h-4 w-4 text-slate-600 transition group-hover:text-white" />
      </div>
    </Link>
  );
}

function DailyLogCard() {
  return (
    <SectionCard
      title="Daily Log"
      eyebrow="Closeout workspace"
      accent="emerald"
      actionHref="/pocket-manager5/features/daily-log"
      actionLabel="Open Daily Log"
      quickLinks={["daily-log", "cadence", "labor-tracker"]}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-slate-300">
            Mirror the native Daily Logbook flow with cars, cash, and inventory summaries that sync directly from the mobile
            app.
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.3em] text-emerald-200">Exports • Closeouts • Sign-offs</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100">
          <FileText className="h-4 w-4" />
          Auto summaries ready
        </div>
      </div>
    </SectionCard>
  );
}

type DmToolCard = {
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
  accent: string;
};

const DM_TOOL_CARDS: DmToolCard[] = [
  {
    title: "Monthly Review Presenter",
    subtitle: "Deck + KPI workspace",
    href: "/dm-tools/monthly-biz-review",
    icon: NotebookPen,
    accent: "from-emerald-500/60 via-emerald-500/10 to-slate-950/70",
  },
  {
    title: "DM Schedule",
    subtitle: "District & period planning",
    href: "/pocket-manager5/features/dm-schedule",
    icon: CalendarDays,
    accent: "from-cyan-500/60 via-cyan-500/10 to-slate-950/70",
  },
  {
    title: "DM Cadence",
    subtitle: "Weekly compliance checklist",
    href: "/pocket-manager5/features/cadence",
    icon: CheckSquare,
    accent: "from-violet-500/60 via-violet-500/10 to-slate-950/70",
  },
  {
    title: "DM Shop Visit",
    subtitle: "Inspection + scoring",
    href: "/pocket-manager5/features/dm-logbook",
    icon: Building2,
    accent: "from-pink-500/60 via-pink-500/10 to-slate-950/70",
  },
];

function DmToolsRail() {
  return (
    <SectionCard
      title="DM Tools"
      eyebrow="Schedule • cadence • visits"
      accent="azure"
      actionHref="/pocket-manager5/features/dm-schedule"
      actionLabel="Open DM workspace"
      quickLinks={["dm-schedule", "dm-logbook", "cadence"]}
      formSlugs={DM_FORM_SLUGS}
    >
      <div className="grid gap-3">
        {DM_TOOL_CARDS.map((tool) => (
          <DmToolBanner key={tool.title} {...tool} />
        ))}
      </div>
    </SectionCard>
  );
}

function DmToolBanner({ title, subtitle, href, icon: Icon, accent }: DmToolCard) {
  return (
    <Link
      href={href}
      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/5 bg-slate-950/40 px-4 py-3 transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300"
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${accent}`} />
      <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900/70 text-white">
        <Icon className="h-5 w-5" />
      </div>
      <div className="relative flex-1">
        <p className="text-base font-semibold text-white">{title}</p>
        <p className="text-xs text-slate-300">{subtitle}</p>
      </div>
      <ArrowUpRight className="relative h-4 w-4 text-slate-400 transition group-hover:text-white" />
    </Link>
  );
}

type DistrictTrendKpiKey =
  | "cars"
  | "sales"
  | "aro"
  | "donations"
  | "big4"
  | "coolants"
  | "diffs"
  | "fuelFilters"
  | "mobil1";

type DistrictGridRow = {
  id: string;
  label: string;
  descriptor: string;
  kind: "district" | "shop";
  isCurrentShop?: boolean;
  metrics: Record<DistrictTrendKpiKey, string>;
};

type DistrictTotalsRow = {
  total_cars: number | null;
  total_sales: number | null;
  total_big4: number | null;
  total_coolants: number | null;
  total_diffs: number | null;
  total_fuel_filters: number | null;
  total_donations: number | null;
  total_mobil1: number | null;
  district_name?: string | null;
};

type DistrictShopTotalsRow = {
  shop_id: string;
  total_cars: number | null;
  total_sales: number | null;
  total_big4: number | null;
  total_coolants: number | null;
  total_diffs: number | null;
  total_fuel_filters: number | null;
  total_donations: number | null;
  total_mobil1: number | null;
  district_name?: string | null;
};

type DistrictShopGridSlice = {
  cars: number;
  sales: number;
  aro: number | null;
  big4Pct: number | null;
  coolantsPct: number | null;
  diffsPct: number | null;
  fuelFiltersPct: number | null;
  mobil1Pct: number | null;
  donations: number;
};

const DISTRICT_KPI_HEADERS: Array<{ key: DistrictTrendKpiKey; label: string }> = [
  { key: "cars", label: "Cars" },
  { key: "sales", label: "Sales" },
  { key: "aro", label: "ARO" },
  { key: "big4", label: "Big 4" },
  { key: "coolants", label: "Coolants" },
  { key: "diffs", label: "Diffs" },
  { key: "fuelFilters", label: "FF" },
  { key: "mobil1", label: "Mobil 1" },
  { key: "donations", label: "Donations" },
];

const DISTRICT_GRID_TEMPLATE = `1.8fr repeat(${DISTRICT_KPI_HEADERS.length}, minmax(0, 1fr))`;

const districtCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const districtNumberFormatter = new Intl.NumberFormat("en-US");

const formatDistrictDecimal = (value: number | null) => {
  if (value === null) return "--";
  return value.toFixed(1);
};

const formatDistrictPercent = (value: number | null) => {
  if (value === null || Number.isNaN(value)) {
    return "--";
  }
  return `${value.toFixed(1)}%`;
};

const formatDistrictMetricPair = (primary: string, secondary: string) => `${primary} / ${secondary}`;
const formatDistrictIntegerValue = (value: number) => districtNumberFormatter.format(Math.round(value ?? 0));
const formatDistrictCurrencyValue = (value: number) => districtCurrencyFormatter.format(Math.round(value ?? 0));
const formatDistrictAroValue = (value: number | null) => (value === null ? "--" : `$${formatDistrictDecimal(value)}`);

const buildDistrictGridMetrics = (
  daily: DistrictShopGridSlice,
  weekly: DistrictShopGridSlice,
): Record<DistrictTrendKpiKey, string> => ({
  cars: formatDistrictMetricPair(formatDistrictIntegerValue(daily.cars), formatDistrictIntegerValue(weekly.cars)),
  sales: formatDistrictMetricPair(formatDistrictCurrencyValue(daily.sales), formatDistrictCurrencyValue(weekly.sales)),
  aro: formatDistrictMetricPair(formatDistrictAroValue(daily.aro), formatDistrictAroValue(weekly.aro)),
  big4: formatDistrictMetricPair(formatDistrictPercent(daily.big4Pct), formatDistrictPercent(weekly.big4Pct)),
  coolants: formatDistrictMetricPair(formatDistrictPercent(daily.coolantsPct), formatDistrictPercent(weekly.coolantsPct)),
  diffs: formatDistrictMetricPair(formatDistrictPercent(daily.diffsPct), formatDistrictPercent(weekly.diffsPct)),
  fuelFilters: formatDistrictMetricPair(
    formatDistrictPercent(daily.fuelFiltersPct),
    formatDistrictPercent(weekly.fuelFiltersPct),
  ),
  mobil1: formatDistrictMetricPair(formatDistrictPercent(daily.mobil1Pct), formatDistrictPercent(weekly.mobil1Pct)),
  donations: formatDistrictMetricPair(
    formatDistrictCurrencyValue(daily.donations),
    formatDistrictCurrencyValue(weekly.donations),
  ),
});

const buildDistrictPlaceholderGridMetrics = (): Record<DistrictTrendKpiKey, string> =>
  DISTRICT_KPI_HEADERS.reduce<Record<DistrictTrendKpiKey, string>>((acc, header) => {
    acc[header.key] = formatDistrictMetricPair("--", "--");
    return acc;
  }, {} as Record<DistrictTrendKpiKey, string>);

const buildDistrictPlaceholderShopRows = (
  count: number,
  options?: { descriptor?: string; highlightCurrent?: boolean },
) => {
  if (!count || count <= 0) {
    return [] as DistrictGridRow[];
  }
  const descriptor = options?.descriptor ?? "Awaiting mapping";
  return Array.from({ length: count }).map((_, index) => ({
    id: `placeholder-shop-${index + 1}`,
    label: `Shop slot ${index + 1}`,
    descriptor,
    kind: "shop" as DistrictGridRow["kind"],
    isCurrentShop: options?.highlightCurrent && index === 0,
    metrics: buildDistrictPlaceholderGridMetrics(),
  }));
};

const resolveDistrictPlaceholderCount = (candidate?: number | null) => {
  if (typeof candidate === "number" && candidate > 0) {
    return candidate;
  }
  return 4;
};

const buildDistrictShopSliceFromTotals = (row: DistrictShopTotalsRow | null | undefined): DistrictShopGridSlice => {
  const cars = row?.total_cars ?? 0;
  const sales = row?.total_sales ?? 0;
  const big4 = row?.total_big4 ?? 0;
  const coolants = row?.total_coolants ?? 0;
  const diffs = row?.total_diffs ?? 0;
  const fuelFilters = row?.total_fuel_filters ?? 0;
  const mobil1 = row?.total_mobil1 ?? 0;
  const donations = row?.total_donations ?? 0;
  const percent = (value: number) => (cars > 0 ? (value / cars) * 100 : null);

  return {
    cars,
    sales,
    aro: cars > 0 ? sales / cars : null,
    big4Pct: percent(big4),
    coolantsPct: percent(coolants),
    diffsPct: percent(diffs),
    fuelFiltersPct: percent(fuelFilters),
    mobil1Pct: percent(mobil1),
    donations,
  } satisfies DistrictShopGridSlice;
};

const convertDistrictTotalsRowToShopRow = (
  row: DistrictTotalsRow | null,
  id: string,
): DistrictShopTotalsRow | null => {
  if (!row) {
    return null;
  }
  return {
    shop_id: id,
    total_cars: row.total_cars ?? 0,
    total_sales: row.total_sales ?? 0,
    total_big4: row.total_big4 ?? 0,
    total_coolants: row.total_coolants ?? 0,
    total_diffs: row.total_diffs ?? 0,
    total_fuel_filters: row.total_fuel_filters ?? 0,
    total_donations: row.total_donations ?? 0,
    total_mobil1: row.total_mobil1 ?? 0,
    district_name: row.district_name ?? null,
  } satisfies DistrictShopTotalsRow;
};

const districtTodayISO = () => new Date().toISOString().split("T")[0];

const districtWeekStartISO = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day;
  const first = new Date(now.setDate(diff));
  return first.toISOString().split("T")[0];
};

type DistrictScopeKpiSectionProps = {
  shopMeta: ShopMeta | null;
  hierarchy: HierarchySummary | null;
};

function DistrictScopeKpiSection({ shopMeta, hierarchy }: DistrictScopeKpiSectionProps) {
  const [districtRows, setDistrictRows] = useState<DistrictGridRow[]>([]);
  const [districtLoading, setDistrictLoading] = useState(false);
  const [districtError, setDistrictError] = useState<string | null>(null);
  const districtGridVisible = Boolean(shopMeta?.district_id || hierarchy?.district_name);

  useEffect(() => {
    if (!districtGridVisible) {
      setDistrictRows([]);
      setDistrictError(null);
      setDistrictLoading(false);
      return;
    }

    if (!shopMeta?.district_id) {
      const placeholderRows = buildDistrictPlaceholderShopRows(resolveDistrictPlaceholderCount(), {
        descriptor: "Hierarchy slot",
        highlightCurrent: Boolean(shopMeta?.id),
      });
      const placeholderDistrictRow: DistrictGridRow = {
        id: "district-unlinked",
        label: hierarchy?.district_name ?? "District overview",
        descriptor: "Link a district to view KPIs.",
        kind: "district",
        metrics: buildDistrictPlaceholderGridMetrics(),
      };
      setDistrictRows([...placeholderRows, placeholderDistrictRow]);
      setDistrictError("Link a district to view scope KPIs.");
      setDistrictLoading(false);
      return;
    }

    let cancelled = false;
    const loadDistrictScope = async () => {
      setDistrictLoading(true);
      setDistrictError(null);
      try {
        const { data: shopList, error: shopError } = await pulseSupabase
          .from("shops")
          .select("id,shop_name,shop_number")
          .eq("district_id", shopMeta.district_id)
          .order("shop_number", { ascending: true });

        if (shopError) {
          throw shopError;
        }

        let shopsInDistrict = (shopList ?? []) as Array<{
          id: string;
          shop_name: string | null;
          shop_number: number | null;
        }>;

        if (!shopsInDistrict.length && hierarchy?.district_name) {
          try {
            const { data: alignmentRows, error: alignmentError } = await supabase
              .from("shop_alignment")
              .select("store,shop_name")
              .eq("district", hierarchy.district_name)
              .order("store", { ascending: true });

            if (!alignmentError && alignmentRows?.length) {
              shopsInDistrict = alignmentRows.map(
                (row: { store?: number | string | null; shop_name?: string | null }, index: number) => {
                  const storeNumberRaw = typeof row.store === "number" ? row.store : Number(row.store);
                  const storeNumber = Number.isFinite(storeNumberRaw) ? (storeNumberRaw as number) : null;
                  return {
                    id: `alignment-${storeNumber ?? index + 1}`,
                    shop_name: row.shop_name ?? null,
                    shop_number: storeNumber,
                  };
                },
              );
            }
          } catch (alignmentErr) {
            console.error("DistrictScopeKpiSection alignment lookup failed", alignmentErr);
          }
        }

        const shopIds = shopsInDistrict.map((shop) => shop.id);

        let dailyRows: DistrictShopTotalsRow[] = [];
        let weeklyRows: DistrictShopTotalsRow[] = [];

        if (shopIds.length) {
          const [dailyResponse, weeklyResponse] = await Promise.all([
            pulseSupabase
              .from("shop_daily_totals")
              .select(
                "shop_id,total_cars,total_sales,total_big4,total_coolants,total_diffs,total_fuel_filters,total_donations,total_mobil1",
              )
              .eq("check_in_date", districtTodayISO())
              .in("shop_id", shopIds),
            pulseSupabase
              .from("shop_wtd_totals")
              .select(
                "shop_id,total_cars,total_sales,total_big4,total_coolants,total_diffs,total_fuel_filters,total_donations,total_mobil1",
              )
              .eq("week_start", districtWeekStartISO())
              .in("shop_id", shopIds),
          ]);

          if (dailyResponse.error && dailyResponse.error.code !== "PGRST116") {
            throw dailyResponse.error;
          }
          if (weeklyResponse.error && weeklyResponse.error.code !== "PGRST116") {
            throw weeklyResponse.error;
          }

          dailyRows = (dailyResponse.data ?? []) as DistrictShopTotalsRow[];
          weeklyRows = (weeklyResponse.data ?? []) as DistrictShopTotalsRow[];
        }

        const [districtDailyResponse, districtWeeklyResponse] = await Promise.all([
          pulseSupabase
            .from("district_daily_totals")
            .select(
              "total_cars,total_sales,total_big4,total_coolants,total_diffs,total_fuel_filters,total_donations,total_mobil1,district_name",
            )
            .eq("district_id", shopMeta.district_id)
            .eq("check_in_date", districtTodayISO())
            .maybeSingle(),
          pulseSupabase
            .from("district_wtd_totals")
            .select(
              "total_cars,total_sales,total_big4,total_coolants,total_diffs,total_fuel_filters,total_donations,total_mobil1,district_name",
            )
            .eq("district_id", shopMeta.district_id)
            .eq("week_start", districtWeekStartISO())
            .order("current_date", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (districtDailyResponse.error && districtDailyResponse.error.code !== "PGRST116") {
          throw districtDailyResponse.error;
        }
        if (districtWeeklyResponse.error && districtWeeklyResponse.error.code !== "PGRST116") {
          throw districtWeeklyResponse.error;
        }

        const dailyMap = new Map(dailyRows.map((row) => [row.shop_id, row] as const));
        const weeklyMap = new Map(weeklyRows.map((row) => [row.shop_id, row] as const));

        const nextRows: DistrictGridRow[] = [];

        shopsInDistrict.forEach((shop) => {
          const label = shop.shop_name ?? `Shop #${shop.shop_number ?? "?"}`;
          const descriptor = shop.shop_number ? `Shop #${shop.shop_number}` : shop.shop_name ?? "Live shop";
          const dailyTotals = dailyMap.get(shop.id) ?? null;
          const weeklyTotals = weeklyMap.get(shop.id) ?? null;
          const hasShopTotals = Boolean(dailyTotals || weeklyTotals);
          const isCurrentShop =
            shop.id === shopMeta.id ||
            (typeof shop.shop_number === "number" && typeof shopMeta?.shop_number === "number"
              ? shop.shop_number === shopMeta.shop_number
              : false);
          nextRows.push({
            id: shop.id,
            label,
            descriptor,
            kind: "shop",
            isCurrentShop,
            metrics: hasShopTotals
              ? buildDistrictGridMetrics(
                  buildDistrictShopSliceFromTotals(dailyTotals),
                  buildDistrictShopSliceFromTotals(weeklyTotals),
                )
              : buildDistrictPlaceholderGridMetrics(),
          });
        });

        if (!shopsInDistrict.length) {
          const placeholders = buildDistrictPlaceholderShopRows(resolveDistrictPlaceholderCount(), {
            descriptor: "Hierarchy listing",
            highlightCurrent: Boolean(shopMeta?.id),
          });
          nextRows.push(...placeholders);
        }

        const districtDaily = convertDistrictTotalsRowToShopRow(
          (districtDailyResponse.data as DistrictTotalsRow | null) ?? null,
          `district-${shopMeta.district_id}`,
        );
        const districtWeekly = convertDistrictTotalsRowToShopRow(
          (districtWeeklyResponse.data as DistrictTotalsRow | null) ?? null,
          `district-${shopMeta.district_id}`,
        );
        const hasDistrictTotals = Boolean(districtDaily || districtWeekly);
        const fallbackDescriptor = shopsInDistrict.length
          ? "Awaiting KPI submissions"
          : "No shops resolved for this district yet.";

        const districtRow: DistrictGridRow = {
          id: `district-${shopMeta.district_id}`,
          label:
            hierarchy?.district_name ??
            (districtDailyResponse.data as DistrictTotalsRow | null)?.district_name ??
            (districtWeeklyResponse.data as DistrictTotalsRow | null)?.district_name ??
            "District rollup",
          descriptor: hasDistrictTotals ? "District total" : fallbackDescriptor,
          kind: "district",
          metrics: hasDistrictTotals
            ? buildDistrictGridMetrics(
                buildDistrictShopSliceFromTotals(districtDaily ?? null),
                buildDistrictShopSliceFromTotals(districtWeekly ?? null),
              )
            : buildDistrictPlaceholderGridMetrics(),
        };

        nextRows.push(districtRow);

        if (!cancelled) {
          setDistrictRows(nextRows);
          setDistrictError(null);
        }
      } catch (err) {
        console.error("DistrictScopeKpiSection load error", err);
        if (!cancelled) {
          const placeholderDistrictRow: DistrictGridRow = {
            id: `district-placeholder-${shopMeta.district_id ?? "unknown"}`,
            label: hierarchy?.district_name ?? "District overview",
            descriptor: "Unable to load district shops right now.",
            kind: "district",
            metrics: buildDistrictPlaceholderGridMetrics(),
          };
          const placeholderRows = buildDistrictPlaceholderShopRows(resolveDistrictPlaceholderCount(), {
            descriptor: "Hierarchy slot",
            highlightCurrent: Boolean(shopMeta?.id),
          });
          setDistrictRows([...placeholderRows, placeholderDistrictRow]);
          setDistrictError("Unable to load district shops right now.");
        }
      } finally {
        if (!cancelled) {
          setDistrictLoading(false);
        }
      }
    };

    loadDistrictScope();

    return () => {
      cancelled = true;
    };
  }, [districtGridVisible, shopMeta?.district_id, shopMeta?.id, shopMeta?.shop_number, hierarchy?.district_name]);

  const districtName = hierarchy?.district_name ?? "District overview";
  const districtShopCount = districtRows.filter((row) => row.kind === "shop").length;
  const headerStatus = districtLoading && !districtRows.length
    ? "Syncing shops"
    : `${districtShopCount} shop${districtShopCount === 1 ? "" : "s"}`;

  if (!districtGridVisible) {
    return (
      <SectionCard
        title="District Scope KPIs"
        eyebrow="District coverage"
        accent="emerald"
        actionHref="/pulse-check5"
        actionLabel="Open Pulse Check"
      >
        <SectionStatus tone="error" message="Link a district to view scope KPIs." />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="District Scope KPIs"
      eyebrow="District coverage"
      accent="emerald"
      actionHref="/pulse-check5"
      actionLabel="Open Pulse Check"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300">District scope KPIs</p>
            <h3 className="text-lg font-semibold text-white">{districtName}</h3>
          </div>
          <p className="text-[10px] text-slate-400">{headerStatus}</p>
        </div>
        {districtError && <p className="text-sm text-amber-200">{districtError}</p>}
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-slate-950/40 shadow-[0_20px_50px_rgba(1,6,20,0.6)]">
          {districtLoading && !districtRows.length ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">Loading district shops…</div>
          ) : districtRows.length ? (
            <div className="overflow-x-auto">
              <div className="min-w-[1040px]">
                <div
                  className="grid bg-slate-900/60 text-[10px] uppercase tracking-[0.3em] text-slate-300"
                  style={{ gridTemplateColumns: DISTRICT_GRID_TEMPLATE }}
                >
                  <div className="px-3 py-2 text-left">Shop</div>
                  {DISTRICT_KPI_HEADERS.map((header) => (
                    <div key={`district-header-${header.key}`} className="px-3 py-2 text-center">
                      {header.label}
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-white/5">
                  {districtRows.map((row, index) => {
                    const zebra = index % 2 ? "bg-slate-950/30" : "bg-slate-950/60";
                    const highlightClass =
                      row.kind === "district"
                        ? "bg-emerald-500/10"
                        : row.isCurrentShop
                        ? "bg-sky-500/10"
                        : zebra;
                    return (
                      <div
                        key={row.id}
                        className={`grid px-3 py-2 text-sm transition ${highlightClass}`}
                        style={{ gridTemplateColumns: DISTRICT_GRID_TEMPLATE }}
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">{row.label}</p>
                          <p className="text-[11px] text-slate-400">{row.descriptor}</p>
                        </div>
                        {DISTRICT_KPI_HEADERS.map((header) => (
                          <div
                            key={`${row.id}-${header.key}`}
                            className="px-3 py-2 text-center text-[11px] font-semibold text-slate-100"
                          >
                            {row.metrics[header.key]}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="px-4 py-6 text-center text-sm text-slate-400">No shops resolved for this district yet.</div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

type WorkspaceTileMeta = {
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
  accent: string;
};

const PEOPLE_TILE_CONFIG: WorkspaceTileMeta[] = [
  {
    title: "Scheduling",
    subtitle: "Weekly rosters & overtime",
    href: "/pocket-manager5/features/employee-scheduling",
    icon: CalendarClock,
    accent: "from-violet-500/30 via-slate-950/10 to-slate-950/80",
  },
  {
    title: "Training",
    subtitle: "CTT & development",
    href: "/pocket-manager5/features/employee-training",
    icon: GraduationCap,
    accent: "from-amber-500/30 via-slate-950/10 to-slate-950/80",
  },
  {
    title: "Meetings",
    subtitle: "Agendas & attendance",
    href: "/pocket-manager5/features/employee-meetings",
    icon: NotebookPen,
    accent: "from-pink-500/30 via-slate-950/10 to-slate-950/80",
  },
  {
    title: "Coaching Log",
    subtitle: "Feedback + commitments",
    href: "/pocket-manager5/features/coaching-log",
    icon: ClipboardCheck,
    accent: "from-cyan-500/30 via-slate-950/10 to-slate-950/80",
  },
  {
    title: "Staff Mgmt",
    subtitle: "Pipeline & contacts",
    href: "/pocket-manager5/features/staff-management",
    icon: UserCog,
    accent: "from-emerald-500/30 via-slate-950/10 to-slate-950/80",
  },
  {
    title: "Termed List",
    subtitle: "Compliance archive",
    href: "/pocket-manager5/features/termed-list",
    icon: UserMinus,
    accent: "from-red-500/30 via-slate-950/10 to-slate-950/80",
  },
];

const OPS_TILE_CONFIG: WorkspaceTileMeta[] = [
  {
    title: "Cadence",
    subtitle: "Daily + weekly templates",
    href: "/pocket-manager5/features/cadence",
    icon: ListChecks,
    accent: "from-violet-500/25 via-slate-950/10 to-slate-950/80",
  },
  {
    title: "Inventory",
    subtitle: "Counters & oils",
    href: "/pocket-manager5/features/inventory",
    icon: Boxes,
    accent: "from-emerald-500/25 via-slate-950/10 to-slate-950/80",
  },
  {
    title: "Shop Checkbook",
    subtitle: "Expense ledger",
    href: "/pocket-manager5/features/checkbook",
    icon: Wallet,
    accent: "from-red-500/25 via-slate-950/10 to-slate-950/80",
  },
  {
    title: "Shop Workbook",
    subtitle: "Vendor spend",
    href: "/pocket-manager5/features/workbook",
    icon: NotebookPen,
    accent: "from-amber-500/25 via-slate-950/10 to-slate-950/80",
  },
  {
    title: "Crash Kit",
    subtitle: "Invoices & work orders",
    href: "/pocket-manager5/features/crash-kit",
    icon: ShieldCheck,
    accent: "from-sky-500/25 via-slate-950/10 to-slate-950/80",
  },
  {
    title: "SoLinks",
    subtitle: "Audit workflows",
    href: "/pocket-manager5/features/solinks",
    icon: Camera,
    accent: "from-purple-500/25 via-slate-950/10 to-slate-950/80",
  },
  {
    title: "Claims",
    subtitle: "Customer & employee",
    href: "/pocket-manager5/features/claims",
    icon: FileWarning,
    accent: "from-rose-500/25 via-slate-950/10 to-slate-950/80",
  },
];

const MANAGER_CORE_TILES: WorkspaceTileMeta[] = [
  {
    title: "KPI Board",
    subtitle: "Performance stack",
    href: "/pocket-manager5/features/kpi-board",
    icon: BarChart3,
    accent: "from-indigo-500/30 via-slate-950/10 to-slate-950/80",
  },
  {
    title: "Cadence",
    subtitle: "DM compliance",
    href: "/pocket-manager5/features/cadence",
    icon: ListChecks,
    accent: "from-violet-500/30 via-slate-950/10 to-slate-950/80",
  },
  {
    title: "Supply Ordering",
    subtitle: "PAR based orders",
    href: "/pocket-manager5/features/supply",
    icon: Package,
    accent: "from-emerald-500/30 via-slate-950/10 to-slate-950/80",
  },
];

const MANAGER_EXTRA_TILES: WorkspaceTileMeta[] = [
  {
    title: "Wage Calculator",
    subtitle: "Labor guardrails",
    href: "/pocket-manager5/features/wage-calculator",
    icon: Calculator,
    accent: "from-indigo-500/20 via-slate-950/10 to-slate-950/80",
  },
  {
    title: "SPIFF Gain/Loss",
    subtitle: "Track incentives",
    href: "/pocket-manager5/features/spiff-gain-loss",
    icon: TrendingUp,
    accent: "from-red-500/20 via-slate-950/10 to-slate-950/80",
  },
  {
    title: "Inventory Lookup",
    subtitle: "Quick search",
    href: "/pocket-manager5/features/inventory-lookup",
    icon: Search,
    accent: "from-emerald-500/20 via-slate-950/10 to-slate-950/80",
  },
  {
    title: "Break Timer",
    subtitle: "Compliance clock",
    href: "/pocket-manager5/features/break-timer",
    icon: AlarmClock,
    accent: "from-amber-500/20 via-slate-950/10 to-slate-950/80",
  },
  {
    title: "Contact List",
    subtitle: "Vendors & partners",
    href: "/pocket-manager5/features/contact-list",
    icon: Phone,
    accent: "from-rose-500/20 via-slate-950/10 to-slate-950/80",
  },
  {
    title: "Compliance Poster",
    subtitle: "Latest docs",
    href: "/pocket-manager5/features/compliance-poster",
    icon: FileCheck2,
    accent: "from-green-500/20 via-slate-950/10 to-slate-950/80",
  },
  {
    title: "Digital Coupons",
    subtitle: "Promo library",
    href: "/pocket-manager5/features/digital-coupons",
    icon: TicketPercent,
    accent: "from-orange-500/20 via-slate-950/10 to-slate-950/80",
  },
  {
    title: "Crew Messages",
    subtitle: "Share recap",
    href: "/pocket-manager5/features/chatbot",
    icon: Mail,
    accent: "from-cyan-500/20 via-slate-950/10 to-slate-950/80",
  },
];

function WorkspaceTile({ title, subtitle, href, icon: Icon, accent }: WorkspaceTileMeta) {
  return (
    <Link
      href={href}
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/5 bg-slate-950/70 p-4 transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300"
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent}`} />
      <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-black/30 text-white">
        <Icon className="h-5 w-5" />
      </div>
      <div className="relative flex-1">
        <p className="text-base font-semibold text-white">{title}</p>
        <p className="text-xs text-slate-200">{subtitle}</p>
      </div>
      <ArrowUpRight className="relative h-4 w-4 text-slate-400 transition group-hover:text-white" />
    </Link>
  );
}

function PeopleWorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <SectionCard
      title="People Workspace"
      eyebrow="Employee management"
      accent="violet"
      quickLinks={["employee-management", "training-tracker", "cadence"]}
      actionHref="/pocket-manager5/features/employee-management"
      actionLabel="Open people hub"
      formSlugs={PEOPLE_FORM_SLUGS}
    >
      {children}
    </SectionCard>
  );
}

function ProfileSnapshotPanel({ snapshot }: { snapshot: PocketManagerSnapshot }) {
  const headcount = snapshot.staffing.currentCount ?? null;
  const staffedPct = snapshot.staffing.staffedToParPct ?? null;
  const trainingPct = snapshot.training.completionPct ?? null;
  const inTraining = snapshot.training.inTrainingCount ?? null;
  const cadenceDaily = snapshot.cadence.dailyPct ?? null;
  const cadenceWeekly = snapshot.cadence.weeklyPct ?? null;
  const challengesToday = snapshot.cadence.challengesToday ?? null;
  const challengesWeek = snapshot.cadence.challengesWeek ?? null;
  const devActive = snapshot.development.activePlans;
  const devCompleted = snapshot.development.completedPlans;
  const devOnHold = snapshot.development.onHoldPlans;
  const devAvgDays = snapshot.development.avgActiveDays;
  const updatedLabel = snapshot.updatedAt
    ? new Date(snapshot.updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;

  const metricTiles = [
    {
      label: "Headcount",
      value: headcount == null ? "--" : integerFormatter.format(headcount),
      caption: staffedPct == null ? "Staffed to par" : `${Math.round(staffedPct)}% to par`,
    },
    {
      label: "Training completion",
      value: trainingPct == null ? "--" : `${Math.round(trainingPct)}%`,
      caption: inTraining == null ? "Preview pending" : `${inTraining} in training`,
    },
    {
      label: "Cadence compliance",
      value:
        cadenceDaily == null || cadenceWeekly == null
          ? "--"
          : `${Math.round(cadenceDaily)}% / ${Math.round(cadenceWeekly)}%`,
      caption: "Daily / WTD",
    },
    {
      label: "Challenges logged",
      value:
        challengesToday == null || challengesWeek == null
          ? "--"
          : `${integerFormatter.format(challengesToday)} / ${integerFormatter.format(challengesWeek)}`,
      caption: "Today / WTD",
    },
    {
      label: "Development plans",
      value: integerFormatter.format(devActive ?? 0),
      caption: `${integerFormatter.format(devCompleted ?? 0)} complete • ${integerFormatter.format(devOnHold ?? 0)} on hold`,
    },
  ];

  const trainingPercentValue = trainingPct ?? 0;
  const trainingPercentDisplay = trainingPct == null ? "--" : `${Math.round(trainingPct)}%`;
  const inTrainingText = inTraining == null ? "Preview data pending" : `${inTraining} teammates in training`;
  const cadenceDailyDisplay = cadenceDaily == null ? "--" : Math.round(cadenceDaily).toString();
  const cadenceWeeklyDisplay = cadenceWeekly == null ? "--" : Math.round(cadenceWeekly).toString();
  const devAvgDaysDisplay = Number.isFinite(devAvgDays) ? Math.round(devAvgDays) : null;

  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#030d1f]/95 via-[#040b1b]/96 to-[#01040c]/98 p-5 shadow-[0_30px_80px_rgba(5,15,35,0.65)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">People &amp; training</p>
          <h3 className="text-xl font-semibold text-white">Profile snapshot</h3>
        </div>
        {updatedLabel && <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Updated {updatedLabel}</p>}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {metricTiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-white/10 bg-[#050f23]/85 p-3 shadow-[0_16px_36px_rgba(1,6,20,0.55)]">
            <p className="text-[9px] uppercase tracking-[0.35em] text-slate-500">{tile.label}</p>
            <p className="mt-1 text-lg font-semibold text-white">{tile.value}</p>
            <p className="text-[11px] text-slate-400">{tile.caption}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-[#07142d]/80 p-4 shadow-[0_18px_42px_rgba(1,6,20,0.6)]">
          <p className="text-sm font-semibold text-white">Training throughput</p>
          <p className="mt-1 text-3xl font-bold text-emerald-200">{trainingPercentDisplay}</p>
          <p className="text-xs text-slate-400">{inTrainingText}</p>
          <div className="mt-3 h-1.5 rounded-full bg-slate-900">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: `${Math.max(0, Math.min(100, trainingPercentValue))}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Development pipeline: {integerFormatter.format(devActive ?? 0)} active •
            {" "}
            {integerFormatter.format(devCompleted ?? 0)} complete • {integerFormatter.format(devOnHold ?? 0)} on hold
            {devAvgDaysDisplay != null ? ` • avg ${devAvgDaysDisplay} days open` : ""}
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-[#041831]/85 p-4 shadow-[0_18px_42px_rgba(1,6,20,0.6)]">
          <p className="text-sm font-semibold text-white">Cadence streak</p>
          <p className="mt-1 text-3xl font-bold text-cyan-200">
            {cadenceDailyDisplay} / {cadenceWeeklyDisplay}%
          </p>
          <p className="text-xs text-slate-400">Daily / WTD compliance</p>
          <div className="mt-3 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[9px] uppercase tracking-[0.35em] text-slate-400">Challenges</p>
              <p className="text-base font-semibold text-white">
                {challengesToday == null ? "--" : integerFormatter.format(challengesToday)} today
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[9px] uppercase tracking-[0.35em] text-slate-400">Week total</p>
              <p className="text-base font-semibold text-white">
                {challengesWeek == null ? "--" : integerFormatter.format(challengesWeek)} WTD
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PeopleWorkspaceContent({ shopNumber }: { shopNumber: number | string }) {
  const snapshot = useSnapshotSuspense(shopNumber) ?? EMPTY_SNAPSHOT;
  return (
    <>
      <ProfileSnapshotPanel snapshot={snapshot} />
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <MetricStat
          label="Current staff"
          value={integerFormatter.format(snapshot.staffing.currentCount)}
          sublabel={`${formatPercent(snapshot.staffing.staffedToParPct)} to par`}
        />
        <MetricStat
          label="Avg tenure"
          value={`${snapshot.staffing.avgTenureMonths} mo`}
          sublabel={`${snapshot.staffing.termsYTD} terms YTD`}
        />
        <MetricStat
          label="Training completion"
          value={formatPercent(snapshot.training.completionPct)}
          sublabel={`${snapshot.training.inTrainingCount} teammates in training`}
        />
        <MetricStat
          label="Development plans"
          value={integerFormatter.format(snapshot.development.activePlans)}
          sublabel={`${snapshot.development.completedPlans} done • ${snapshot.development.onHoldPlans} hold`}
        />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {PEOPLE_TILE_CONFIG.map((tile) => (
          <WorkspaceTile key={tile.title} {...tile} />
        ))}
      </div>
    </>
  );
}

function PeopleWorkspaceSection({ shopNumber }: { shopNumber: number | string | null | undefined }) {
  if (!shopNumber) {
    return (
      <PeopleWorkspaceShell>
        <SectionStatus tone="error" message="Link a shop to unlock employee management data." />
      </PeopleWorkspaceShell>
    );
  }

  return (
    <SectionErrorBoundary
      fallback={
        <PeopleWorkspaceShell>
          <SectionStatus tone="error" message="People workspace unavailable." />
        </PeopleWorkspaceShell>
      }
    >
      <Suspense
        fallback={
          <PeopleWorkspaceShell>
            <SectionStatus message="Loading employee systems…" />
          </PeopleWorkspaceShell>
        }
      >
        <PeopleWorkspaceShell>
          <PeopleWorkspaceContent shopNumber={shopNumber} />
        </PeopleWorkspaceShell>
      </Suspense>
    </SectionErrorBoundary>
  );
}

function OpsHubSection({ shopId }: { shopId: string | null | undefined }) {
  return (
    <SectionCard
      title="OPS Hub"
      eyebrow="Operations grid"
      accent="emerald"
      actionHref="/pocket-manager5/features/ops"
      quickLinks={["ops", "inventory", "workbook", "checkbook", "crash-kit", "solinks", "claims", "alerts", "mini-pos"]}
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {OPS_TILE_CONFIG.map((tile) => (
            <WorkspaceTile key={tile.title} {...tile} />
          ))}
        </div>
        <MiniPosSection shopId={shopId} variant="inline" />
      </div>
    </SectionCard>
  );
}

function ManagersClipboardSection() {
  return (
    <SectionCard
      title="Manager's Clipboard"
      eyebrow="Quick access tiles"
      accent="amber"
      actionHref="/pocket-manager5/features/managers-clipboard"
      quickLinks={["cadence", "supply", "kpi-board", "wage-calculator", "chatbot"]}
    >
      <p className="text-xs uppercase tracking-[0.3em] text-amber-200">Main tools</p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {MANAGER_CORE_TILES.map((tile) => (
          <WorkspaceTile key={tile.title} {...tile} />
        ))}
      </div>
      <p className="mt-6 text-xs uppercase tracking-[0.3em] text-amber-200">Additional tools</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MANAGER_EXTRA_TILES.map((tile) => (
          <WorkspaceTile key={tile.title} {...tile} />
        ))}
      </div>
    </SectionCard>
  );
}

function MiniPosShell({ children, variant = "card" }: { children: ReactNode; variant?: "card" | "inline" }) {
  const appendShopHref = useShopHrefAppender();
  const miniPosHref = appendShopHref("/pocket-manager5/features/mini-pos") ?? "/pocket-manager5/features/mini-pos";
  if (variant === "inline") {
    return (
      <div className="rounded-3xl border border-cyan-400/30 bg-slate-950/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-200">Mini POS</p>
            <p className="text-sm text-slate-300">Work order shortcuts</p>
          </div>
          <Link
            href={miniPosHref}
            className="inline-flex items-center gap-1 rounded-full border border-cyan-400/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-100 transition hover:border-cyan-300"
          >
            Open Mini POS ↗
          </Link>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    );
  }

  return (
    <SectionCard
      title="Mini POS"
      eyebrow="Work order shortcuts"
      accent="cyan"
      actionHref="/pocket-manager5/features/mini-pos"
      actionLabel="Open Mini POS"
      quickLinks={["mini-pos", "chatbot", "ops"]}
    >
      {children}
    </SectionCard>
  );
}

function MiniPosContent({ shopId }: { shopId: string }) {
  const overview = useMiniPosOverviewSuspense(shopId);
  if (!overview || overview.buttonCount === 0) {
    return <SectionStatus message="No POS buttons yet — seed them from the mobile app to start selling." />;
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <MetricStat label="Main buttons" value={integerFormatter.format(overview.buttonCount)} sublabel="Active tiles" />
        <MetricStat label="Nested options" value={integerFormatter.format(overview.nestedCount)} sublabel="Service variants" />
        <MetricStat label="Team on file" value={integerFormatter.format(overview.employeeCount)} sublabel="Staff in phone sheet" />
      </div>
      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-200">Featured buttons</p>
        {overview.sampleButtons.length === 0 ? (
          <SectionStatus message="Buttons will appear here once you seed Mini POS from the app." />
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {overview.sampleButtons.map((button) => (
              <span
                key={button.id}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100"
              >
                {button.label}
                <span className="text-[10px] font-medium text-cyan-200/80">{button.nestedCount} options</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function MiniPosSection({ shopId, variant = "card" }: { shopId: string | null | undefined; variant?: "card" | "inline" }) {
  const renderShell = (content: ReactNode) => <MiniPosShell variant={variant}>{content}</MiniPosShell>;

  if (!shopId) {
    return renderShell(<SectionStatus tone="error" message="Link a shop to surface POS buttons and services." />);
  }

  return (
    <SectionErrorBoundary
      fallback={renderShell(<SectionStatus tone="error" message="Mini POS overview unavailable." />)}
    >
      <Suspense
        fallback={renderShell(<SectionStatus message="Pulling Mini POS config…" />)}
      >
        {renderShell(<MiniPosContent shopId={shopId} />)}
      </Suspense>
    </SectionErrorBoundary>
  );
}

class SectionErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  constructor(props: { fallback: ReactNode; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown) {
    console.error("Pocket Manager async section error", error);
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

type MetricStatProps = {
  label: string;
  value: string;
  sublabel?: string;
};

function MetricStat({ label, value, sublabel }: MetricStatProps) {
  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
      <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {sublabel && <p className="text-xs text-slate-400">{sublabel}</p>}
    </div>
  );
}

type ProgressStatProps = {
  label: string;
  value: number;
  goal?: number;
  suffix?: string;
};

function ProgressStat({ label, value, goal = 100, suffix = "%" }: ProgressStatProps) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  const display = suffix === "%" ? `${Math.round(value)}${suffix}` : `${value}${suffix}`;

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <p className="uppercase tracking-[0.2em]">{label}</p>
        <span>{display}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-800">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}


function LaborStaffingSection({ shopNumber }: { shopNumber: number | string | null | undefined }) {
  const snapshot = useSnapshotSuspense(shopNumber) ?? EMPTY_SNAPSHOT;
  return (
    <SectionCard
      title="Labor & Staffing"
      eyebrow="Hours vs plan"
      accent="violet"
      actionHref="/pocket-manager5/features/labor-tracker"
      actionLabel="Open labor tracker"
      quickLinks={["labor-tracker", "employee-management", "ops"]}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <MetricStat
            label="Allowed vs used today"
            value={`${snapshot.labor.allowedToday.toFixed(1)}h / ${snapshot.labor.usedToday.toFixed(1)}h`}
            sublabel={`Variance ${snapshot.labor.varianceToday.toFixed(1)}h`}
          />
          <MetricStat
            label="Weekly hours"
            value={`${snapshot.labor.weeklyUsed.toFixed(1)}h`}
            sublabel={`Allowed ${snapshot.labor.weeklyAllowed.toFixed(1)}h`}
          />
          <MetricStat label="Turned cars today" value={integerFormatter.format(snapshot.labor.turnedCars)} />
        </div>
        <div className="space-y-4">
          <ProgressStat label="Staffed to par" value={snapshot.staffing.staffedToParPct} />
          <ProgressStat label="Avg tenure" value={snapshot.staffing.avgTenureMonths} goal={60} suffix=" mo" />
          <MetricStat
            label="Current staff"
            value={integerFormatter.format(snapshot.staffing.currentCount)}
            sublabel={`${integerFormatter.format(snapshot.staffing.termsYTD)} terms YTD`}
          />
        </div>
      </div>
    </SectionCard>
  );
}

function TrainingCadenceSection({ shopNumber }: { shopNumber: number | string | null | undefined }) {
  const snapshot = useSnapshotSuspense(shopNumber) ?? EMPTY_SNAPSHOT;
  const devActive = snapshot.development.activePlans;
  const devCompleted = snapshot.development.completedPlans;
  const devOnHold = snapshot.development.onHoldPlans;
  const devAvgDays = Number.isFinite(snapshot.development.avgActiveDays)
    ? Math.round(snapshot.development.avgActiveDays)
    : null;
  return (
    <SectionCard
      title="Training & Cadence"
      eyebrow="People systems"
      accent="pink"
      actionHref="/pocket-manager5/features/training-tracker"
      actionLabel="Open training tracker"
      quickLinks={["training-tracker", "cadence", "challenges"]}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <MetricStat
          label="Training completion"
          value={formatPercent(snapshot.training.completionPct)}
          sublabel={`${snapshot.training.inTrainingCount} in progress`}
        />
        <MetricStat
          label="Cadence completion"
          value={formatPercent(snapshot.cadence.dailyPct)}
          sublabel={`WTD ${formatPercent(snapshot.cadence.weeklyPct)}`}
        />
        <MetricStat
          label="Challenges"
          value={`${snapshot.cadence.challengesToday} / ${snapshot.cadence.challengesWeek}`}
          sublabel="Today / week"
        />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-pink-400/30 bg-pink-500/5 p-4">
          <p className="text-[10px] uppercase tracking-[0.3em] text-pink-200">Development pipeline</p>
          <div className="mt-3 space-y-2 text-sm text-pink-50">
            <div className="flex items-center justify-between rounded-2xl border border-pink-400/20 bg-black/20 px-3 py-2">
              <p className="text-xs uppercase tracking-[0.25em] text-pink-200/80">Active</p>
              <p className="text-lg font-semibold text-white">{integerFormatter.format(devActive)}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-pink-400/20 bg-black/20 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-[0.3em] text-pink-200/70">Completed</p>
                <p className="text-base font-semibold text-white">{integerFormatter.format(devCompleted)}</p>
              </div>
              <div className="rounded-2xl border border-pink-400/20 bg-black/20 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-[0.3em] text-pink-200/70">On hold</p>
                <p className="text-base font-semibold text-white">{integerFormatter.format(devOnHold)}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-pink-400/30 bg-pink-500/5 p-4">
          <p className="text-[10px] uppercase tracking-[0.3em] text-pink-200">Avg active days</p>
          <p className="mt-3 text-4xl font-bold text-white">{devAvgDays != null ? devAvgDays : "--"}</p>
          <p className="text-sm text-pink-100">Based on currently active development plans</p>
          <p className="mt-3 text-xs text-pink-100/70">
            Track coaching plans in the employee development table to keep momentum visible on desktop.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

function InventorySuppliesSection({ shopNumber }: { shopNumber: number | string | null | undefined }) {
  const snapshot = useSnapshotSuspense(shopNumber) ?? EMPTY_SNAPSHOT;
  return (
    <SectionCard
      title="Inventory & Supplies"
      eyebrow="Counters & orders"
      accent="cyan"
      actionHref="/pocket-manager5/features/inventory"
      actionLabel="Open inventory"
      quickLinks={["inventory", "supply", "workbook", "checkbook"]}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <MetricStat
          label="Items counted"
          value={integerFormatter.format(snapshot.inventory.totalItems)}
          sublabel={`Oils ${integerFormatter.format(snapshot.inventory.oilsItems)}`}
        />
        <MetricStat
          label="Last count"
          value={snapshot.inventory.lastCountDate ? formatDate(snapshot.inventory.lastCountDate) : "—"}
          sublabel={`${snapshot.inventory.pendingOrders} pending orders`}
        />
      </div>
    </SectionCard>
  );
}

function AdminSafetySection({ shopNumber }: { shopNumber: number | string | null | undefined }) {
  const snapshot = useSnapshotSuspense(shopNumber) ?? EMPTY_SNAPSHOT;
  return (
    <SectionCard
      title="Admin & Safety"
      eyebrow="Claims • Solinks"
      accent="amber"
      actionHref="/pocket-manager5/features/admin-safety"
      actionLabel="Open admin hub"
      quickLinks={["admin-safety", "solinks", "repairs", "claims", "crash-kit"]}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <MetricStat
          label="Claims"
          value={`${snapshot.admin.claimsToday} today`}
          sublabel={`${snapshot.admin.claimsWeek} this week`}
        />
        <MetricStat label="Solinks" value={`${snapshot.admin.solinksToday}`} sublabel="Completed today" />
        <MetricStat label="Alerts" value={snapshot.alerts.length ? `${snapshot.alerts.length}` : "All clear"} />
      </div>
    </SectionCard>
  );
}

const SnapshotFallbacks = {
  labor: () => (
    <SectionCard
      title="Labor & Staffing"
      eyebrow="Hours vs plan"
      accent="violet"
      actionHref="/pocket-manager5/features/labor-tracker"
      actionLabel="Open labor tracker"
      quickLinks={["labor-tracker", "employee-management", "ops"]}
    >
      <SectionStatus message="Calculating labor pull…" />
    </SectionCard>
  ),
  training: () => (
    <SectionCard
      title="Training & Cadence"
      eyebrow="People systems"
      accent="pink"
      actionHref="/pocket-manager5/features/training-tracker"
      actionLabel="Open training tracker"
      quickLinks={["training-tracker", "cadence", "challenges"]}
    >
      <SectionStatus message="Gathering training data…" />
    </SectionCard>
  ),
  inventory: () => (
    <SectionCard
      title="Inventory & Supplies"
      eyebrow="Counters & orders"
      accent="cyan"
      actionHref="/pocket-manager5/features/inventory"
      actionLabel="Open inventory"
      quickLinks={["inventory", "supply", "workbook", "checkbook"]}
    >
      <SectionStatus message="Loading inventory counts…" />
    </SectionCard>
  ),
  admin: () => (
    <SectionCard
      title="Admin & Safety"
      eyebrow="Claims • Solinks"
      accent="amber"
      actionHref="/pocket-manager5/features/admin-safety"
      actionLabel="Open admin hub"
      quickLinks={["admin-safety", "solinks", "repairs", "claims", "crash-kit"]}
    >
      <SectionStatus message="Syncing admin logs…" />
    </SectionCard>
  ),
} as const;

const SnapshotErrorStates = {
  labor: () => (
    <SectionCard
      title="Labor & Staffing"
      eyebrow="Hours vs plan"
      accent="violet"
      actionHref="/pocket-manager5/features/labor-tracker"
      actionLabel="Open labor tracker"
      quickLinks={["labor-tracker", "employee-management", "ops"]}
    >
      <SectionStatus tone="error" message="Labor dashboard unavailable." />
    </SectionCard>
  ),
  training: () => (
    <SectionCard
      title="Training & Cadence"
      eyebrow="People systems"
      accent="pink"
      actionHref="/pocket-manager5/features/training-tracker"
      actionLabel="Open training tracker"
      quickLinks={["training-tracker", "cadence", "challenges"]}
    >
      <SectionStatus tone="error" message="Training data unavailable." />
    </SectionCard>
  ),
  inventory: () => (
    <SectionCard
      title="Inventory & Supplies"
      eyebrow="Counters & orders"
      accent="cyan"
      actionHref="/pocket-manager5/features/inventory"
      actionLabel="Open inventory"
      quickLinks={["inventory", "supply", "workbook", "checkbook"]}
    >
      <SectionStatus tone="error" message="Inventory tools unavailable." />
    </SectionCard>
  ),
  admin: () => (
    <SectionCard
      title="Admin & Safety"
      eyebrow="Claims • Solinks"
      accent="amber"
      actionHref="/pocket-manager5/features/admin-safety"
      actionLabel="Open admin hub"
      quickLinks={["admin-safety", "solinks", "repairs", "claims", "crash-kit"]}
    >
      <SectionStatus tone="error" message="Admin data unavailable." />
    </SectionCard>
  ),
} as const;

const SnapshotEmptyStates = {
  labor: () => (
    <SectionCard
      title="Labor & Staffing"
      eyebrow="Hours vs plan"
      accent="violet"
      actionHref="/pocket-manager5/features/labor-tracker"
      actionLabel="Open labor tracker"
      quickLinks={["labor-tracker", "employee-management", "ops"]}
    >
      <SectionStatus tone="error" message="Link a shop to view labor pacing." />
    </SectionCard>
  ),
  training: () => (
    <SectionCard
      title="Training & Cadence"
      eyebrow="People systems"
      accent="pink"
      actionHref="/pocket-manager5/features/training-tracker"
      actionLabel="Open training tracker"
      quickLinks={["training-tracker", "cadence", "challenges"]}
    >
      <SectionStatus tone="error" message="Link a shop to track training progress." />
    </SectionCard>
  ),
  inventory: () => (
    <SectionCard
      title="Inventory & Supplies"
      eyebrow="Counters & orders"
      accent="cyan"
      actionHref="/pocket-manager5/features/inventory"
      actionLabel="Open inventory"
      quickLinks={["inventory", "supply", "workbook", "checkbook"]}
    >
      <SectionStatus tone="error" message="Link a shop to view live counts." />
    </SectionCard>
  ),
  admin: () => (
    <SectionCard
      title="Admin & Safety"
      eyebrow="Claims • Solinks"
      accent="amber"
      actionHref="/pocket-manager5/features/admin-safety"
      actionLabel="Open admin hub"
      quickLinks={["admin-safety", "solinks", "repairs", "claims", "crash-kit"]}
    >
      <SectionStatus tone="error" message="Link a shop to monitor claims and Solinks." />
    </SectionCard>
  ),
} as const;

const SnapshotDataComponents = {
  labor: LaborStaffingSection,
  training: TrainingCadenceSection,
  inventory: InventorySuppliesSection,
  admin: AdminSafetySection,
} as const;

type SnapshotKey = keyof typeof SnapshotFallbacks;

function SnapshotCardRenderer({ type, shopNumber }: { type: SnapshotKey; shopNumber: number | string | null | undefined }) {
  if (!shopNumber) {
    return SnapshotEmptyStates[type]();
  }

  const Component = SnapshotDataComponents[type];
  return (
    <SectionErrorBoundary fallback={SnapshotErrorStates[type]()}>
      <Suspense fallback={SnapshotFallbacks[type]()}>
        <Component shopNumber={shopNumber} />
      </Suspense>
    </SectionErrorBoundary>
  );
}

export default function PocketManagerPage() {
  const {
    needsLogin,
    loginEmail,
    storedShopName,
    hierarchy,
    hierarchyLoading,
    hierarchyError,
    shopMeta,
  } = usePocketHierarchy();
  const heroName = storedShopName ?? (hierarchy?.shop_number ? `Shop ${hierarchy.shop_number}` : "Pocket Manager5");
  const canSeeDmWorkspace = useMemo(() => {
    const scope = hierarchy?.scope_level?.toUpperCase();
    return scope === "DISTRICT" || scope === "REGION" || scope === "DIVISION";
  }, [hierarchy?.scope_level]);

  if (needsLogin) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-3xl px-4 py-24 text-center">
          <BrandWordmark brand="pocket" mode="dark" className="text-4xl" />
          <p className="mt-6 text-sm text-slate-400">
            Sign in to Pocket Manager5 to unlock visits, labor, training, and inventory tools.
          </p>
          <Link
            href="/login?redirect=/pocket-manager5"
            className="mt-8 inline-flex items-center justify-center rounded-full border border-emerald-400/70 bg-emerald-500/10 px-6 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
          >
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
        <header className="rounded-3xl border border-slate-900/80 bg-slate-950/80 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <BrandWordmark brand="pocket" mode="dark" className="text-[2.4rem]" />
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Sparkles className="h-4 w-4 text-emerald-200" />
                <span className="sr-only">Pocket Manager desktop companion</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <RetailPills />
                <Link
                  href="/"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-100"
                >
                  Home portal
                </Link>
                <Link
                  href="/pocket-manager5/forms"
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-100 transition hover:bg-emerald-500/15"
                >
                  DM forms ↗
                </Link>
                <Link
                  href="/pocket-manager5/features/daily-log"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-100"
                >
                  Open Daily Log
                </Link>
                <Link
                  href="/pulse-check5"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-100"
                >
                  Pulse Check 5 ↗
                </Link>
              </div>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p className="font-semibold text-slate-100">{heroName}</p>
              {hierarchyLoading ? (
                <p>Loading hierarchy…</p>
              ) : hierarchyError ? (
                <p className="text-amber-300">{hierarchyError}</p>
              ) : (
                <HierarchyStamp hierarchy={hierarchy} loginEmail={loginEmail} />
              )}
            </div>
          </div>
        </header>
        <QuickActionsRail />
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <PeopleWorkspaceSection shopNumber={shopMeta?.shop_number} />
            <ManagersClipboardSection />
          </div>
          <div className="space-y-6">
            <OpsHubSection shopId={shopMeta?.id} />
            <SnapshotCardRenderer type="inventory" shopNumber={shopMeta?.shop_number} />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <SnapshotCardRenderer type="labor" shopNumber={shopMeta?.shop_number} />
          <SnapshotCardRenderer type="training" shopNumber={shopMeta?.shop_number} />
        </div>
        <div className="grid gap-6">
          <SnapshotCardRenderer type="admin" shopNumber={shopMeta?.shop_number} />
        </div>
        <DailyLogCard />
        {canSeeDmWorkspace && (
          <section className="space-y-6" aria-label="District manager workspace">
            <DmToolsRail />
            <DistrictScopeKpiSection shopMeta={shopMeta} hierarchy={hierarchy} />
          </section>
        )}
      </div>
    </main>
  );
}

