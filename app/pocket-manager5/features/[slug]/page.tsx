import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { fetchDmSchedulePreview, fetchEmployeeSchedulingPreview, fetchPeopleFeaturePreview, type EmployeeSchedulingPreview, type PeopleFeaturePreview } from "@/lib/peopleFeatureData";
import { DmSchedulePlanner, DmVisitMixRunningSummary } from "../../components/DmSchedulePlanner";
import {
  DM_RUNNING_PERIOD_WINDOW,
  buildRetailPeriodSequence,
  getRetailPeriodInfo,
  shortDateFormatter,
  type SampleScheduleEntry,
  type ScheduleLocationId,
} from "../../components/dmScheduleUtils";
import { MiniPosWorkspace } from "../components/MiniPosWorkspace";
import { FEATURE_LOOKUP, FEATURE_REGISTRY, getDocUrl, type FeatureMeta, type FeatureSlug } from "../../featureRegistry";
import { FORM_REGISTRY, type FormConfig } from "../../forms/formRegistry";
import { getServerSession, type ServerSession } from "@/lib/auth/session";
import { resolvePermittedShopNumber, normalizeShopIdentifier } from "@/lib/auth/alignment";

interface FeaturePageProps {
  params: Promise<{ slug: FeatureSlug }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const NATIVE_CODE_BASE = "https://github.com/kwo744-075/pocket-manager-app/blob/main";

const PEOPLE_FULL_PAGE_SLUGS = new Set<FeatureSlug>(["employee-management"]);
const PEOPLE_INLINE_SLUGS = new Set<FeatureSlug>([
  "employee-training",
  "employee-meetings",
  "coaching-log",
  "staff-management",
  "termed-list",
  "employee-development",
]);
const PEOPLE_PREVIEW_SLUGS = new Set<FeatureSlug>([...PEOPLE_FULL_PAGE_SLUGS, ...PEOPLE_INLINE_SLUGS]);

const getFirstParamValue = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
};

const resolveShopParam = (search?: Record<string, string | string[] | undefined>) => {
  if (!search) return null;
  for (const key of ["shop", "shopId"]) {
    const value = getFirstParamValue(search[key]);
    if (value) {
      return value;
    }
  }
  return null;
};

const appendShopQuery = (href: string, shopNumber: string | null | undefined) => {
  if (!href) return href;
  if (!shopNumber) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}shop=${encodeURIComponent(shopNumber)}`;
};

export function generateStaticParams() {
  return FEATURE_REGISTRY.map(({ slug }) => ({ slug }));
}

export default async function FeatureDetailPage({ params, searchParams }: FeaturePageProps) {
  const { slug } = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const session = await getServerSession();
  const shopNumber = resolvePermittedShopNumber(session.alignment, resolveShopParam(resolvedSearch));
  const feature = FEATURE_LOOKUP[slug];

  if (!feature) {
    notFound();
  }

  const docUrl = getDocUrl(feature);
  const relatedForms = FORM_REGISTRY.filter((item) => item.feature === feature.slug);
  const shouldPrefetchPeoplePreview = PEOPLE_PREVIEW_SLUGS.has(feature.slug);
  const peoplePreview = shouldPrefetchPeoplePreview ? await fetchPeopleFeaturePreview(shopNumber) : null;

  if (feature.slug === "dm-schedule") {
    // dmPreview intentionally fetched for potential future use, but not required by the page component.
    const plannerPrefill = await loadDmSchedulePlannerPrefill(session, shopNumber ?? null);
    await fetchDmSchedulePreview(shopNumber);
    return <DmScheduleFeaturePage feature={feature} docUrl={docUrl} shopNumber={shopNumber} plannerPrefill={plannerPrefill} />;
  }

  if (feature.slug === "mini-pos") {
    return <MiniPosFeaturePage feature={feature} docUrl={docUrl} />;
  }

  if (feature.slug === "employee-management") {
    return (
      <EmployeeManagementFeaturePage
        feature={feature}
        docUrl={docUrl}
        relatedForms={relatedForms}
        shopNumber={shopNumber}
        preview={peoplePreview ?? (await fetchPeopleFeaturePreview(shopNumber))}
      />
    );
  }

  if (feature.slug === "employee-scheduling") {
    const schedulingPreview = await fetchEmployeeSchedulingPreview(shopNumber);
    return (
      <EmployeeSchedulingFeaturePage
        feature={feature}
        docUrl={docUrl}
        relatedForms={relatedForms}
        shopNumber={shopNumber}
        preview={schedulingPreview}
      />
    );
  }

  const inlinePeoplePreview = PEOPLE_INLINE_SLUGS.has(feature.slug) ? peoplePreview ?? (await fetchPeopleFeaturePreview(shopNumber)) : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <Link
          href="/pocket-manager5"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 transition hover:text-emerald-100"
        >
          <span aria-hidden>↩</span> Back to Pocket Manager5
        </Link>

        <section className="mt-6 rounded-3xl border border-slate-800/80 bg-slate-900/70 p-8 shadow-2xl shadow-black/30">
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Pocket Manager feature</p>
          <div className="mt-2 flex flex-wrap items-start gap-3">
            <h1 className="text-4xl font-semibold text-white">{feature.title}</h1>
            <span className="rounded-full border border-slate-800/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
              {feature.status}
            </span>
          </div>
          <p className="mt-4 text-lg text-slate-300">{feature.summary}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            {feature.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-slate-800/60 px-3 py-1 text-xs text-slate-300">
                {tag}
              </span>
            ))}
          </div>

          <dl className="mt-10 grid gap-6 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Native route</dt>
              <dd className="mt-2 font-mono text-sm text-emerald-200">{feature.platformRoute}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Forms & Flows</dt>
              <dd className="mt-2 flex flex-wrap gap-2 text-sm text-slate-200">
                {relatedForms.length > 0
                  ? relatedForms.map((form) => {
                      const formHref = appendShopQuery(`/pocket-manager5/forms/${form.slug}`, shopNumber);
                      return (
                        <Link
                          key={form.slug}
                          href={formHref}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-800/70 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400/60"
                        >
                          {form.title} ↗
                        </Link>
                      );
                    })
                  : feature.forms?.length
                  ? feature.forms.map((formName) => <p key={formName}>{formName}</p>)
                  : <p className="text-slate-400">Documented in mobile app only.</p>}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Key hooks / data</dt>
              <dd className="mt-2 space-y-1 font-mono text-[13px] text-slate-200">
                {feature.keyHooks?.map((hook) => (
                  <p key={hook}>{hook}</p>
                )) || <p>Surface data via Pocket Manager service.</p>}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Documentation</dt>
              <dd className="mt-2 text-sm">
                {docUrl ? (
                  <Link
                    href={docUrl}
                    className="text-emerald-200 underline-offset-4 transition hover:text-emerald-100 hover:underline"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    View spec ↗
                  </Link>
                ) : (
                  <span className="text-slate-400">See mobile implementation notes.</span>
                )}
              </dd>
            </div>
          </dl>
        </section>
        {inlinePeoplePreview && (
          <PeopleFeatureInlinePreview slug={feature.slug} preview={inlinePeoplePreview} shopNumber={shopNumber} />
        )}
      </div>
    </main>
  );
}

type DmScheduleFeaturePageProps = {
  feature: FeatureMeta;
  docUrl?: string;
  shopNumber: string | null;
  plannerPrefill: PlannerPrefill | null;
};

type DmScheduleRow = {
  id: string | null;
  date: string | null;
  visit_type: string | null;
  location_id: string | null;
  location_text: string | null;
  notes: string | null;
};

type PlannerPrefill = {
  scheduleEntries: SampleScheduleEntry[];
  historicalEntries: SampleScheduleEntry[];
};

const mapScheduleRowToEntry = (row: DmScheduleRow): SampleScheduleEntry | null => {
  if (!row.date || !row.visit_type) {
    return null;
  }
  const date = new Date(row.date);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const iso = row.date.split("T")[0] ?? row.date;
  const resolvedShopId = (row.location_id?.trim() || row.location_text?.trim() || "home") as ScheduleLocationId;
  const locationLabel = row.location_text ?? (row.location_id ? `Shop ${row.location_id}` : "Home Office");
  const status = date.getTime() < Date.now() ? "complete" : "locked";
  return {
    date,
    iso,
    visitType: row.visit_type,
    shopId: resolvedShopId,
    focus: row.notes ?? "",
    status,
    locationLabel,
  };
};

async function loadDmSchedulePlannerPrefill(
  session: ServerSession,
  shopNumber: string | null,
  anchorDate: Date = new Date(),
): Promise<PlannerPrefill | null> {
  try {
    const { supabase: supabaseClient, user, alignment } = session;

    if (!user) {
      return null;
    }

    const normalizedShopFilter = normalizeShopIdentifier(shopNumber);
    const allowedShopKeys = new Set(
      (alignment?.shops ?? [])
        .map((shopId) => normalizeShopIdentifier(shopId))
        .filter((value): value is string => Boolean(value)),
    );

    const trailingPeriods = buildRetailPeriodSequence(anchorDate, DM_RUNNING_PERIOD_WINDOW);
    const windowStart = (trailingPeriods[0] ?? getRetailPeriodInfo(anchorDate)).startDate;
    const windowEnd = (trailingPeriods.at(-1) ?? getRetailPeriodInfo(anchorDate)).endDate;

    const startIso = windowStart.toISOString().split("T")[0];
    const endIso = windowEnd.toISOString().split("T")[0];

    const filters = [
      user.id ? { column: "dm_id", value: user.id } : null,
      user.email ? { column: "created_by", value: user.email.toLowerCase() } : null,
    ].filter(Boolean) as Array<{ column: string; value: string }>;

    if (!filters.length) {
      return null;
    }

    const selectColumns = "id,date,visit_type,location_id,location_text,notes";
    const queries = filters.map(({ column, value }) => {
      let query = supabaseClient
        .from("dm_schedule")
        .select(selectColumns)
        .eq(column, value)
        .gte("date", startIso)
        .lte("date", endIso)
        .order("date", { ascending: true });

      if (normalizedShopFilter) {
        query = query.eq("location_id", normalizedShopFilter);
      }

      return query;
    });

    const results = await Promise.all(queries);

    const rows = new Map<string, DmScheduleRow>();
    for (const result of results) {
      if (result.error) {
        console.warn("[DmSchedule] Unable to load visit submissions", result.error);
        continue;
      }
      (result.data ?? []).forEach((row) => {
        const normalizedLocation = normalizeShopIdentifier(row.location_id ?? row.location_text ?? null);
        if (allowedShopKeys.size && (!normalizedLocation || !allowedShopKeys.has(normalizedLocation))) {
          return;
        }

        const key = row.id ?? `${row.date ?? ""}:${row.location_id ?? ""}:${row.visit_type ?? ""}`;
        if (!rows.has(key)) {
          rows.set(key, row);
        }
      });
    }

    if (!rows.size) {
      return null;
    }

    const historicalEntries = Array.from(rows.values())
      .map(mapScheduleRowToEntry)
      .filter((entry): entry is SampleScheduleEntry => Boolean(entry))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (!historicalEntries.length) {
      return null;
    }

    const activePeriod = getRetailPeriodInfo(anchorDate);
    const scheduleEntries = historicalEntries.filter((entry) => {
      const ts = entry.date.getTime();
      return ts >= activePeriod.startDate.getTime() && ts <= activePeriod.endDate.getTime();
    });

    return { scheduleEntries, historicalEntries };
  } catch (error) {
    console.warn("[DmSchedule] Planner data fetch failed", error);
    return null;
  }
}

async function DmScheduleFeaturePage({ feature, docUrl, shopNumber, plannerPrefill }: DmScheduleFeaturePageProps) {
  const liveWorkspaceHref = appendShopQuery("/pocket-manager5/features/dm-schedule", shopNumber);
  const sharedPlannerInputs = plannerPrefill
    ? {
        scheduleEntries: plannerPrefill.scheduleEntries,
        historicalEntries: plannerPrefill.historicalEntries,
      }
    : undefined;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <Link
          href="/pocket-manager5"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 transition hover:text-emerald-100"
        >
          <span aria-hidden>↩</span> Back to Pocket Manager5
        </Link>

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">District schedule</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-semibold text-white">{feature.title}</h1>
              <span className="rounded-full border border-slate-800/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
                {feature.status}
              </span>
            </div>
          </div>
          <div className="w-full min-w-[280px] flex-1 sm:max-w-md">
            <DmVisitMixRunningSummary {...(sharedPlannerInputs ?? {})} />
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Full-Year Template</p>
              <p className="mt-1 text-2xl font-semibold text-white">DM Period Schedule</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={liveWorkspaceHref}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/50 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300"
              >
                Open DM workspace ↗
              </Link>
            </div>
          </div>
          <div className="mt-6 space-y-6">
            <DmSchedulePlanner shopNumber={shopNumber} {...(sharedPlannerInputs ?? {})} />
          </div>
        </section>

      </div>
    </main>
  );
}

type MiniPosFeaturePageProps = {
  feature: FeatureMeta;
  docUrl?: string;
};

function MiniPosFeaturePage({ feature, docUrl }: MiniPosFeaturePageProps) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-12 space-y-8">
        <Link
          href="/pocket-manager5"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 transition hover:text-emerald-100"
        >
          <span aria-hidden>↩</span> Back to Pocket Manager5
        </Link>

        <section className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-8 shadow-2xl shadow-black/30">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Checkout lane</p>
              <h1 className="text-4xl font-semibold text-white">{feature.title}</h1>
              <p className="mt-3 text-lg text-slate-300">{feature.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {feature.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-slate-800/60 px-3 py-1 text-xs text-slate-300">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <span className="rounded-full border border-slate-800/60 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
              {feature.status}
            </span>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Native route</p>
              <p className="mt-2 font-mono text-sm text-emerald-200">{feature.platformRoute}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Documentation</p>
              {docUrl ? (
                <Link
                  href={docUrl}
                  className="mt-2 inline-flex items-center gap-2 text-sm text-emerald-200 underline-offset-4 hover:text-emerald-100 hover:underline"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  View spec ↗
                </Link>
              ) : (
                <p className="mt-2 text-sm text-slate-400">Parity with native Mini POS implementation.</p>
              )}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Forms & exports</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
                {feature.forms?.map((form) => (
                  <span key={form} className="rounded-full border border-slate-800/60 px-3 py-1">
                    {form}
                  </span>
                )) || <span className="text-slate-500">Documented in workspace.</span>}
              </div>
            </div>
          </div>
        </section>

        <MiniPosWorkspace />
      </div>
    </main>
  );
}

type EmployeeManagementFeaturePageProps = {
  feature: FeatureMeta;
  docUrl?: string;
  relatedForms: FormConfig[];
  shopNumber: string | null;
  preview: PeopleFeaturePreview;
};

const EMPLOYEE_SHORTCUTS = [
  {
    slug: "scheduling",
    title: "Scheduling",
    description: "Weekly templates with overtime guardrails and coverage alerts",
    route: "/(tabs)/(home)/employee-scheduling",
    accent: "from-indigo-500/15 via-indigo-500/5 to-transparent border-indigo-400/40",
  },
  {
    slug: "training-development",
    title: "Training & Development",
    description: "CTT completions, certifications, and 30-60-90 plans",
    route: "/(tabs)/(home)/employee-training",
    accent: "from-amber-500/15 via-amber-500/5 to-transparent border-amber-400/40",
  },
  {
    slug: "meetings",
    title: "Employee Meetings",
    description: "Agenda builder with attendance tracking and recap notes",
    route: "/(tabs)/(home)/employee-meetings-home",
    accent: "from-rose-500/15 via-rose-500/5 to-transparent border-rose-400/40",
  },
  {
    slug: "coaching",
    title: "Coaching Log",
    description: "Document 1:1s, calibrations, and follow-up assignments",
    route: "/(tabs)/(home)/coaching-log-home",
    accent: "from-fuchsia-500/15 via-fuchsia-500/5 to-transparent border-fuchsia-400/40",
  },
  {
    slug: "staff",
    title: "Staff Management",
    description: "Active roster with tenure math and phone sheet exports",
    route: "/(tabs)/(home)/staff-management",
    accent: "from-cyan-500/15 via-cyan-500/5 to-transparent border-cyan-400/40",
  },
  {
    slug: "termed",
    title: "Termed List",
    description: "Separate workflow for former teammates and rehire notes",
    route: "/(tabs)/(home)/termed-list",
    accent: "from-slate-500/15 via-slate-500/5 to-transparent border-slate-400/40",
  },
] as const;

const TRAINING_TRACKS = [
  {
    name: "New hire onboarding",
    progress: 100,
    caption: "Complete",
    tone: "emerald",
  },
  {
    name: "Service certification ladder",
    progress: 72,
    caption: "2 modules due Jul 12",
    tone: "cyan",
  },
  {
    name: "Leadership path",
    progress: 45,
    caption: "Coach review scheduled Aug 1",
    tone: "amber",
  },
];

function buildNativeCodeLink(route: string) {
  const normalized = route.replace(/^\//, "");
  return `${NATIVE_CODE_BASE}/app/${normalized}.tsx`;
}

const friendlyDateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

const formatDateLabel = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return friendlyDateFormatter.format(date);
};

const formatTenureLabel = (months?: number | null) => {
  if (months == null) return "--";
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  if (years > 0 && remainder > 0) {
    return `${years}y ${remainder}m`;
  }
  if (years > 0) {
    return `${years}y`;
  }
  return `${remainder}m`;
};

function LiveStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-3 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function EmployeeManagementFeaturePage({ feature, docUrl, relatedForms, shopNumber, preview }: EmployeeManagementFeaturePageProps) {
  const roster = preview.roster.slice(0, 6);
  const meetings = preview.meetings.slice(0, 3);
  const coachingLogs = preview.coaching.recent.slice(0, 3);
  const termed = preview.termed.slice(0, 3);
  const avgTenureMonths = roster.length
    ? Math.round(
        roster.reduce((sum, teammate) => sum + (teammate.tenureMonths ?? 0), 0) / roster.length
      )
    : null;
  const highlight = roster[0];
  const liveDataReady = Boolean(shopNumber) && preview.hasData;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
        <Link
          href="/pocket-manager5"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 transition hover:text-emerald-100"
        >
          <span aria-hidden>↩</span> Back to Pocket Manager5
        </Link>

        <section className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-8 shadow-2xl shadow-black/30">
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">People systems</p>
          <div className="mt-2 flex flex-wrap items-start gap-3">
            <h1 className="text-4xl font-semibold text-white">{feature.title}</h1>
            <span className="rounded-full border border-slate-800/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
              {feature.status}
            </span>
          </div>
          <p className="mt-4 text-lg text-slate-300">{feature.summary}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Native route</p>
              <p className="mt-2 font-mono text-sm text-emerald-200">{feature.platformRoute}</p>
            </div>
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Documentation</p>
              {docUrl ? (
                <Link
                  href={docUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-200 underline-offset-4 transition hover:text-emerald-100 hover:underline"
                >
                  View spec ↗
                </Link>
              ) : (
                <p className="mt-2 text-sm text-slate-400">Refer to the mobile implementation notes.</p>
              )}
            </div>
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Forms & flows</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {relatedForms.length > 0 ? (
                  relatedForms.map((form) => {
                    const formHref = appendShopQuery(`/pocket-manager5/forms/${form.slug}`, shopNumber);
                    return (
                      <Link
                        key={form.slug}
                        href={formHref}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-800/70 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400/60"
                      >
                        {form.title} ↗
                      </Link>
                    );
                  })
                ) : (
                  <span className="text-sm text-slate-400">Documented in mobile view.</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {feature.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-slate-800/60 px-3 py-1 text-xs text-slate-300">
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Live Supabase data</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">People snapshot for shop {shopNumber ?? "(select a shop)"}</h2>
              <p className="mt-2 text-sm text-slate-300">
                Pulls straight from <code className="font-mono text-xs text-emerald-200">shop_staff</code>, <code className="font-mono text-xs text-emerald-200">employee_training</code>, <code className="font-mono text-xs text-emerald-200">employee_meetings</code>, <code className="font-mono text-xs text-emerald-200">coaching_logs</code>, and <code className="font-mono text-xs text-emerald-200">termed_employees</code> so the web view mirrors the Expo app.
              </p>
            </div>
            {!shopNumber && <span className="text-sm font-semibold text-amber-300">Choose a shop from Pocket Manager to hydrate this section.</span>}
            {shopNumber && !preview.hasData && <span className="text-sm font-semibold text-slate-400">No records yet — add roster & meetings from mobile to populate.</span>}
          </div>
          {liveDataReady ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Active roster ({preview.roster.length})</p>
                  {roster.length ? (
                    <div className="mt-3 divide-y divide-slate-800/60">
                      {roster.map((teammate) => (
                        <div key={teammate.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                          <div>
                            <p className="font-semibold text-white">{teammate.name}</p>
                            <p className="text-slate-400">{teammate.role ?? "Role pending"}</p>
                          </div>
                          <div className="text-right text-xs text-slate-400">
                            <p>{teammate.status ?? "Active"}</p>
                            <p>{formatTenureLabel(teammate.tenureMonths)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">Roster empty. Add staff in the mobile app to see them here.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Training pipeline</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <LiveStat label="Completed" value={preview.training.completed} />
                    <LiveStat label="In progress" value={preview.training.inProgress} />
                    <LiveStat label="Not started" value={preview.training.notStarted} />
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: `${preview.training.completionPct}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{preview.training.completionPct}% of tracked CTT items completed.</p>
                  {preview.training.inProgressList.length > 0 && (
                    <ul className="mt-3 space-y-2 text-sm text-slate-300">
                      {preview.training.inProgressList.map((item) => (
                        <li key={item.id} className="rounded-xl border border-slate-800/60 px-3 py-2">
                          <p className="font-semibold text-white">{item.name}</p>
                          <p className="text-xs text-slate-400">{item.status ?? "in_progress"} · Updated {formatDateLabel(item.updatedAt)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Meetings</p>
                  {meetings.length ? (
                    <ul className="mt-3 space-y-2">
                      {meetings.map((meeting) => (
                        <li key={meeting.id} className="rounded-xl border border-slate-800/60 px-3 py-2 text-sm">
                          <p className="font-semibold text-white">{meeting.meetingType ?? "Meeting"}</p>
                          <p className="text-slate-400">{formatDateLabel(meeting.meetingDate)} · {meeting.meetingTime ?? "--"}</p>
                          <p className="text-xs text-slate-500">{meeting.attendeesCount} attendees</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">No meetings logged yet.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Coaching log (last 30 days)</p>
                  {coachingLogs.length ? (
                    <ul className="mt-3 space-y-2 text-sm">
                      {coachingLogs.map((log) => (
                        <li key={log.id} className="rounded-xl border border-slate-800/60 px-3 py-2">
                          <p className="font-semibold text-white">{log.staffName ?? "Unnamed"}</p>
                          <p className="text-xs text-slate-400">{formatDateLabel(log.coachedAt)} · {log.reason ?? "Coaching"}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">No 1:1s captured in the last month.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Termed teammates</p>
                  {termed.length ? (
                    <ul className="mt-3 space-y-2 text-sm">
                      {termed.map((entry) => (
                        <li key={entry.id} className="rounded-xl border border-slate-800/60 px-3 py-2">
                          <p className="font-semibold text-white">{entry.name ?? "Unnamed"}</p>
                          <p className="text-xs text-slate-400">{formatDateLabel(entry.termedAt)} · {entry.reason ?? "N/A"}</p>
                          <p className="text-xs text-slate-500">Rehire: {entry.rehireStatus ?? "unknown"}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">No termed teammates recorded.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm text-slate-400">Connect a shop and seed at least one teammate in the mobile experience to preview live roster data on the web.</p>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Employee profile snapshot</p>
            <div className="mt-4 rounded-2xl border border-slate-800/60 bg-slate-900/50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-2xl font-semibold text-white">{highlight?.name ?? "Sample teammate"}</p>
                  <p className="text-sm text-slate-400">{highlight?.role ?? "Role pending"}</p>
                </div>
                <span className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs font-semibold text-emerald-200">
                  {highlight?.status ?? "Active"}
                </span>
              </div>
              <dl className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Tenure</dt>
                  <dd className="font-semibold text-white">{formatTenureLabel(highlight?.tenureMonths)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Hire date</dt>
                  <dd className="font-semibold text-white">{formatDateLabel(highlight?.hiredAt)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Phone</dt>
                  <dd className="font-mono text-[13px] text-emerald-200">Synced from mobile</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Email</dt>
                  <dd className="font-mono text-[13px] text-emerald-200">Synced from mobile</dd>
                </div>
              </dl>
              <div className="mt-4 rounded-2xl border border-slate-800/60 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Development focus</p>
                <p className="mt-1 text-sm text-slate-300">
                  {preview.development.active} active plans · {preview.development.completed} completed · {preview.development.onHold} on hold
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Team pulse</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                <p className="text-xs text-slate-500">Active staff</p>
                <p className="text-2xl font-semibold text-white">{preview.roster.length}</p>
                <p className="text-sm text-slate-400">Average tenure {formatTenureLabel(avgTenureMonths)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                <p className="text-xs text-slate-500">Training in progress</p>
                <p className="text-2xl font-semibold text-white">{preview.training.inProgress}</p>
                <p className="text-sm text-slate-400">{preview.training.completed} completed</p>
              </div>
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                <p className="text-xs text-slate-500">Development plans</p>
                <p className="text-2xl font-semibold text-white">{preview.development.active}</p>
                <p className="text-sm text-slate-400">{preview.development.completed} completed · {preview.development.onHold} on hold</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <p className="font-semibold">Internal use only</p>
              <p className="text-amber-200/90">People data stays on-device. No payroll exports are triggered from this workspace.</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Training & development</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Pipeline view</h2>
              <p className="mt-2 text-sm text-slate-300">
                Mirrors the employee training detail route with the same progress math, AsyncStorage-backed drafts, and Supabase sync.
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {TRAINING_TRACKS.map((track) => (
              <div key={track.name} className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300">
                  <p className="font-semibold text-white">{track.name}</p>
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{track.caption}</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${track.tone === "emerald" ? "bg-emerald-400" : track.tone === "cyan" ? "bg-cyan-400" : "bg-amber-400"}`}
                    style={{ width: `${track.progress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">{track.progress}% complete</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Workspace shortcuts</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Matches the native banner stack</h2>
              <p className="mt-2 text-sm text-slate-300">Each tile links back to the Expo route so product teams can inspect the live implementation.</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {EMPLOYEE_SHORTCUTS.map((shortcut) => (
              <Link
                key={shortcut.slug}
                href={buildNativeCodeLink(shortcut.route)}
                target="_blank"
                rel="noreferrer noopener"
                className={`rounded-2xl border ${shortcut.accent} bg-gradient-to-br p-4 transition hover:border-emerald-400/60`}
              >
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{shortcut.route}</p>
                <p className="mt-2 text-xl font-semibold text-white">{shortcut.title}</p>
                <p className="mt-2 text-sm text-slate-300">{shortcut.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function PeopleFeatureInlinePreview({ slug, preview, shopNumber }: { slug: FeatureSlug; preview: PeopleFeaturePreview; shopNumber: string | null }) {
  const baseClass = "mt-10 rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6";
  const titleLookup: Record<string, { title: string; subtitle: string }> = {
    "employee-training": { title: "Training tracker", subtitle: "CTT completion + in-progress list" },
    "employee-meetings": { title: "Meeting queue", subtitle: "Agenda + attendance pulled from Supabase" },
    "coaching-log": { title: "Coaching log", subtitle: "30-day histogram + recent sessions" },
    "staff-management": { title: "Roster preview", subtitle: "Active teammates with tenure math" },
    "termed-list": { title: "Termed teammates", subtitle: "Rehire flags + exit reasons" },
    "employee-development": { title: "Development plans", subtitle: "Active vs completed coaching plans" },
  };
  const header = titleLookup[slug] ?? { title: "People data", subtitle: "Live view" };

  if (!shopNumber) {
    return (
      <section className={baseClass}>
        <p className="text-sm text-amber-300">Link a shop from the Pocket Manager workspace to preview this feature with live data.</p>
      </section>
    );
  }

  if (!preview.hasData) {
    return (
      <section className={baseClass}>
        <p className="text-sm text-slate-400">No data yet for shop {shopNumber}. Seed the flow from the Expo app to hydrate this preview.</p>
      </section>
    );
  }

  const renderTraining = () => (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Completion</p>
        <div className="mt-3 h-2 rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-emerald-400" style={{ width: `${preview.training.completionPct}%` }} />
        </div>
        <p className="mt-2 text-sm text-slate-400">{preview.training.completionPct}% complete</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <LiveStat label="Done" value={preview.training.completed} />
          <LiveStat label="In flight" value={preview.training.inProgress} />
          <LiveStat label="Queued" value={preview.training.notStarted} />
        </div>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">In-progress teammates</p>
        {preview.training.inProgressList.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {preview.training.inProgressList.map((item) => (
              <li key={item.id} className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-3">
                <p className="font-semibold text-white">{item.name}</p>
                <p className="text-xs text-slate-400">Updated {formatDateLabel(item.updatedAt)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-400">No open trainings.</p>
        )}
      </div>
    </div>
  );

  const renderMeetings = () => (
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Upcoming meetings</p>
      {preview.meetings.length ? (
        <ul className="mt-3 space-y-2 text-sm">
          {preview.meetings.slice(0, 5).map((meeting) => (
            <li key={meeting.id} className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-3">
              <p className="font-semibold text-white">{meeting.meetingType ?? "Meeting"}</p>
              <p className="text-xs text-slate-400">{formatDateLabel(meeting.meetingDate)} · {meeting.meetingTime ?? "--"}</p>
              <p className="text-xs text-slate-500">{meeting.attendeesCount} attendees</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-400">No meetings on file.</p>
      )}
    </div>
  );

  const renderCoaching = () => {
    const last30 = preview.coaching.histogram.reduce((sum, entry) => sum + entry.count, 0);
    const last7 = preview.coaching.histogram.slice(-7).reduce((sum, entry) => sum + entry.count, 0);
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Volume</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <LiveStat label="30 days" value={last30} />
            <LiveStat label="7 days" value={last7} />
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Recent sessions</p>
          {preview.coaching.recent.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {preview.coaching.recent.slice(0, 4).map((log) => (
                <li key={log.id} className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-3">
                  <p className="font-semibold text-white">{log.staffName ?? "Teammate"}</p>
                  <p className="text-xs text-slate-400">{formatDateLabel(log.coachedAt)} · {log.reason ?? "Coaching"}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-400">No coaching entries yet.</p>
          )}
        </div>
      </div>
    );
  };

  const renderRoster = (source: PeopleFeaturePreview["roster"]) => (
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Active teammates ({source.length})</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead>
            <tr className="text-xs uppercase tracking-[0.2em] text-slate-500">
              <th className="pb-2 pr-4">Name</th>
              <th className="pb-2 pr-4">Role</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2">Tenure</th>
            </tr>
          </thead>
          <tbody>
            {source.slice(0, 8).map((teammate) => (
              <tr key={teammate.id} className="border-t border-slate-900/60">
                <td className="py-2 pr-4">{teammate.name}</td>
                <td className="py-2 pr-4">{teammate.role ?? "--"}</td>
                <td className="py-2 pr-4">{teammate.status ?? "Active"}</td>
                <td className="py-2">{formatTenureLabel(teammate.tenureMonths)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderTermed = () => (
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Recent termed teammates</p>
      {preview.termed.length ? (
        <ul className="mt-3 space-y-2 text-sm">
          {preview.termed.slice(0, 6).map((entry) => (
            <li key={entry.id} className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-3">
              <p className="font-semibold text-white">{entry.name ?? "Unnamed"}</p>
              <p className="text-xs text-slate-400">{formatDateLabel(entry.termedAt)} · {entry.reason ?? "N/A"}</p>
              <p className="text-xs text-slate-500">Rehire: {entry.rehireStatus ?? "unknown"}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-400">No termed teammates recorded.</p>
      )}
    </div>
  );

  const renderDevelopment = () => (
    <div className="grid gap-4 sm:grid-cols-3">
      <LiveStat label="Active" value={preview.development.active} />
      <LiveStat label="Completed" value={preview.development.completed} />
      <LiveStat label="On hold" value={preview.development.onHold} />
    </div>
  );

  let content: ReactNode;
  switch (slug) {
    case "employee-training":
      content = renderTraining();
      break;
    case "employee-meetings":
      content = renderMeetings();
      break;
    case "coaching-log":
      content = renderCoaching();
      break;
    case "termed-list":
      content = renderTermed();
      break;
    case "employee-development":
      content = renderDevelopment();
      break;
    case "staff-management":
    default:
      content = renderRoster(preview.roster);
      break;
  }

  return (
    <section className={baseClass}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Live feature preview</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">{header.title}</h2>
          <p className="text-sm text-slate-300">{header.subtitle}</p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Shop {shopNumber}</span>
      </div>
      <div className="mt-6">{content}</div>
    </section>
  );
}

type EmployeeSchedulingFeaturePageProps = {
  feature: FeatureMeta;
  docUrl?: string;
  relatedForms: FormConfig[];
  shopNumber: string | null;
  preview: EmployeeSchedulingPreview;
};

function EmployeeSchedulingFeaturePage({ feature, docUrl, relatedForms, shopNumber, preview }: EmployeeSchedulingFeaturePageProps) {
  const weekLabel = `${shortDateFormatter.format(new Date(preview.weekStartISO))} – ${shortDateFormatter.format(new Date(preview.weekEndISO))}`;
  const deltaHours = Math.round((preview.simpleScheduler.totalHours - preview.projections.totalAllowedHours) * 10) / 10;
  const deltaTone = deltaHours > 0 ? "text-amber-300" : "text-emerald-300";
  const dailyCoverage = preview.simpleScheduler.dailyCoverage;
  const topEmployees = preview.simpleScheduler.employees;
  const legacyRows = preview.legacyScheduler.rows;
  const simpleSchedulerReady = preview.simpleScheduler.totalShifts > 0;
  const legacyReady = legacyRows.length > 0;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
        <Link
          href="/pocket-manager5"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 transition hover:text-emerald-100"
        >
          <span aria-hidden>↩</span> Back to Pocket Manager5
        </Link>

        <section className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-8 shadow-2xl shadow-black/30">
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Scheduling</p>
          <div className="mt-2 flex flex-wrap items-start gap-3">
            <h1 className="text-4xl font-semibold text-white">{feature.title}</h1>
            <span className="rounded-full border border-slate-800/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
              {feature.status}
            </span>
          </div>
          <p className="mt-4 text-lg text-slate-300">{feature.summary}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Native route</p>
              <p className="mt-2 font-mono text-sm text-emerald-200">{feature.platformRoute}</p>
            </div>
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Documentation</p>
              {docUrl ? (
                <Link
                  href={docUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-200 underline-offset-4 transition hover:text-emerald-100 hover:underline"
                >
                  View spec ↗
                </Link>
              ) : (
                <p className="mt-2 text-sm text-slate-400">Refer to the mobile implementation notes.</p>
              )}
            </div>
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Forms & flows</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {relatedForms.length > 0 ? (
                  relatedForms.map((form) => {
                    const formHref = appendShopQuery(`/pocket-manager5/forms/${form.slug}`, shopNumber);
                    return (
                      <Link
                        key={form.slug}
                        href={formHref}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-800/70 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400/60"
                      >
                        {form.title} ↗
                      </Link>
                    );
                  })
                ) : (
                  <span className="text-sm text-slate-400">Documented in mobile view.</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {feature.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-slate-800/60 px-3 py-1 text-xs text-slate-300">
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Shared scheduling model</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Week {weekLabel} · Shop {shopNumber ?? "(select a shop)"}</h2>
              <p className="mt-2 text-sm text-slate-300">
                Web + Expo now use the same <code className="font-mono text-xs text-emerald-200">employee_shifts</code> rows with projections from <code className="font-mono text-xs text-emerald-200">weekly_projections</code>. Legacy exports stay wired to <code className="font-mono text-xs text-emerald-200">employee_schedules</code> until DMs migrate fully.
              </p>
            </div>
            {!shopNumber && <span className="text-sm font-semibold text-amber-300">Select a shop to hydrate live shifts.</span>}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            <LiveStat label="Total shifts" value={preview.simpleScheduler.totalShifts} />
            <LiveStat label="Scheduled hours" value={Number(preview.simpleScheduler.totalHours.toFixed(1))} />
            <LiveStat label="Allowed hours" value={Number(preview.projections.totalAllowedHours.toFixed(1))} />
            <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-3 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Delta</p>
              <p className={`mt-1 text-2xl font-semibold ${deltaTone}`}>{deltaHours.toFixed(1)}h</p>
            </div>
          </div>
          {simpleSchedulerReady ? (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    <th className="pb-2 pr-4">Day</th>
                    <th className="pb-2 pr-4">Scheduled hrs</th>
                    <th className="pb-2 pr-4">Allowed hrs</th>
                    <th className="pb-2">Shift count</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyCoverage.map((day) => (
                    <tr key={day.date} className="border-t border-slate-900/60">
                      <td className="py-2 pr-4">{day.date}</td>
                      <td className="py-2 pr-4">{day.hours.toFixed(1)}</td>
                      <td className="py-2 pr-4">{(day.allowedHours ?? 0).toFixed(1)}</td>
                      <td className="py-2">{day.shiftCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-6 text-sm text-slate-400">No shifts scheduled for this week yet.</p>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Top teammates</p>
            {topEmployees.length ? (
              <ul className="mt-4 space-y-3">
                {topEmployees.map((employee) => (
                  <li key={employee.id} className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                    <p className="text-base font-semibold text-white">{employee.name}</p>
                    <p className="text-xs text-slate-400">{employee.role ?? "--"}</p>
                    <p className="mt-1 text-sm text-slate-300">{employee.hours.toFixed(1)}h · {employee.shifts} shifts</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-400">Add shifts to see coverage by teammate.</p>
            )}
          </div>
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Legacy schedule export</p>
            {legacyReady ? (
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                {legacyRows.map((row) => (
                  <li key={row.id} className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                    <p className="font-semibold text-white">{row.staffName}</p>
                    <p className="text-xs text-slate-400">{row.position ?? "--"}</p>
                    <p className="mt-1">{row.totalHours.toFixed(1)}h · OT {row.overtimeHours.toFixed(1)}h</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-400">
                <code className="font-mono text-xs text-slate-300">employee_schedules</code> has no rows for this week yet.
              </p>
            )}
            <p className="mt-4 text-xs text-slate-500">
              Legacy template stays wired for DM exports. When the district retires it, remove the Supabase rows to keep things tidy.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6">
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Implementation callouts</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
                <li>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Live district data</p>
              <h2 className="text-2xl font-semibold text-white">Supabase schedule + logbook</h2>
              <p className="text-sm text-slate-300">
                Pulled straight from <code className="font-mono text-xs text-emerald-200">dm_schedule</code> and <code className="font-mono text-xs text-emerald-200">dm_logbook</code> for shop {shopNumber ?? "?"}. Keep the same tables as the Expo planner so both touchpoints stay in lockstep.
              </p>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}

// FormLinkCard removed — was unused in this file.
