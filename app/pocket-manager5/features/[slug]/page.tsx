import Link from "next/link";
import { notFound } from "next/navigation";
import { DmSchedulePlanner } from "../../components/DmSchedulePlanner";
import {
  buildCoverageSummary,
  buildDueChecklist,
  buildSampleSchedule,
  getRetailPeriodInfo,
  shortDateFormatter,
} from "../../components/dmScheduleUtils";
import { FEATURE_LOOKUP, FEATURE_REGISTRY, getDocUrl, type FeatureMeta, type FeatureSlug } from "../../featureRegistry";
import { FORM_REGISTRY, type FormConfig } from "../../forms/formRegistry";

interface FeaturePageProps {
  params: Promise<{ slug: FeatureSlug }>;
}

const NATIVE_CODE_BASE = "https://github.com/kwo744-075/pocket-manager-app/blob/main";

export function generateStaticParams() {
  return FEATURE_REGISTRY.map(({ slug }) => ({ slug }));
}

export default async function FeatureDetailPage({ params }: FeaturePageProps) {
  const { slug } = await params;
  const feature = FEATURE_LOOKUP[slug];

  if (!feature) {
    notFound();
  }

  const docUrl = getDocUrl(feature);
  const relatedForms = FORM_REGISTRY.filter((item) => item.feature === feature.slug);

  if (feature.slug === "dm-schedule") {
    return <DmScheduleFeaturePage feature={feature} docUrl={docUrl} relatedForms={relatedForms} />;
  }

  if (feature.slug === "employee-management") {
    return (
      <EmployeeManagementFeaturePage feature={feature} docUrl={docUrl} relatedForms={relatedForms} />
    );
  }

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
                  ? relatedForms.map((form) => (
                      <Link
                        key={form.slug}
                        href={`/pocket-manager5/forms/${form.slug}`}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-800/70 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400/60"
                      >
                        {form.title} ↗
                      </Link>
                    ))
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
      </div>
    </main>
  );
}

type DmScheduleFeaturePageProps = {
  feature: FeatureMeta;
  docUrl?: string;
  relatedForms: FormConfig[];
};

function DmScheduleFeaturePage({ feature, docUrl, relatedForms }: DmScheduleFeaturePageProps) {
  const today = new Date();
  const periodInfo = getRetailPeriodInfo(today);
  const periodRange = `${shortDateFormatter.format(periodInfo.startDate)} – ${shortDateFormatter.format(periodInfo.endDate)}`;
  const scheduleEntries = buildSampleSchedule(periodInfo.startDate, periodInfo.weeksInPeriod);
  const dueChecklist = buildDueChecklist(scheduleEntries, periodInfo.period);
  const coverageSummary = buildCoverageSummary(scheduleEntries);
  const strongCoverage = coverageSummary.filter((shop) => shop.statusLabel === "Good coverage").length;
  const coverageCallout = `${strongCoverage}/${coverageSummary.length} shops with 2+ visits locked`;
  const nextGap = dueChecklist.find((item) => !item.met);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <Link
          href="/pocket-manager5"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 transition hover:text-emerald-100"
        >
          <span aria-hidden>↩</span> Back to Pocket Manager5
        </Link>

        <section className="mt-6 rounded-3xl border border-slate-800/80 bg-slate-900/70 p-8 shadow-2xl shadow-black/30">
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Driven Brands retail cadence</p>
          <div className="mt-2 flex flex-wrap items-start gap-3">
            <h1 className="text-4xl font-semibold text-white">{feature.title}</h1>
            <span className="rounded-full border border-slate-800/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
              {feature.status}
            </span>
          </div>
          <p className="mt-4 text-lg text-slate-300">{feature.summary}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Mobile route</p>
              <p className="mt-2 font-mono text-sm text-emerald-200">{feature.platformRoute}</p>
            </div>
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Current period</p>
              <p className="mt-2 text-xl font-semibold text-white">
                Q{periodInfo.quarter} · Period {periodInfo.period}
              </p>
              <p className="text-sm text-slate-400">{periodRange}</p>
            </div>
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
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
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {feature.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-slate-800/60 px-3 py-1 text-xs text-slate-300">
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Full-period template</p>
              <p className="mt-1 text-2xl font-semibold text-white">Schedule + coverage board</p>
            </div>
            <Link
              href="/pocket-manager5/features/dm-schedule"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/50 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300"
            >
              Open DM workspace ↗
            </Link>
          </div>
          <div className="mt-6">
            <DmSchedulePlanner />
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Schedule writer</p>
            <h2 className="mt-1 text-3xl font-semibold text-white">Lock visits, prep, and coaching stories</h2>
            <p className="mt-3 text-sm text-slate-300">
              Draft your visit plan and 30-60-90 narrative alongside the calendar. Everything mirrors the mobile workflow so
              DMs can prep, visit, and recap in one place.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
                <p className="text-xs text-slate-400">Coverage health</p>
                <p className="mt-2 text-2xl font-semibold text-white">{coverageCallout}</p>
                <p className="text-[11px] text-slate-500">Sample cadence across five priority shops.</p>
              </div>
              <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
                <p className="text-xs text-slate-400">Next locks</p>
                {nextGap ? (
                  <>
                    <p className="mt-2 text-2xl font-semibold text-white">{nextGap.type}</p>
                    <p className="text-sm text-slate-400">
                      {nextGap.actual} / {nextGap.required} planned · add another visit to stay on pace.
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">All required visit types are satisfied for this period.</p>
                )}
              </div>
            </div>

            <ul className="mt-6 space-y-2">
              {dueChecklist.map((item) => (
                <li
                  key={item.type}
                  className="flex items-center justify-between rounded-2xl border border-slate-800/60 bg-slate-900/40 px-4 py-3"
                >
                  <div>
                    <p className="text-xs text-slate-400">{item.type}</p>
                    <p className="text-lg font-semibold text-white">
                      {item.actual} / {item.required} locked
                    </p>
                  </div>
                  <span className={`text-xs font-semibold ${item.met ? "text-emerald-300" : "text-amber-300"}`}>
                    {item.met ? "On target" : "Add visit"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            {relatedForms.map((form) => (
              <FormLinkCard key={form.slug} form={form} />
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Documentation</p>
              {docUrl ? (
                <Link
                  href={docUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-200 underline-offset-4 transition hover:text-emerald-100 hover:underline"
                >
                  DM schedule quick reference ↗
                </Link>
              ) : (
                <p className="mt-2 text-sm text-slate-400">Full spec is hosted in the native repo.</p>
              )}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Key hooks</p>
              <ul className="mt-2 space-y-1 font-mono text-xs text-slate-200">
                {feature.keyHooks?.length
                  ? feature.keyHooks.map((hook) => <li key={hook}>{hook}</li>)
                  : ["useVisits", "useRetailCalendar"].map((hook) => <li key={hook}>{hook}</li>)}
              </ul>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Forms surfaced</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-200">
                {relatedForms.map((form) => (
                  <li key={form.slug}>{form.title}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

type EmployeeManagementFeaturePageProps = {
  feature: FeatureMeta;
  docUrl?: string;
  relatedForms: FormConfig[];
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

const TEAM_PULSE = [
  { label: "Active staff", value: "14", subtext: "Manager, ASM, 12 techs" },
  { label: "Cross-training", value: "6", subtext: "Enrolled in multi-bay sprint" },
  { label: "Open requisitions", value: "2", subtext: "PT tech, CS" },
];

function buildNativeCodeLink(route: string) {
  const normalized = route.replace(/^\//, "");
  return `${NATIVE_CODE_BASE}/app/${normalized}.tsx`;
}

function EmployeeManagementFeaturePage({ feature, docUrl, relatedForms }: EmployeeManagementFeaturePageProps) {
  const sampleProfile = {
    name: "Monique Carter",
    role: "Shop Manager",
    tenure: "5.8 yrs",
    hireDate: "Apr 2019",
    phone: "555-0134",
    email: "monique.carter@example.com",
    focus: "Lead technician mentorship",
    status: "Active",
  } as const;

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
                  relatedForms.map((form) => (
                    <Link
                      key={form.slug}
                      href={`/pocket-manager5/forms/${form.slug}`}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-800/70 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400/60"
                    >
                      {form.title} ↗
                    </Link>
                  ))
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

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Employee profile snapshot</p>
            <div className="mt-4 rounded-2xl border border-slate-800/60 bg-slate-900/50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-2xl font-semibold text-white">{sampleProfile.name}</p>
                  <p className="text-sm text-slate-400">{sampleProfile.role}</p>
                </div>
                <span className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs font-semibold text-emerald-200">
                  {sampleProfile.status}
                </span>
              </div>
              <dl className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Tenure</dt>
                  <dd className="font-semibold text-white">{sampleProfile.tenure}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Hire date</dt>
                  <dd className="font-semibold text-white">{sampleProfile.hireDate}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Phone</dt>
                  <dd className="font-mono text-[13px] text-emerald-200">{sampleProfile.phone}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Email</dt>
                  <dd className="font-mono text-[13px] text-emerald-200">{sampleProfile.email}</dd>
                </div>
              </dl>
              <div className="mt-4 rounded-2xl border border-slate-800/60 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Development focus</p>
                <p className="mt-1 text-sm text-slate-300">{sampleProfile.focus}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Team pulse</p>
            <div className="mt-4 grid gap-3">
              {TEAM_PULSE.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                  <p className="text-xs text-slate-500">{item.label}</p>
                  <p className="text-2xl font-semibold text-white">{item.value}</p>
                  <p className="text-sm text-slate-400">{item.subtext}</p>
                </div>
              ))}
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

function FormLinkCard({ form }: { form: FormConfig }) {
  return (
    <article className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-5">
      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Writer</p>
      <h3 className="mt-2 text-2xl font-semibold text-white">{form.title}</h3>
      <p className="mt-2 text-sm text-slate-300">{form.description}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.3em] text-slate-500">
        <span>Feature: {form.feature}</span>
        {form.supabaseTable && <span>Table: {form.supabaseTable}</span>}
      </div>
      <Link
        href={`/pocket-manager5/forms/${form.slug}`}
        className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/50 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300"
      >
        Open form ↗
      </Link>
    </article>
  );
}
