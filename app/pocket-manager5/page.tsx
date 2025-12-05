"use client";

import Link from "next/link";
import { Component, Suspense, memo, useCallback, useEffect, useMemo, useState, type ReactNode, type ComponentType } from "react";
import { BrandWordmark } from "@/app/components/BrandWordmark";
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
  Crown,
  ThumbsUp,
  CheckSquare,
  ClipboardCheck,
  FileCheck2,
  FileWarning,
  GraduationCap,
  ListChecks,
  Mail,
  NotebookPen,
  Package,
  Phone,
  Search,
  ShieldCheck,
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
import {
  useEmployeeSchedulingPreviewSuspense,
  useMiniPosOverviewSuspense,
  usePeopleFeaturePreviewSuspense,
  useSnapshotSuspense,
} from "@/hooks/usePocketManagerData";
import { EMPTY_SNAPSHOT, type PocketManagerSnapshot } from "@/lib/pocketManagerData";
import { formatPercent } from "@/lib/pulseFormatting";
import type { CoachingPreview, EmployeeSchedulingPreview, PeopleFeaturePreview, StaffPreview } from "@/lib/peopleFeatureData";

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

type HeroSectionProps = {
  heroName: string;
  loginEmail: string | null;
  appendShopHref: ShopHrefAppender;
};

function HeroSection({ heroName, loginEmail, appendShopHref }: HeroSectionProps) {
  const homeShortcutHref = appendShopHref("/") ?? "/";
  const pulseShortcutHref = appendShopHref("/pulse-check5") ?? "/pulse-check5";
  const dailyLogHref = appendShopHref("/pocket-manager5/features/daily-log") ?? "/pocket-manager5/features/daily-log";
  const miniPosHref = appendShopHref("/pocket-manager5/features/mini-pos") ?? "/pocket-manager5/features/mini-pos";
  const loginDisplay = loginEmail ?? heroName;

  return (
    <header className="rounded-3xl border border-slate-900/70 bg-gradient-to-br from-slate-950 via-slate-950/90 to-slate-900/40 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <BrandWordmark brand="pocket" mode="dark" className="text-4xl" showBadge={false} />
            <Link
              href={homeShortcutHref}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-100 transition hover:border-emerald-300/70"
            >
              <ThumbsUp className="h-3.5 w-3.5" /> Home
            </Link>
          </div>
          <div className="text-left lg:text-right">
            <p className="text-base font-semibold text-white tracking-tight">{loginDisplay}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Link
                href={dailyLogHref}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/50 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:border-emerald-300/80"
              >
                Daily Log
              </Link>
              <Link
                href={pulseShortcutHref}
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-100 transition hover:border-sky-300/80"
              >
                <TrendingUp className="h-3.5 w-3.5" /> Pulse Check 5
              </Link>
              <Link
                href={miniPosHref}
                className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/50 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:border-cyan-300/80"
              >
                Mini POS
              </Link>
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <RetailPills />
          <p className="text-sm font-medium text-slate-400">Bringing it all together</p>
        </div>
      </div>
    </header>
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
    title: "Captains Portal",
    subtitle: "Recognition, inventory, pace captains",
    href: "/pocket-manager5/dm-tools/captains",
    icon: Crown,
    accent: "from-amber-500/60 via-amber-500/10 to-slate-950/70",
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

const DM_REVIEW_PRESENTERS = [
  {
    href: "/pocket-manager5/dm-tools/dm-daily-review",
    title: "Daily Review Presenter",
    description: "Quick daily snapshot for stand-ups and morning calls.",
  },
  {
    href: "/pocket-manager5/dm-tools/dm-weekly-review",
    title: "Weekly Review Presenter",
    description: "Roll up your week: wins, gaps, and focus for next week.",
  },
  {
    href: "/pocket-manager5/dm-tools/dm-monthly-review",
    title: "Monthly Review Presenter",
    description: "Full period recap for RD / leadership reviews.",
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DM_TOOL_CARDS.map((tool) => (
          <DmToolBanner key={tool.title} {...tool} />
        ))}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3" aria-label="DM review presenters">
        {DM_REVIEW_PRESENTERS.map((presenter) => (
          <Link
            key={presenter.href}
            href={presenter.href}
            className="rounded-xl bg-slate-900/80 border border-slate-700 px-4 py-3 text-sm transition hover:border-emerald-500 hover:bg-slate-900"
          >
            <div className="font-semibold text-white">{presenter.title}</div>
            <div className="text-xs text-slate-300">{presenter.description}</div>
          </Link>
        ))}
      </div>
    </SectionCard>
  );
}

function DmToolBanner({ title, subtitle, href, icon: Icon, accent }: DmToolCard) {
  const IconComponent = Icon as any;
  return (
    <Link
      href={href}
      className="group relative flex h-full items-center gap-3 overflow-hidden rounded-2xl border border-white/5 bg-slate-950/40 px-4 py-3 text-left transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300"
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${accent}`} />
      <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-900/70 text-white">
        <Icon className="h-5 w-5" />
      </div>
      <div className="relative flex-1">
        <p className="text-sm font-semibold text-white sm:text-base">{title}</p>
        <p className="text-[11px] text-slate-200">{subtitle}</p>
      </div>
      <ArrowUpRight className="relative h-4 w-4 flex-shrink-0 text-slate-200 transition group-hover:text-white" />
    </Link>
  );
}

type WorkspaceTileMeta = {
  title: string;
  subtitle: string;
  href: string;
  // Use a React component type for icon so it can be used as <Icon /> in JSX
  icon?: ComponentType<any>;
  accent: string;
  variant?: "default" | "compact";
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
    variant: "compact",
  },
  {
    title: "Inventory",
    subtitle: "Counters & oils",
    href: "/pocket-manager5/features/inventory",
    icon: Boxes,
    accent: "from-emerald-500/25 via-slate-950/10 to-slate-950/80",
    variant: "compact",
  },
  {
    title: "Shop Checkbook",
    subtitle: "Expense ledger",
    href: "/pocket-manager5/features/checkbook",
    icon: Wallet,
    accent: "from-red-500/25 via-slate-950/10 to-slate-950/80",
    variant: "compact",
  },
  {
    title: "Shop Workbook",
    subtitle: "Vendor spend",
    href: "/pocket-manager5/features/workbook",
    icon: NotebookPen,
    accent: "from-amber-500/25 via-slate-950/10 to-slate-950/80",
    variant: "compact",
  },
  {
    title: "Crash Kit",
    subtitle: "Invoices & work orders",
    href: "/pocket-manager5/features/crash-kit",
    icon: ShieldCheck,
    accent: "from-sky-500/25 via-slate-950/10 to-slate-950/80",
    variant: "compact",
  },
  {
    title: "SoLinks",
    subtitle: "Audit workflows",
    href: "/pocket-manager5/features/solinks",
    icon: Camera,
    accent: "from-purple-500/25 via-slate-950/10 to-slate-950/80",
    variant: "compact",
  },
  {
    title: "Claims",
    subtitle: "Customer & employee",
    href: "/pocket-manager5/features/claims",
    icon: FileWarning,
    accent: "from-rose-500/25 via-slate-950/10 to-slate-950/80",
    variant: "compact",
  },
];

const MANAGER_CORE_TILES: WorkspaceTileMeta[] = [
  {
    title: "KPI Board",
    subtitle: "Performance stack",
    href: "/pocket-manager5/features/kpi-board",
    icon: BarChart3,
    accent: "from-indigo-500/30 via-slate-950/10 to-slate-950/80",
    variant: "compact",
  },
  {
    title: "Cadence",
    subtitle: "DM compliance",
    href: "/pocket-manager5/features/cadence",
    icon: ListChecks,
    accent: "from-violet-500/30 via-slate-950/10 to-slate-950/80",
    variant: "compact",
  },
  {
    title: "Supply Ordering",
    subtitle: "PAR based orders",
    href: "/pocket-manager5/features/supply",
    icon: Package,
    accent: "from-emerald-500/30 via-slate-950/10 to-slate-950/80",
    variant: "compact",
  },
];

const MANAGER_EXTRA_TILES: WorkspaceTileMeta[] = [
  {
    title: "Wage Calculator",
    subtitle: "Labor guardrails",
    href: "/pocket-manager5/features/wage-calculator",
    icon: Calculator,
    accent: "from-indigo-500/20 via-slate-950/10 to-slate-950/80",
    variant: "compact",
  },
  {
    title: "SPIFF Gain/Loss",
    subtitle: "Track incentives",
    href: "/pocket-manager5/features/spiff-gain-loss",
    icon: TrendingUp,
    accent: "from-red-500/20 via-slate-950/10 to-slate-950/80",
    variant: "compact",
  },
  {
    title: "Inventory Lookup",
    subtitle: "Quick search",
    href: "/pocket-manager5/features/inventory-lookup",
    icon: Search,
    accent: "from-emerald-500/20 via-slate-950/10 to-slate-950/80",
    variant: "compact",
  },
  {
    title: "Break Timer",
    subtitle: "Compliance clock",
    href: "/pocket-manager5/features/break-timer",
    icon: AlarmClock,
    accent: "from-amber-500/20 via-slate-950/10 to-slate-950/80",
    variant: "compact",
  },
  {
    title: "Contact List",
    subtitle: "Vendors & partners",
    href: "/pocket-manager5/features/contact-list",
    icon: Phone,
    accent: "from-rose-500/20 via-slate-950/10 to-slate-950/80",
    variant: "compact",
  },
  {
    title: "Compliance Poster",
    subtitle: "Latest docs",
    href: "/pocket-manager5/features/compliance-poster",
    icon: FileCheck2,
    accent: "from-green-500/20 via-slate-950/10 to-slate-950/80",
    variant: "compact",
  },
  {
    title: "Digital Coupons",
    subtitle: "Promo library",
    href: "/pocket-manager5/features/digital-coupons",
    icon: TicketPercent,
    accent: "from-orange-500/20 via-slate-950/10 to-slate-950/80",
    variant: "compact",
  },
  {
    title: "Crew Messages",
    subtitle: "Share recap",
    href: "/pocket-manager5/features/chatbot",
    icon: Mail,
    accent: "from-cyan-500/20 via-slate-950/10 to-slate-950/80",
    variant: "compact",
  },
];

const WorkspaceTile = memo(function WorkspaceTile({ title, subtitle, href, icon: Icon, accent, variant = "default" }: WorkspaceTileMeta) {
  const compact = variant === "compact";
  const showIcon = Boolean(Icon) && !compact;
  const IconComponent = Icon as any;
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-2xl border border-white/5 bg-slate-950/70 transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300 ${compact ? "flex flex-col items-center gap-2.5 p-3 text-center sm:p-4" : "flex flex-wrap items-center gap-2.5 p-3 sm:flex-nowrap sm:gap-3 sm:p-4"}`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent}`} />
      {showIcon ? (
          <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-black/30 text-white">
          <IconComponent className="h-4 w-4" />
        </div>
      ) : null}
      <div className={`relative min-w-0 flex-1 ${compact ? "text-center" : ""}`}>
        <p className={`${compact ? "text-[12px] font-semibold leading-snug text-white" : "text-sm font-semibold leading-tight text-white sm:text-base"}`}>{title}</p>
        <p className={`${compact ? "text-[10px] leading-tight text-slate-200" : "text-[11px] leading-snug text-slate-200 sm:text-xs"}`}>{subtitle}</p>
      </div>
      {compact ? (
        <ArrowUpRight className="relative mt-1 h-3.5 w-3.5 text-slate-400 transition group-hover:text-white" />
      ) : (
        <ArrowUpRight className="relative ml-auto h-4 w-4 flex-shrink-0 text-slate-400 transition group-hover:text-white" />
      )}
    </Link>
  );
});
WorkspaceTile.displayName = "WorkspaceTile";

function PeopleWorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <SectionCard
      title="People Workspace"
      eyebrow="Employee management"
      accent="violet"
      quickLinks={["employee-management", "training-tracker", "employee-scheduling"]}
      actionHref="/pocket-manager5/features/employee-management"
      actionLabel="Open people hub"
      formSlugs={PEOPLE_FORM_SLUGS}
    >
      {children}
    </SectionCard>
  );
}

const PEOPLE_ACTIONS = [
  { label: "Open hub", href: "/pocket-manager5/features/employee-management" },
  { label: "Scheduling", href: "/pocket-manager5/features/employee-scheduling" },
  { label: "Staff list", href: "/pocket-manager5/features/staff-management" },
  { label: "Labor tracker", href: "/pocket-manager5/features/labor-tracker" },
];

const TRAINING_COLUMN_LABELS = [
  "Orientation",
  "Safety",
  "Mobil 1",
  "Big 4",
  "ARO",
  "Inspections",
  "Customer Care",
  "Leadership",
  "Ops Readiness",
  "Certified",
];

const TRAINING_STATUS_SEQUENCE = ["Not started", "In progress", "Complete"] as const;
type TrainingSummary = Pick<PeopleFeaturePreview["training"], "completionPct" | "completed" | "inProgress" | "notStarted">;
type TrainingMatrixRow = {
  id: string;
  name: string;
  dueDate: string | null;
  tenureMonths: number | null;
  modules: Record<string, string>;
};

function PeopleWorkspaceActionRow() {
  return (
    <div className="mb-4 flex flex-wrap gap-2" aria-label="People workspace quick actions">
      {PEOPLE_ACTIONS.map((action) => (
        <Link
          key={action.label}
          href={action.href}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-900/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-emerald-400/40 hover:text-white"
        >
          {action.label}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      ))}
    </div>
  );
}

function TrainingMatrixPanel({ roster, summary }: { roster: StaffPreview[]; summary: TrainingSummary }) {
  const rows = useMemo(() => buildTrainingRows(roster), [roster]);
  const hasRoster = rows.length > 0 && !rows[0].id.startsWith("placeholder");

  return (
    <section className="mt-4 rounded-3xl border border-white/10 bg-gradient-to-br from-[#050b19] via-[#060d1f] to-[#040913] p-5 shadow-[0_25px_70px_rgba(2,6,23,0.7)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-violet-200">Training tracker</p>
          <p className="text-lg font-semibold text-white">Grid view</p>
          <p className="text-xs text-slate-400">Auto-syncs with Expo training hub</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/pocket-manager5/features/employee-training"
            className="inline-flex items-center gap-1 rounded-full border border-violet-400/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-violet-100 transition hover:bg-white/5"
          >
            Open tracker
            <ArrowUpRight className="h-3 w-3" />
          </Link>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-emerald-300/40"
          >
            Export CSV
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-slate-300">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Completion</p>
          <p className="text-3xl font-bold text-emerald-200">{summary.completionPct}%</p>
          <p className="text-xs">{summary.completed} complete • {summary.inProgress} in flight</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Open items</p>
          <p className="text-lg font-semibold text-white">{summary.notStarted}</p>
          <p className="text-xs">Waiting to begin</p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[960px]">
          <div
            className="grid text-[11px] font-semibold uppercase tracking-widest text-slate-400"
            style={{ gridTemplateColumns: `220px repeat(${TRAINING_COLUMN_LABELS.length}, minmax(110px, 1fr))` }}
          >
            <div className="px-3 py-2">Employee</div>
            {TRAINING_COLUMN_LABELS.map((label) => (
              <div key={label} className="px-3 py-2 text-center">
                {label}
              </div>
            ))}
          </div>
          {rows.map((row) => (
            <div
              key={row.id}
              className="grid border-t border-white/5 text-sm"
              style={{ gridTemplateColumns: `220px repeat(${TRAINING_COLUMN_LABELS.length}, minmax(110px, 1fr))` }}
            >
              <div className="flex items-center justify-between gap-3 px-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-white">{row.name}</p>
                  <p className="text-xs text-slate-400">{formatDueDateLabel(row.dueDate)}</p>
                </div>
                <p className="text-[11px] text-slate-500">{row.tenureMonths != null ? `${row.tenureMonths} mo` : "New"}</p>
              </div>
              {TRAINING_COLUMN_LABELS.map((label) => {
                const status = row.modules[label] ?? "--";
                return (
                  <div key={`${row.id}-${label}`} className="px-3 py-3">
                    <span
                      className={`inline-flex w-full items-center justify-center rounded-full border px-2 py-1 text-[11px] ${trainingStatusClasses(status)}`}
                    >
                      {status}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {!hasRoster && (
        <p className="mt-3 text-xs text-slate-400">Add employees in Staff Management to replace the placeholder grid.</p>
      )}
    </section>
  );
}
WorkspaceTile.displayName = "WorkspaceTile";

function buildTrainingRows(roster: StaffPreview[]): TrainingMatrixRow[] {
  const source = roster.length ? roster.slice(0, 8) : [
    {
      id: "placeholder-1",
      name: "Sample Teammate",
      role: null,
      status: null,
      tenureMonths: 2,
      hiredAt: new Date().toISOString(),
    },
  ];

  return source.map((staff, rowIndex) => {
    const modules: Record<string, string> = {};
    TRAINING_COLUMN_LABELS.forEach((label, moduleIndex) => {
      const statusIndex = (rowIndex + moduleIndex) % TRAINING_STATUS_SEQUENCE.length;
      modules[label] = TRAINING_STATUS_SEQUENCE[statusIndex];
    });

    return {
      <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-900/70 text-white">
        <IconComponent className="h-5 w-5" />
      dueDate: deriveDueDate(staff.hiredAt, rowIndex),
      tenureMonths: staff.tenureMonths ?? null,
      modules,
    };
  });
}

function deriveDueDate(hiredAt: string | null | undefined, offset: number) {
  const base = hiredAt ? new Date(hiredAt) : new Date();
  if (Number.isNaN(base.getTime())) {
    base.setTime(Date.now());
  }
  const clone = new Date(base);
  clone.setDate(clone.getDate() + 14 + offset * 3);
  return clone.toISOString().split("T")[0];
}

function formatDueDateLabel(value: string | null) {
  if (!value) return "Due TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Due TBD";
  return `Due ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function trainingStatusClasses(status: string) {
  if (status.toLowerCase() === "complete") {
    return "border-emerald-400/40 bg-emerald-500/10 text-emerald-100";
  }
  if (status.toLowerCase() === "in progress") {
    return "border-amber-400/40 bg-amber-500/10 text-amber-100";
  }
  if (status === "--") {
    return "border-slate-700/40 bg-slate-900/40 text-slate-400";
  }
  return "border-slate-600/40 bg-slate-900/30 text-slate-200";
}

function SchedulingSnapshotCard({ preview }: { preview: EmployeeSchedulingPreview }) {
  const totalHours = preview.legacyScheduler.totalHours || preview.simpleScheduler.totalHours;
  const allowedHours = preview.projections.totalAllowedHours;
  const variance = Number(totalHours ?? 0) - Number(allowedHours ?? 0);
  const coverage = preview.simpleScheduler.dailyCoverage.slice(0, 4);
  const rows = preview.legacyScheduler.rows.slice(0, 4);
  const varianceTone = variance > 1 ? "border-rose-400/40 bg-rose-500/10 text-rose-100" : variance < -1 ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100" : "border-amber-400/40 bg-amber-500/10 text-amber-100";
  const hasData = rows.length > 0 || preview.simpleScheduler.totalHours > 0;

  return (
    <section className="rounded-3xl border border-white/10 bg-[#050b19]/80 p-5 shadow-[0_25px_70px_rgba(2,6,23,0.65)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-cyan-200">Scheduling snapshot</p>
          <p className="text-lg font-semibold text-white">{formatWeekRangeLabel(preview.weekStartISO, preview.weekEndISO)}</p>
          <p className="text-xs text-slate-400">Allowed {allowedHours.toFixed(1)}h · Scheduled {totalHours.toFixed(1)}h</p>
        </div>
        <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] ${varianceTone}`}>
          {variance >= 0 ? "+" : ""}
          {variance.toFixed(1)}h
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {coverage.map((day) => (
          <div key={day.date} className="min-w-[120px] rounded-2xl border border-white/5 bg-white/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">{formatDayLabel(day.date)}</p>
            <p className="text-lg font-semibold text-white">{day.hours.toFixed(1)}h</p>
            <p className="text-[11px] text-slate-400">Goal {(day.allowedHours ?? 0).toFixed(1)}h</p>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {hasData ? (
          rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-slate-900/30 px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-white">{row.staffName}</p>
                <p className="text-xs text-slate-400">{row.position ?? "Role TBD"}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-white">{row.totalHours.toFixed(1)}h</p>
                <p className={`text-[11px] ${row.overtimeHours > 0 ? "text-amber-200" : "text-slate-400"}`}>
                  OT {row.overtimeHours.toFixed(1)}h
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/20 px-3 py-4 text-sm text-slate-400">
            No schedules saved for this week. Jump into the scheduler to add your first roster.
          </p>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/pocket-manager5/features/employee-scheduling"
          className="inline-flex items-center gap-1 rounded-full border border-cyan-400/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-100 transition hover:bg-white/5"
        >
          View schedule
          <ArrowUpRight className="h-3 w-3" />
        </Link>
        <Link
          href="/pocket-manager5/features/employee-scheduling?view=builder"
          className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-emerald-300/40"
        >
          Build week
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}

function formatWeekRangeLabel(startIso?: string | null, endIso?: string | null) {
  if (!startIso || !endIso) return "This week";
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "This week";
  }
  const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

function formatDayLabel(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function CoachingLogHighlights({ coaching }: { coaching: CoachingPreview }) {
  const last14 = coaching.histogram.slice(-14);
  const maxCount = last14.reduce((max, entry) => Math.max(max, entry.count), 0) || 1;
  const recent = coaching.recent.slice(0, 3);
  const monthTotal = coaching.histogram.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#071021] via-[#050b18] to-[#03060d] p-5 shadow-[0_25px_70px_rgba(2,6,23,0.65)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-emerald-200">Coaching log</p>
          <p className="text-lg font-semibold text-white">{monthTotal} sessions · 30 days</p>
          <p className="text-xs text-slate-400">Mirrors Expo coaching logbook</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/pocket-manager5/features/coaching-log"
            className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-100 transition hover:bg-white/5"
          >
            Open log
            <ArrowUpRight className="h-3 w-3" />
          </Link>
          <Link
            href="/pocket-manager5/features/coaching-log?view=new"
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-emerald-300/40"
          >
            Log session
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
      <div className="mt-4 flex h-28 items-end gap-1">
        {last14.map((entry) => (
          <div key={entry.date} className="flex-1">
            <div
              className="w-full rounded-t-sm bg-emerald-400/70"
              style={{ height: `${(entry.count / maxCount) * 100}%` }}
              aria-hidden="true"
            />
            <p className="mt-1 text-center text-[10px] text-slate-500">{formatDayLabel(entry.date)}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {recent.length ? (
          recent.map((log) => (
            <div key={log.id} className="rounded-2xl border border-white/5 bg-slate-900/30 px-3 py-2">
              <p className="text-sm font-semibold text-white">{log.staffName ?? "Unnamed teammate"}</p>
              <p className="text-xs text-slate-400">{log.reason ?? "Coaching session"} • {formatShortDate(log.coachedAt)}</p>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/20 px-3 py-4 text-sm text-slate-400">
            No recent coaching sessions logged. Use the buttons above to add your first recap.
          </p>
        )}
      </div>
    </section>
  );
}

function formatShortDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  const peoplePreview = usePeopleFeaturePreviewSuspense(shopNumber);
  const schedulingPreview = useEmployeeSchedulingPreviewSuspense(shopNumber);

  return (
    <>
      <PeopleWorkspaceActionRow />
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
      <TrainingMatrixPanel roster={peoplePreview.roster} summary={peoplePreview.training} />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SchedulingSnapshotCard preview={schedulingPreview} />
        <CoachingLogHighlights coaching={peoplePreview.coaching} />
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
  const appendShopHref = useShopHrefAppender();
  const contactListHref = appendShopHref("/pocket-manager5/features/phone-sheet") ?? "/pocket-manager5/features/phone-sheet";
  return (
    <SectionCard
      title="OPS Hub"
      eyebrow="Operations grid"
      accent="emerald"
      actionHref="/pocket-manager5/features/ops"
      quickLinks={["ops", "inventory", "workbook", "checkbook", "crash-kit", "repairs", "solinks", "claims", "alerts", "challenges"]}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2" aria-label="Ops hub shortcuts">
          <Link
            href={contactListHref}
            className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-100 transition hover:border-amber-300/70"
          >
            Contact list
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
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
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {MANAGER_CORE_TILES.map((tile) => (
          <WorkspaceTile key={tile.title} {...tile} />
        ))}
      </div>
      <p className="mt-6 text-xs uppercase tracking-[0.3em] text-amber-200">Additional tools</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MANAGER_EXTRA_TILES.map((tile) => (
          <WorkspaceTile key={tile.title} {...tile} />
        ))}
      </div>
    </SectionCard>
  );
}

function MiniPosShell({ children, variant = "card" }: { children: ReactNode; variant?: "card" | "inline" }) {
  if (variant === "inline") {
    return (
      <div className="rounded-3xl border border-cyan-400/30 bg-slate-950/70 p-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-200">Mini POS</p>
          <p className="text-sm text-slate-300">Work order shortcuts</p>
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
        <MetricStat label="Team on file" value={integerFormatter.format(overview.employeeCount)} sublabel="Staff on file" />
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

export default function PocketManagerPage() {
  const {
    needsLogin,
    loginEmail,
    storedShopName,
    hierarchy,
    shopMeta,
  } = usePocketHierarchy();
  const appendShopHref = useShopHrefAppender();
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
        <HeroSection heroName={heroName} loginEmail={loginEmail} appendShopHref={appendShopHref} />
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6">
            <PeopleWorkspaceSection shopNumber={shopMeta?.shop_number} />
          </div>
          <div className="space-y-6">
            <OpsHubSection shopId={shopMeta?.id} />
          </div>
          <div className="space-y-6">
            <ManagersClipboardSection />
          </div>
        </div>
        {canSeeDmWorkspace && (
          <section className="space-y-6" aria-label="District manager workspace">
            <DmToolsRail />
          </section>
        )}
      </div>
    </main>
  );
}

