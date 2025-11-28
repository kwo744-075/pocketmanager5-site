"use client";

import Link from "next/link";
import { Component, Suspense, useMemo, type ReactNode } from "react";
import { BrandWordmark } from "@/app/components/BrandWordmark";
import { RetailPills } from "@/app/components/RetailPills";
import { HierarchyStamp } from "@/app/components/HierarchyStamp";
import { usePocketHierarchy } from "@/hooks/usePocketHierarchy";
import { usePulseTotalsSuspense, useSnapshotSuspense } from "@/hooks/usePocketManagerData";
import { EMPTY_SNAPSHOT } from "@/lib/pocketManagerData";
import { type PulseTotals, EMPTY_TOTALS } from "@/lib/pulseTotals";

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

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

type SectionCardProps = {
  title: string;
  eyebrow: string;
  action?: ReactNode;
  children: ReactNode;
};

function SectionCard({ title, eyebrow, action, children }: SectionCardProps) {
  return (
    <section className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6 shadow-2xl shadow-black/20">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-400">{eyebrow}</p>
          <h2 className="text-2xl font-semibold text-white">{title}</h2>
        </div>
        {action}
      </div>
      <div className="pt-4 space-y-5">{children}</div>
    </section>
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
      action={
        <Link
          href="/pulse-check5"
          className="inline-flex items-center rounded-full border border-emerald-400/60 px-4 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/10"
        >
          View Pulse Check
        </Link>
      }
    >
      {children}
    </SectionCard>
  );
}

function PulseOverviewContent({ shopId }: { shopId: string | null | undefined }) {
  const pulseTotals = usePulseTotalsSuspense(shopId);
  const dailyTotals = pulseTotals?.daily ?? EMPTY_TOTALS;
  const weeklyTotals = pulseTotals?.weekly ?? EMPTY_TOTALS;

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
    </>
  );
}

function PulseOverviewSection({ shopId }: { shopId: string | null | undefined }) {
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
            <SectionStatus message="Refreshing shop KPIs…" />
          </PulseOverviewShell>
        }
      >
        <PulseOverviewShell>
          <PulseOverviewContent shopId={shopId} />
        </PulseOverviewShell>
      </Suspense>
    </SectionErrorBoundary>
  );
}

function SnapshotAlertsBanner({ shopNumber }: { shopNumber: number | string | null | undefined }) {
  const snapshot = useSnapshotSuspense(shopNumber) ?? EMPTY_SNAPSHOT;
  if (!snapshot.alerts.length) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
      <p className="text-[11px] uppercase tracking-[0.3em] text-amber-200/80">Alerts</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {snapshot.alerts.map((alert) => (
          <li key={alert}>{alert}</li>
        ))}
      </ul>
    </div>
  );
}

function VisitsCoachingSection({ shopNumber }: { shopNumber: number | string | null | undefined }) {
  const snapshot = useSnapshotSuspense(shopNumber) ?? EMPTY_SNAPSHOT;
  return (
    <SectionCard
      title="Visits & Coaching"
      eyebrow="DM tools"
      action={
        <button
          type="button"
          className="inline-flex items-center rounded-full border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200"
        >
          Log visit (coming soon)
        </button>
      }
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
    <SectionCard title="Labor & Staffing" eyebrow="Hours vs plan">
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
    <SectionCard title="Training & Cadence" eyebrow="People systems">
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
      action={
        <button
          type="button"
          className="inline-flex items-center rounded-full border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200"
        >
          Open inventory (coming soon)
        </button>
      }
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
    <SectionCard title="Admin & Safety" eyebrow="Claims • Solinks">
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
  visits: () => (
    <SectionCard
      title="Visits & Coaching"
      eyebrow="DM tools"
      action={
        <button
          type="button"
          className="inline-flex items-center rounded-full border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200"
          disabled
        >
          Log visit (coming soon)
        </button>
      }
    >
      <SectionStatus message="Loading visit schedules…" />
    </SectionCard>
  ),
  labor: () => (
    <SectionCard title="Labor & Staffing" eyebrow="Hours vs plan">
      <SectionStatus message="Calculating labor pull…" />
    </SectionCard>
  ),
  training: () => (
    <SectionCard title="Training & Cadence" eyebrow="People systems">
      <SectionStatus message="Gathering training data…" />
    </SectionCard>
  ),
  inventory: () => (
    <SectionCard
      title="Inventory & Supplies"
      eyebrow="Counters & orders"
      action={
        <button
          type="button"
          className="inline-flex items-center rounded-full border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200"
          disabled
        >
          Open inventory (coming soon)
        </button>
      }
    >
      <SectionStatus message="Loading inventory counts…" />
    </SectionCard>
  ),
  admin: () => (
    <SectionCard title="Admin & Safety" eyebrow="Claims • Solinks">
      <SectionStatus message="Syncing admin logs…" />
    </SectionCard>
  ),
};

const SnapshotErrorStates = {
  alerts: () => <SectionStatus tone="error" message="Alerts unavailable." />,
  visits: () => (
    <SectionCard
      title="Visits & Coaching"
      eyebrow="DM tools"
      action={
        <button
          type="button"
          className="inline-flex items-center rounded-full border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200"
          disabled
        >
          Log visit (coming soon)
        </button>
      }
    >
      <SectionStatus tone="error" message="DM visit tools unavailable." />
    </SectionCard>
  ),
  labor: () => (
    <SectionCard title="Labor & Staffing" eyebrow="Hours vs plan">
      <SectionStatus tone="error" message="Labor dashboard unavailable." />
    </SectionCard>
  ),
  training: () => (
    <SectionCard title="Training & Cadence" eyebrow="People systems">
      <SectionStatus tone="error" message="Training data unavailable." />
    </SectionCard>
  ),
  inventory: () => (
    <SectionCard
      title="Inventory & Supplies"
      eyebrow="Counters & orders"
      action={
        <button
          type="button"
          className="inline-flex items-center rounded-full border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200"
          disabled
        >
          Open inventory (coming soon)
        </button>
      }
    >
      <SectionStatus tone="error" message="Inventory tools unavailable." />
    </SectionCard>
  ),
  admin: () => (
    <SectionCard title="Admin & Safety" eyebrow="Claims • Solinks">
      <SectionStatus tone="error" message="Admin data unavailable." />
    </SectionCard>
  ),
};

function SnapshotSection({ shopNumber }: { shopNumber: number | string | null | undefined }) {
  if (!shopNumber) {
    return <SectionStatus tone="error" message="Shop number missing—cannot load visit, labor, or inventory data." />;
  }

  return (
    <div className="space-y-6">
      <SectionErrorBoundary fallback={SnapshotErrorStates.alerts()}>
        <Suspense fallback={<SectionStatus message="Checking alerts…" />}>
          <SnapshotAlertsBanner shopNumber={shopNumber} />
        </Suspense>
      </SectionErrorBoundary>

      <SectionErrorBoundary fallback={SnapshotErrorStates.visits()}>
        <Suspense fallback={SnapshotFallbacks.visits()}>
          <VisitsCoachingSection shopNumber={shopNumber} />
        </Suspense>
      </SectionErrorBoundary>

      <SectionErrorBoundary fallback={SnapshotErrorStates.labor()}>
        <Suspense fallback={SnapshotFallbacks.labor()}>
          <LaborStaffingSection shopNumber={shopNumber} />
        </Suspense>
      </SectionErrorBoundary>

      <SectionErrorBoundary fallback={SnapshotErrorStates.training()}>
        <Suspense fallback={SnapshotFallbacks.training()}>
          <TrainingCadenceSection shopNumber={shopNumber} />
        </Suspense>
      </SectionErrorBoundary>

      <SectionErrorBoundary fallback={SnapshotErrorStates.inventory()}>
        <Suspense fallback={SnapshotFallbacks.inventory()}>
          <InventorySuppliesSection shopNumber={shopNumber} />
        </Suspense>
      </SectionErrorBoundary>

      <SectionErrorBoundary fallback={SnapshotErrorStates.admin()}>
        <Suspense fallback={SnapshotFallbacks.admin()}>
          <AdminSafetySection shopNumber={shopNumber} />
        </Suspense>
      </SectionErrorBoundary>
    </div>
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
  } = usePocketHierarchy();
  const heroName = storedShopName ?? (hierarchy?.shop_number ? `Shop ${hierarchy.shop_number}` : "Pocket Manager5");

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
              <p className="text-sm text-slate-400">
                Daily visits, labor, training, inventory, and DM tools—mirroring the mobile Pocket Manager app.
              </p>
              <RetailPills />
            </div>
            <div className="text-right text-xs text-slate-400">
              <p className="font-semibold text-slate-100">{heroName}</p>
              {hierarchyLoading ? (
                <p>Loading hierarchy…</p>
              ) : hierarchyError ? (
                <p className="text-amber-300">{hierarchyError}</p>
              ) : (
                <HierarchyStamp />
              )}
            </div>
          </div>
        </header>

        <PulseOverviewSection shopId={shopMeta?.id} />

        <SnapshotSection shopNumber={shopMeta?.shop_number} />
      </div>
    </main>
  );
}

