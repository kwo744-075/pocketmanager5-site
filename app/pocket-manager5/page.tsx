"use client";

import Link from "next/link";
import { Component, Suspense, useMemo, type ReactNode } from "react";
import {
  AlarmClock,
  ArrowUpRight,
  BarChart3,
  Brain,
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
  MessageCircle,
  NotebookPen,
  Package,
  Phone,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  TicketPercent,
  TrendingUp,
  UserCog,
  UserMinus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { BrandWordmark } from "@/app/components/BrandWordmark";
import { RetailPills } from "@/app/components/RetailPills";
import { HierarchyStamp } from "@/app/components/HierarchyStamp";
import { usePocketHierarchy } from "@/hooks/usePocketHierarchy";
import {
  useHierarchyRollupsSuspense,
  useMiniPosOverviewSuspense,
  usePulseTotalsSuspense,
  useSnapshotSuspense,
  type HierarchyRollupScope,
} from "@/hooks/usePocketManagerData";
import { EMPTY_SNAPSHOT, type PocketManagerSnapshot } from "@/lib/pocketManagerData";
import { type PulseTotals, EMPTY_TOTALS } from "@/lib/pulseTotals";
import type { RollupSummary } from "@/lib/pulseRollups";
import { FEATURE_LOOKUP, type FeatureSlug } from "./featureRegistry";
import { DM_FORM_SLUGS, FORM_LOOKUP, PEOPLE_FORM_SLUGS, type FormSlug } from "./forms/formRegistry";
import {
  DM_DAY_NAMES,
  DM_STATUS_DOTS,
  DM_VISIT_BADGES,
  buildCoverageSummary,
  buildDueChecklist,
  buildPeriodGrid,
  buildSampleSchedule,
  buildVisitMix,
  getRetailPeriodInfo,
  groupEntriesByDate,
  shortDateFormatter,
  type SampleScheduleEntry,
} from "./components/dmScheduleUtils";

const integerFormatter = new Intl.NumberFormat("en-US");
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const formatPercent = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "--";
  return `${Math.round(value)}%`;
};

const mixPercent = (value: number, cars: number) => {
  if (!cars || cars <= 0) return "--";
  return `${((value / cars) * 100).toFixed(1)}%`;
};

type AccentTone = "emerald" | "azure" | "violet" | "amber" | "pink" | "cyan" | "slate";

const ACCENT_STYLES: Record<AccentTone, { border: string; eyebrow: string; glow: string; radial: string; actionBorder: string }> = {
  emerald: {
    border: "border-emerald-400/40",
    eyebrow: "text-emerald-200",
    glow: "shadow-emerald-500/20",
    radial: "from-emerald-500/10 via-slate-950/40 to-slate-950/70",
    actionBorder: "border-emerald-400/60",
  },
  azure: {
    border: "border-cyan-400/40",
    eyebrow: "text-cyan-200",
    glow: "shadow-cyan-500/20",
    radial: "from-cyan-500/10 via-slate-950/40 to-slate-950/70",
    actionBorder: "border-cyan-400/60",
  },
  violet: {
    border: "border-violet-400/40",
    eyebrow: "text-violet-200",
    glow: "shadow-violet-500/20",
    radial: "from-violet-500/10 via-slate-950/40 to-slate-950/70",
    actionBorder: "border-violet-400/60",
  },
  amber: {
    border: "border-amber-400/40",
    eyebrow: "text-amber-200",
    glow: "shadow-amber-500/20",
    radial: "from-amber-500/10 via-slate-950/40 to-slate-950/70",
    actionBorder: "border-amber-400/60",
  },
  pink: {
    border: "border-pink-400/40",
    eyebrow: "text-pink-200",
    glow: "shadow-pink-500/20",
    radial: "from-pink-500/10 via-slate-950/40 to-slate-950/70",
    actionBorder: "border-pink-400/60",
  },
  cyan: {
    border: "border-sky-400/40",
    eyebrow: "text-sky-200",
    glow: "shadow-sky-500/20",
    radial: "from-sky-500/10 via-slate-950/40 to-slate-950/70",
    actionBorder: "border-sky-400/60",
  },
  slate: {
    border: "border-slate-800/80",
    eyebrow: "text-slate-400",
    glow: "shadow-black/20",
    radial: "from-slate-500/5 via-slate-950/40 to-slate-950/70",
    actionBorder: "border-slate-700",
  },
};

type SectionCardProps = {
  title: string;
  eyebrow: string;
  action?: ReactNode;
  actionHref?: string;
  actionLabel?: string;
  children: ReactNode;
  accent?: AccentTone;
  quickLinks?: FeatureSlug[];
  formSlugs?: FormSlug[];
};

function SectionCard({
  title,
  eyebrow,
  action,
  actionHref,
  actionLabel = "Open workspace",
  children,
  accent = "slate",
  quickLinks,
  formSlugs,
}: SectionCardProps) {
  const accentStyles = ACCENT_STYLES[accent];
  const resolvedAction = actionHref && !action ? (
    <Link
      href={actionHref}
      className={`inline-flex items-center rounded-full ${accentStyles.actionBorder} px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300`}
    >
      {actionLabel}
    </Link>
  ) : (
    action ?? null
  );

  return (
    <article
      className={`relative overflow-hidden rounded-3xl border ${accentStyles.border} bg-slate-950/80 p-6 shadow-2xl ${accentStyles.glow}`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accentStyles.radial}`} />
      <div className="relative flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <p className={`text-[10px] uppercase tracking-[0.3em] ${accentStyles.eyebrow}`}>{eyebrow}</p>
          <h2 className="text-2xl font-semibold text-white">{title}</h2>
        </div>
        {resolvedAction}
      </div>
      <div className="relative pt-4 space-y-5">{children}</div>
      {formSlugs && formSlugs.length > 0 && <FormQuickLinks slugs={formSlugs} />}
      {quickLinks && quickLinks.length > 0 && <FeatureQuickLinks slugs={quickLinks} />}
    </article>
  );
}

function FeatureQuickLinks({ slugs }: { slugs: FeatureSlug[] }) {
  const items = slugs
    .map((slug) => FEATURE_LOOKUP[slug])
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (!items.length) {
    return null;
  }

  return (
    <div className="relative mt-5 flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.slug}
          href={`/pocket-manager5/features/${item.slug}`}
          className="group/quick inline-flex items-center gap-1 rounded-full border border-slate-800/60 bg-slate-900/60 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
        >
          <span>{item.title}</span>
          <span className="text-slate-500 transition group-hover/quick:translate-x-0.5 group-hover/quick:text-emerald-200">›</span>
        </Link>
      ))}
    </div>
  );
}

function FormQuickLinks({ slugs }: { slugs: FormSlug[] }) {
  const items = slugs
    .map((slug) => FORM_LOOKUP[slug])
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (!items.length) {
    return null;
  }

  return (
    <div className="relative mt-5 flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.slug}
          href={`/pocket-manager5/forms/${item.slug}`}
          className="group/form inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/5 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
        >
          <span>{item.title}</span>
          <span className="text-emerald-200 transition group-hover/form:translate-x-0.5">↗</span>
        </Link>
      ))}
    </div>
  );
}

function SectionStatus({ message, tone = "muted" }: { message: string; tone?: "muted" | "error" }) {
  const toneClasses =
    tone === "error"
      ? "text-amber-300"
      : tone === "muted"
      ? "text-slate-400"
      : "text-slate-400";

  return <p className={`text-sm ${toneClasses}`}>{message}</p>;
}

type QuickAction = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accent: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Messages",
    description: "AI + DM threads",
    href: "/pocket-manager5/features/chatbot",
    icon: MessageCircle,
    accent: "from-cyan-500/40 via-transparent to-slate-950/80",
  },
  {
    label: "Turned",
    description: "Capture approvals",
    href: "/pocket-manager5/features/turned-log",
    icon: RefreshCcw,
    accent: "from-amber-500/40 via-transparent to-slate-950/80",
  },
  {
    label: "Contacts",
    description: "Phone sheet",
    href: "/pocket-manager5/features/employee-management",
    icon: Phone,
    accent: "from-emerald-500/40 via-transparent to-slate-950/80",
  },
];

function QuickActionsRail() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {QUICK_ACTIONS.map((action) => (
        <QuickActionLink key={action.label} {...action} />
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

type MonthCalendarCell = {
  iso: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasEntries: boolean;
  isPast: boolean;
};

type MonthCalendar = {
  label: string;
  weeks: MonthCalendarCell[][];
};

const buildMonthCalendar = (
  monthAnchor: Date,
  today: Date,
  entriesByDate: Record<string, SampleScheduleEntry[]>,
): MonthCalendar => {
  const firstOfMonth = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
  const firstGridDate = new Date(firstOfMonth);
  firstGridDate.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const matrix: MonthCalendarCell[][] = [];

  for (let week = 0; week < 6; week += 1) {
    const row: MonthCalendarCell[] = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const cellDate = new Date(firstGridDate);
      cellDate.setDate(firstGridDate.getDate() + week * 7 + weekday);
      const iso = cellDate.toISOString().split("T")[0];
      const cellMidnight = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate()).getTime();
      row.push({
        iso,
        dayNumber: cellDate.getDate(),
        isCurrentMonth: cellDate.getMonth() === firstOfMonth.getMonth(),
        isToday: cellMidnight === todayMidnight,
        hasEntries: Boolean(entriesByDate[iso]?.length),
        isPast: cellMidnight < todayMidnight,
      });
    }
    matrix.push(row);
  }

  const monthLabel = firstOfMonth.toLocaleString("en-US", { month: "long", year: "numeric" });
  return { label: monthLabel, weeks: matrix };
};

const buildMonthlyLookahead = (
  today: Date,
  entriesByDate: Record<string, SampleScheduleEntry[]>,
): MonthCalendar[] => {
  const currentMonthAnchor = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonthAnchor = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return [buildMonthCalendar(currentMonthAnchor, today, entriesByDate), buildMonthCalendar(nextMonthAnchor, today, entriesByDate)];
};

function DmScheduleShowcase() {
  const today = useMemo(() => new Date(), []);
  const periodInfo = useMemo(() => getRetailPeriodInfo(today), [today]);
  const scheduleEntries = useMemo(
    () => buildSampleSchedule(periodInfo.startDate, periodInfo.weeksInPeriod),
    [periodInfo.startDate, periodInfo.weeksInPeriod],
  );
  const calendarGrid = useMemo(
    () => buildPeriodGrid(periodInfo.startDate, periodInfo.weeksInPeriod, today),
    [periodInfo.startDate, periodInfo.weeksInPeriod, today],
  );
  const entriesByDate = useMemo(() => groupEntriesByDate(scheduleEntries), [scheduleEntries]);
  const monthlyCalendars = useMemo(() => buildMonthlyLookahead(today, entriesByDate), [today, entriesByDate]);
  const coverageSummary = useMemo(() => buildCoverageSummary(scheduleEntries), [scheduleEntries]);
  const visitMix = useMemo(() => buildVisitMix(scheduleEntries), [scheduleEntries]);
  const dueChecklist = useMemo(() => buildDueChecklist(scheduleEntries, periodInfo.period), [scheduleEntries, periodInfo.period]);

  const totalVisits = scheduleEntries.filter((entry) => entry.visitType !== "Off").length;
  const adminBlocks = scheduleEntries.filter((entry) => entry.visitType === "Admin" || entry.visitType === "Project Day").length;
  const visitCompletionPct = Math.min(100, Math.round((totalVisits / 12) * 100));
  const weekProgress = (periodInfo.weekOfPeriod / periodInfo.weeksInPeriod) * 100;
  const periodRange = `${shortDateFormatter.format(periodInfo.startDate)} – ${shortDateFormatter.format(periodInfo.endDate)}`;

  return (
    <SectionCard
      title="Full-Period Scheduler"
      eyebrow="DM tools"
      accent="azure"
      actionHref="/pocket-manager5/features/dm-schedule"
      actionLabel="Open DM schedule"
      quickLinks={["dm-schedule", "dm-logbook", "cadence"]}
    >
      <div className="grid gap-5 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span className="font-semibold text-slate-200">Q{periodInfo.quarter} · Period {periodInfo.period}</span>
            <span>{periodRange}</span>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
            {DM_DAY_NAMES.map((day) => (
              <span key={day} className="text-center">
                {day}
              </span>
            ))}
          </div>
          <div className="mt-2 space-y-1.5">
            {calendarGrid.map((week, weekIdx) => (
              <div key={`week-${weekIdx}`} className="grid grid-cols-7 gap-1.5">
                {week.map((day) => {
                  const dayEntries = entriesByDate[day.iso] ?? [];
                  const visibleEntries = dayEntries.slice(0, 2);
                  const overflow = Math.max(dayEntries.length - visibleEntries.length, 0);
                  const dayBorder = day.isToday
                    ? "border-emerald-400/60 bg-emerald-500/5"
                    : day.isPast
                    ? "border-slate-800/60 bg-slate-900/40"
                    : "border-slate-700/60 bg-slate-900/70";
                  const dayText = day.isPast ? "text-slate-500" : "text-white";

                  return (
                    <div
                      key={day.iso}
                      className={`rounded-2xl border p-3 shadow-[0_4px_12px_rgba(1,6,20,0.35)] ${dayBorder}`}
                    >
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span className={dayText}>{day.dayNumber}</span>
                        {day.isToday && <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-300">Now</span>}
                      </div>
                      <div className="mt-1 space-y-1">
                        {visibleEntries.map((entry) => (
                          <div
                            key={`${entry.iso}-${entry.visitType}-${entry.locationLabel}`}
                            className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${DM_VISIT_BADGES[entry.visitType] ?? "border-slate-700/60 text-slate-200"}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${DM_STATUS_DOTS[entry.status]}`} />
                            <span className="text-[9px] font-semibold leading-none">{entry.visitType}</span>
                          </div>
                        ))}
                        {overflow > 0 && <p className="text-[9px] text-slate-500">+{overflow} more</p>}
                        {dayEntries.length === 0 && <p className="text-[9px] text-slate-600">Open</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${DM_STATUS_DOTS.complete}`} /> Complete
            </span>
            <span className="inline-flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${DM_STATUS_DOTS.locked}`} /> Locked
            </span>
            <span className="inline-flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${DM_STATUS_DOTS.planned}`} /> Planned
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Period tracker</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-400">Visits locked</p>
                <p className="text-2xl font-semibold text-white">{totalVisits}</p>
                <p className="text-[11px] text-slate-500">Target 12</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Admin / project</p>
                <p className="text-2xl font-semibold text-white">{adminBlocks}</p>
                <p className="text-[11px] text-slate-500">Home office days</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Week progress</span>
                  <span>
                    W{periodInfo.weekOfPeriod} / {periodInfo.weeksInPeriod}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: `${weekProgress}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Visit completion</span>
                  <span>{visitCompletionPct}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-cyan-400" style={{ width: `${visitCompletionPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Visit plan</p>
            <ul className="mt-3 space-y-2">
              {dueChecklist.map((item) => (
                <li
                  key={item.type}
                  className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-900/40 px-3 py-2"
                >
                  <div>
                    <p className="text-xs text-slate-400">{item.type}</p>
                    <p className="text-sm font-semibold text-white">
                      {item.actual} / {item.required}
                    </p>
                  </div>
                  <span className={`text-[11px] font-semibold ${item.met ? "text-emerald-300" : "text-amber-300"}`}>
                    {item.met ? "On target" : "Need locks"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 border-t border-slate-800/60 pt-3">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Visit mix</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-200">
                {visitMix.map((mix) => (
                  <li key={mix.type} className="flex items-center justify-between">
                    <span>{mix.type}</span>
                    <span className="text-slate-400">{mix.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Coverage grid</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {coverageSummary.map((shop) => (
                <div key={shop.shopId} className={`rounded-2xl border px-3 py-2 ${shop.toneClass}`}>
                  <p className="text-xs text-slate-300">{shop.label}</p>
                  <p className="text-lg font-semibold text-white">{shop.count} visits</p>
                  <p className={`text-[11px] font-semibold ${shop.badgeClass}`}>{shop.statusLabel}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Monthly lookahead</p>
                <p className="text-base font-semibold text-white">Current & next month</p>
              </div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Tap to lock dates</p>
            </div>
            <div className="mt-4 space-y-4">
              {monthlyCalendars.map((month) => (
                <div key={month.label} className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4">
                  <p className="text-lg font-semibold text-white">{month.label}</p>
                  <div className="mt-3 grid grid-cols-7 gap-1 text-[11px] uppercase tracking-[0.3em] text-slate-500">
                    {DM_DAY_NAMES.map((day) => (
                      <span key={`${month.label}-${day}`} className="text-center">
                        {day}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {month.weeks.map((week, idx) => (
                      <div key={`${month.label}-week-${idx}`} className="grid grid-cols-7 gap-1.5">
                        {week.map((cell) => {
                          const cellTone = cell.isCurrentMonth ? "text-white" : "text-slate-600";
                          const borderTone = cell.isCurrentMonth ? "border-slate-800/60" : "border-slate-900/40";
                          const todayRing = cell.isToday ? "ring-1 ring-emerald-400/60" : "";
                          const visitBadge = cell.hasEntries ? "border-cyan-400/50 bg-cyan-500/5" : "";
                          const pastOpacity = cell.isPast && !cell.isToday ? "opacity-70" : "";

                          return (
                            <div
                              key={cell.iso}
                              className={`rounded-xl border bg-slate-950/50 p-3 text-center text-sm font-semibold ${cellTone} ${borderTone} ${todayRing} ${visitBadge} ${pastOpacity}`}
                            >
                              {cell.dayNumber}
                              {cell.hasEntries && <div className="mx-auto mt-2 h-1.5 w-1.5 rounded-full bg-cyan-300" />}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
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

function AiAssistantCard() {
  return (
    <SectionCard
      title="AI Assistant"
      eyebrow="ChatGPT on device"
      accent="pink"
      actionHref="/pocket-manager5/features/chatbot"
      actionLabel="Launch assistant"
      quickLinks={["chatbot", "alerts"]}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-slate-200">
            Ask policy questions, draft visit recaps, and get next-step coaching just like the in-app assistant experience.
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.3em] text-pink-200">Scripts • Notes • Coaching</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-pink-400/40 bg-pink-500/10 px-4 py-2 text-sm font-semibold text-pink-100">
          <Brain className="h-4 w-4" />
          Powered by GPT
        </div>
      </div>
    </SectionCard>
  );
}

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
  ];

  const trainingPercentValue = trainingPct ?? 0;
  const trainingPercentDisplay = trainingPct == null ? "--" : `${Math.round(trainingPct)}%`;
  const inTrainingText = inTraining == null ? "Preview data pending" : `${inTraining} teammates in training`;
  const cadenceDailyDisplay = cadenceDaily == null ? "--" : Math.round(cadenceDaily).toString();
  const cadenceWeeklyDisplay = cadenceWeekly == null ? "--" : Math.round(cadenceWeekly).toString();

  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#030d1f]/95 via-[#040b1b]/96 to-[#01040c]/98 p-5 shadow-[0_30px_80px_rgba(5,15,35,0.65)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">People &amp; training</p>
          <h3 className="text-xl font-semibold text-white">Profile snapshot</h3>
        </div>
        {updatedLabel && <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Updated {updatedLabel}</p>}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
      <div className="mt-4 grid gap-4 md:grid-cols-3">
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
      quickLinks={["ops", "inventory", "workbook", "checkbook", "crash-kit", "solinks", "claims", "mini-pos"]}
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
      quickLinks={["cadence", "supply", "kpi-board", "wage-calculator"]}
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
  if (variant === "inline") {
    return (
      <div className="rounded-3xl border border-cyan-400/30 bg-slate-950/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-200">Mini POS</p>
            <p className="text-sm text-slate-300">Work order shortcuts</p>
          </div>
          <Link
            href="/pocket-manager5/features/mini-pos"
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

const mixLabels: Array<{ key: keyof PulseTotals; label: string }> = [
  { key: "big4", label: "Big 4" },
  { key: "coolants", label: "Coolants" },
  { key: "diffs", label: "Diffs" },
  { key: "mobil1", label: "Mobil 1" },
];

function PulseOverviewShell({ children }: { children: ReactNode }) {
  return (
    <SectionCard
      title="Daily Ops Overview"
      eyebrow="Today vs week"
      accent="emerald"
      quickLinks={["daily-log", "turned-log", "mini-pos", "chatbot", "ops"]}
    >
      {children}
    </SectionCard>
  );
}

function PulseOverviewContent({ shopId, rollupContext }: { shopId: string | null | undefined; rollupContext?: HierarchyRollupScope }) {
  const pulseTotals = usePulseTotalsSuspense(shopId);
  const dailyTotals = pulseTotals?.daily ?? EMPTY_TOTALS;
  const weeklyTotals = pulseTotals?.weekly ?? EMPTY_TOTALS;
  const { district, region, division } = useHierarchyRollupsSuspense(rollupContext);

  const mixItems = useMemo(() => {
    return mixLabels.map(({ key, label }) => (
      <div key={key} className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-3">
        <p className="text-[10px] uppercase text-slate-500">{label}</p>
        <p className="text-lg font-semibold text-emerald-200">
          {mixPercent(weeklyTotals[key] ?? 0, weeklyTotals.cars)}
        </p>
      </div>
    ));
  }, [weeklyTotals]);
  const hierarchyComparisons = useMemo(() => {
    const entries: RollupSummary[] = [];
    if (district) entries.push(district);
    if (region) entries.push(region);
    if (division) entries.push(division);
    return entries;
  }, [district, region, division]);

  if (!shopId) {
    return <SectionStatus tone="error" message="Link a shop to view KPIs." />;
  }

  if (!pulseTotals) {
    return <SectionStatus message="No Pulse Check totals yet today." />;
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricStat label="Cars today" value={integerFormatter.format(dailyTotals.cars)} />
        <MetricStat label="Sales today" value={currencyFormatter.format(dailyTotals.sales)} />
        <MetricStat
          label="ARO"
          value={
            dailyTotals.cars
              ? currencyFormatter.format(Math.round(dailyTotals.sales / Math.max(dailyTotals.cars, 1)))
              : "--"
          }
        />
        <MetricStat label="Donations" value={currencyFormatter.format(weeklyTotals.donations)} sublabel="Week to date" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{mixItems}</div>
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-200">Hierarchy comparisons</p>
        <div className="mt-3 space-y-3">
          {hierarchyComparisons.length === 0 ? (
            <SectionStatus message="Link your district or region to compare performance." />
          ) : (
            hierarchyComparisons.map((entry) => (
              <div key={entry.scope} className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-400/10 bg-slate-950/40 px-3 py-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">{entry.scope.toLowerCase()}</p>
                  <p className="text-sm font-semibold text-white">{entry.label}</p>
                </div>
                <div className="text-right text-xs text-slate-300">
                  <p className="text-base font-semibold text-emerald-100">{integerFormatter.format(entry.daily.cars)} cars</p>
                  <p>WTD ARO {entry.weekly.aro ? currencyFormatter.format(Math.round(entry.weekly.aro)) : "--"}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function PulseOverviewSection({ shopId, rollupContext }: { shopId: string | null | undefined; rollupContext?: HierarchyRollupScope }) {
  return (
    <SectionErrorBoundary
      fallback={
        <PulseOverviewShell>
          <SectionStatus tone="error" message="Unable to load shop KPIs right now." />
        </PulseOverviewShell>
      }
    >
      <Suspense
        fallback={
          <PulseOverviewShell>
            <SectionStatus message="Refreshing shop KPIs�" />
          </PulseOverviewShell>
        }
      >
        <PulseOverviewShell>
          <PulseOverviewContent shopId={shopId} rollupContext={rollupContext} />
        </PulseOverviewShell>
      </Suspense>
    </SectionErrorBoundary>
  );
}

function AlertsBroadcastCard({ shopNumber }: { shopNumber: number | string | null | undefined }) {
  const snapshot = useSnapshotSuspense(shopNumber) ?? EMPTY_SNAPSHOT;
  const hasAlerts = snapshot.alerts.length > 0;

  return (
    <SectionCard
      title="Alerts & Broadcasts"
      eyebrow="Live policy feed"
      accent="amber"
      actionHref="/pocket-manager5/features/alerts"
      actionLabel="Open alerts"
      quickLinks={["alerts", "solinks", "claims"]}
    >
      {hasAlerts ? (
        <ul className="space-y-3 text-sm text-amber-100">
          {snapshot.alerts.map((alert) => (
            <li
              key={alert}
              className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-amber-50"
            >
              {alert}
            </li>
          ))}
        </ul>
      ) : (
        <SectionStatus message="All clear—no broadcast alerts pending." />
      )}
    </SectionCard>
  );
}

function VisitsCoachingSection({ shopNumber }: { shopNumber: number | string | null | undefined }) {
  const snapshot = useSnapshotSuspense(shopNumber) ?? EMPTY_SNAPSHOT;
  return (
    <SectionCard
      title="Visits & Coaching"
      eyebrow="DM tools"
      accent="azure"
      actionHref="/pocket-manager5/features/dm-schedule"
      actionLabel="Open DM schedule"
      quickLinks={["dm-schedule", "dm-logbook", "employee-management", "cadence"]}
      formSlugs={DM_FORM_SLUGS}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4">
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Upcoming schedule</p>
          <ul className="mt-3 space-y-3 text-sm text-slate-200">
            {snapshot.visits.upcoming.length === 0 && <li>No visits scheduled for this shop.</li>}
            {snapshot.visits.upcoming.map((visit) => (
              <li key={visit.id} className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-3">
                <p className="text-xs text-slate-400">{formatDate(visit.date)}</p>
                <p className="text-base font-semibold text-white">{visit.visitType ?? "Shop visit"}</p>
                <p className="text-xs text-slate-400">{visit.location ?? "District"}</p>
                {visit.notes && <p className="mt-1 text-xs text-slate-500">{visit.notes}</p>}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4">
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Recent DM logs</p>
          <ul className="mt-3 space-y-3 text-sm text-slate-200">
            {snapshot.visits.recent.length === 0 && <li>No DM visit entries yet.</li>}
            {snapshot.visits.recent.map((log) => (
              <li key={log.id} className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{formatDate(log.date)}</span>
                  {log.score !== null && <span className="text-emerald-300">{Math.round(log.score)}%</span>}
                </div>
                <p className="mt-1 text-base font-semibold text-white">{log.type.replace(/_/g, " ")}</p>
                {log.submittedBy && <p className="text-xs text-slate-500">By {log.submittedBy}</p>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SectionCard>
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
  alerts: () => (
    <SectionCard
      title="Alerts & Broadcasts"
      eyebrow="Live policy feed"
      accent="amber"
      actionHref="/pocket-manager5/features/alerts"
      actionLabel="Open alerts"
      quickLinks={["alerts", "solinks", "claims"]}
    >
      <SectionStatus message="Checking alerts…" />
    </SectionCard>
  ),
  visits: () => (
    <SectionCard
      title="Visits & Coaching"
      eyebrow="DM tools"
      accent="azure"
      actionHref="/pocket-manager5/features/dm-schedule"
      actionLabel="Open DM schedule"
      quickLinks={["dm-schedule", "dm-logbook", "employee-management", "cadence"]}
    >
      <SectionStatus message="Loading visit schedules…" />
    </SectionCard>
  ),
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
  alerts: () => (
    <SectionCard
      title="Alerts & Broadcasts"
      eyebrow="Live policy feed"
      accent="amber"
      actionHref="/pocket-manager5/features/alerts"
      actionLabel="Open alerts"
      quickLinks={["alerts", "solinks", "claims"]}
    >
      <SectionStatus tone="error" message="Alerts unavailable." />
    </SectionCard>
  ),
  visits: () => (
    <SectionCard
      title="Visits & Coaching"
      eyebrow="DM tools"
      accent="azure"
      actionHref="/pocket-manager5/features/dm-schedule"
      actionLabel="Open DM schedule"
      quickLinks={["dm-schedule", "dm-logbook", "employee-management", "cadence"]}
    >
      <SectionStatus tone="error" message="DM visit tools unavailable." />
    </SectionCard>
  ),
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
  alerts: () => (
    <SectionCard
      title="Alerts & Broadcasts"
      eyebrow="Live policy feed"
      accent="amber"
      actionHref="/pocket-manager5/features/alerts"
      actionLabel="Open alerts"
      quickLinks={["alerts", "solinks", "claims"]}
    >
      <SectionStatus tone="error" message="Link a shop to unlock alert history." />
    </SectionCard>
  ),
  visits: () => (
    <SectionCard
      title="Visits & Coaching"
      eyebrow="DM tools"
      accent="azure"
      actionHref="/pocket-manager5/features/dm-schedule"
      actionLabel="Open DM schedule"
      quickLinks={["dm-schedule", "dm-logbook", "employee-management", "cadence"]}
    >
      <SectionStatus tone="error" message="Link a shop to preview visit plans." />
    </SectionCard>
  ),
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
  alerts: AlertsBroadcastCard,
  visits: VisitsCoachingSection,
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
    storedShopName,
    hierarchy,
    hierarchyLoading,
    hierarchyError,
    shopMeta,
    divisionId,
  } = usePocketHierarchy();
  const heroName = storedShopName ?? (hierarchy?.shop_number ? `Shop ${hierarchy.shop_number}` : "Pocket Manager5");
  const hierarchyRollupScope = useMemo<HierarchyRollupScope | undefined>(() => {
    if (!shopMeta?.district_id && !shopMeta?.region_id && !divisionId) {
      return undefined;
    }

    return {
      districtId: shopMeta?.district_id ?? null,
      regionId: shopMeta?.region_id ?? null,
      divisionId: divisionId ?? null,
      districtLabel: hierarchy?.district_name ?? null,
      regionLabel: hierarchy?.region_name ?? null,
      divisionLabel: hierarchy?.division_name ?? null,
    };
  }, [shopMeta?.district_id, shopMeta?.region_id, divisionId, hierarchy?.district_name, hierarchy?.region_name, hierarchy?.division_name]);

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
            <PulseOverviewSection shopId={shopMeta?.id} rollupContext={hierarchyRollupScope} />
            <OpsHubSection shopId={shopMeta?.id} />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <SnapshotCardRenderer type="labor" shopNumber={shopMeta?.shop_number} />
          <SnapshotCardRenderer type="training" shopNumber={shopMeta?.shop_number} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <SnapshotCardRenderer type="admin" shopNumber={shopMeta?.shop_number} />
          <SnapshotCardRenderer type="inventory" shopNumber={shopMeta?.shop_number} />
        </div>
        <DailyLogCard />
        <div className="grid gap-6 lg:grid-cols-2">
          <DmToolsRail />
          <DmScheduleShowcase />
        </div>
        <SnapshotCardRenderer type="visits" shopNumber={shopMeta?.shop_number} />
        <SnapshotCardRenderer type="alerts" shopNumber={shopMeta?.shop_number} />
        <AiAssistantCard />
      </div>
    </main>
  );
}

