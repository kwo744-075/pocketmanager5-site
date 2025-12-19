import Link from "next/link";
import type { ComponentType } from "react";
import { ArrowUpRight, CalendarDays, Gauge, Users, ClipboardList, Activity } from "lucide-react";
import type { EmployeeSchedulingPreview } from "@/lib/peopleFeatureData";
import type { FeatureMeta } from "../../featureRegistry";
import type { FormConfig } from "../../forms/formRegistry";
import AddShiftPanel from "./AddShiftPanel";
import EmployeeSchedulerGrid from "./EmployeeSchedulerGrid";
import SchedulerGridEditor from "./SchedulerGridEditor";

const friendlyRangeFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const friendlyDateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const dayNameFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });

const formatRangeLabel = (startISO: string, endISO: string) => {
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Current week";
  }
  return `${friendlyRangeFormatter.format(start)} – ${friendlyRangeFormatter.format(end)} (${start.getFullYear()})`;
};

const formatDateLabel = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return friendlyDateFormatter.format(date);
};

const formatNumber = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });

const appendShopQuery = (href: string, shopNumber: string | null) => {
  if (!href) return href;
  if (!shopNumber) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}shop=${encodeURIComponent(shopNumber)}`;
};

const varianceBadgeClass = (variance: number) => {
  if (variance > 2) return "border-rose-400/50 bg-rose-500/10 text-rose-100";
  if (variance < -2) return "border-emerald-400/50 bg-emerald-500/10 text-emerald-100";
  return "border-amber-400/50 bg-amber-500/10 text-amber-100";
};

const barWidth = (scheduled: number, allowed?: number) => {
  if (!allowed || allowed <= 0) return "100%";
  return `${Math.min(100, Math.round((scheduled / allowed) * 100))}%`;
};

function CoverageCard({
  date,
  hours,
  allowedHours,
}: {
  date: string;
  hours: number;
  allowedHours?: number;
}) {
  const variance = hours - (allowedHours ?? 0);
  const parsedDate = new Date(date);
  const dayLabel = Number.isNaN(parsedDate.getTime()) ? "Day" : dayNameFormatter.format(parsedDate);
  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{dayLabel}</p>
          <p className="text-lg font-semibold text-white">{formatNumber(hours)} hrs</p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${varianceBadgeClass(variance)}`}>
          {variance >= 0 ? "+" : ""}
          {formatNumber(variance)}
        </span>
      </div>
      <div className="mt-3 text-xs text-slate-400">Allowed: {formatNumber(allowedHours ?? 0)} hrs</div>
      <div className="mt-2 h-2 rounded-full bg-slate-800">
        {(() => {
          const w = barWidth(hours, allowedHours);
          const pct = parseInt(String(w), 10) || 0;
          const cls = `esw_bar_${pct}`;
          return (
            <>
              <style>{`.${cls}{width:${w}}`}</style>
              <div className={`h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-400 ${cls}`} />
            </>
          );
        })()}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <section className="rounded-3xl border border-slate-800/70 bg-slate-950/60 p-8 text-center text-sm text-slate-400">
      {message}
    </section>
  );
}

function StatBlock({ label, value, subtext, icon: Icon }: { label: string; value: string; subtext?: string; icon: ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
      <div className="flex items-center gap-3 text-slate-400">
        <Icon className="h-4 w-4" />
        <p className="text-[11px] uppercase tracking-[0.3em]">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {subtext ? <p className="text-sm text-slate-400">{subtext}</p> : null}
    </div>
  );
}

export type EmployeeSchedulingWorkspaceProps = {
  feature: FeatureMeta;
  docUrl?: string;
  relatedForms: FormConfig[];
  shopNumber: string | null;
  preview: EmployeeSchedulingPreview;
};

export function EmployeeSchedulingWorkspace({ feature, docUrl, relatedForms, shopNumber, preview }: EmployeeSchedulingWorkspaceProps) {
  const scheduledHours = preview.simpleScheduler.totalHours;
  const allowedHours = preview.projections.totalAllowedHours;
  const variance = Number((scheduledHours - allowedHours).toFixed(1));
  const totalShifts = preview.simpleScheduler.totalShifts;
  const employeeCount = preview.simpleScheduler.employees.length;
  const rangeLabel = formatRangeLabel(preview.weekStartISO, preview.weekEndISO);
  const lastShiftLabel = formatDateLabel(preview.simpleScheduler.lastShiftDate);

  const forms = relatedForms.map((form) => ({
    slug: form.slug,
    title: form.title,
    href: appendShopQuery(`/pocket-manager5/forms/${form.slug}`, shopNumber),
  }));

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-12 space-y-10">
        <Link
          href="/pocket-manager5"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 transition hover:text-emerald-100"
        >
          <span aria-hidden>↩</span> Back to Pocket Manager5
        </Link>

        <section className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-8 shadow-2xl shadow-black/40">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl space-y-3">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">People workspace</p>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-semibold text-white">{feature.title}</h1>
                <span className="rounded-full border border-slate-800/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
                  {feature.status}
                </span>
              </div>
              <p className="text-lg text-slate-300">{feature.summary}</p>
              <div className="rounded-2xl border border-slate-800/70 bg-slate-900/50 p-4 text-sm text-slate-300">
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Week window</p>
                <p className="mt-1 text-xl font-semibold text-white">{rangeLabel}</p>
                <p className="text-sm text-slate-400">Data reflects the latest synced week for the selected shop.</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 text-sm text-slate-300">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Native route</p>
                <p className="mt-1 font-mono text-emerald-200">{feature.platformRoute}</p>
              </div>
              {docUrl ? (
                <Link
                  href={docUrl}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-400/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100 transition hover:border-emerald-300"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  View spec <ArrowUpRight className="h-3 w-3" />
                </Link>
              ) : null}
              {forms.length ? (
                <div className="flex flex-wrap gap-2">
                  {forms.map((form) => (
                    <Link
                      key={form.slug}
                      href={form.href}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-700/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-200 transition hover:border-emerald-400/60"
                    >
                      {form.title}
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {!shopNumber ? (
          <EmptyState message="Link a shop from the Pocket Manager home workspace to preview live scheduling data." />
        ) : (
          <>
            <section className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatBlock label="Scheduled" value={`${formatNumber(scheduledHours)} hrs`} subtext="Total hours for the active week" icon={Gauge} />
                <StatBlock label="Allowed" value={`${formatNumber(allowedHours)} hrs`} subtext="Projected car counts × factor" icon={CalendarDays} />
                <StatBlock
                  label="Variance"
                  value={`${variance >= 0 ? "+" : ""}${formatNumber(variance)} hrs`}
                  subtext="Negative = capacity available"
                  icon={Activity}
                />
                <StatBlock label="Total shifts" value={totalShifts.toString()} subtext={`${employeeCount} teammates scheduled`} icon={Users} />
                <StatBlock label="Last shift" value={lastShiftLabel} subtext="Most recent published entry" icon={ClipboardList} />
              </div>
            </section>

            <section className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Daily coverage</p>
                  <h2 className="text-2xl font-semibold text-white">Scheduled vs allowed hours</h2>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${varianceBadgeClass(variance)}`}>
                  Week variance {variance >= 0 ? "surplus" : "available"}
                </span>
              </div>
              {preview.simpleScheduler.dailyCoverage.length ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {preview.simpleScheduler.dailyCoverage.map((day, index) => (
                    <CoverageCard
                      key={day.date}
                      date={day.date}
                      hours={day.hours}
                      allowedHours={day.allowedHours ?? preview.projections.daily[index]?.allowedHours}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">No shifts recorded for this week.</p>
              )}
            </section>

            <section className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Lineup</p>
                  <h2 className="text-2xl font-semibold text-white">Hours by teammate</h2>
                </div>
              </div>
              <AddShiftPanel shopNumber={preview.shopNumber ?? null} />
              <SchedulerGridEditor shopNumber={preview.shopNumber ?? null} />
              <EmployeeSchedulerGrid preview={preview} />
              {preview.simpleScheduler.employees.length ? (
                <div className="mt-4 divide-y divide-slate-800/70 text-sm">
                  {preview.simpleScheduler.employees.map((employee) => (
                    <div key={employee.id} className="grid gap-3 py-3 sm:grid-cols-[1.5fr_1fr_0.7fr]">
                      <div>
                        <p className="font-semibold text-white">{employee.name}</p>
                        <p className="text-xs text-slate-400">{employee.role ?? "Role pending"}</p>
                      </div>
                      <div className="text-slate-300">
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Hours</p>
                        <p className="text-lg font-semibold text-white">{formatNumber(employee.hours)}</p>
                      </div>
                      <div className="text-slate-300">
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Shifts</p>
                        <p className="text-lg font-semibold text-white">{employee.shifts}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">Run a schedule from the app to populate this list.</p>
              )}
            </section>

            {preview.legacyScheduler.rows.length ? (
              <section className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Legacy exports</p>
                    <h2 className="text-2xl font-semibold text-white">Saved weekly schedules</h2>
                  </div>
                  <div className="rounded-2xl border border-slate-700/70 bg-slate-900/40 px-4 py-2 text-sm text-slate-300">
                    Total {formatNumber(preview.legacyScheduler.totalHours)} hrs · OT {formatNumber(preview.legacyScheduler.overtimeHours)} hrs
                  </div>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-800/70 text-sm">
                    <thead className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Employee</th>
                        <th className="px-3 py-2 text-left">Position</th>
                        <th className="px-3 py-2 text-right">Hours</th>
                        <th className="px-3 py-2 text-right">OT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 text-slate-300">
                      {preview.legacyScheduler.rows.map((row) => (
                        <tr key={row.id}>
                          <td className="px-3 py-2 font-semibold text-white">{row.staffName}</td>
                          <td className="px-3 py-2">{row.position ?? "--"}</td>
                          <td className="px-3 py-2 text-right">{formatNumber(row.totalHours)}</td>
                          <td className="px-3 py-2 text-right text-amber-200">{formatNumber(row.overtimeHours)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
