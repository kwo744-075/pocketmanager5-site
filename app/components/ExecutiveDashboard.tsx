import type { ReactNode } from "react";

const cardBaseClasses =
  "relative overflow-hidden rounded-[28px] border border-white/5 bg-[#050f24]/85 p-4 shadow-[0_25px_60px_rgba(1,6,20,0.75)] backdrop-blur";

type DashboardSectionCardProps = {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  headerAddon?: ReactNode;
};

export function DashboardSectionCard({ title, eyebrow, children, footer, headerAddon }: DashboardSectionCardProps) {
  return (
    <section className={cardBaseClasses}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.15),_transparent_45%)]" />
      <div className="relative border-b border-white/5 pb-3 flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
        <div>
          {eyebrow && <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">{eyebrow}</p>}
          <h3 className="mt-1 text-2xl font-semibold text-white">{title}</h3>
        </div>
        {headerAddon}
      </div>
      <div className="relative space-y-3 pt-3">{children}</div>
      {footer && <div className="relative mt-3 border-t border-white/5 pt-3 text-sm text-slate-400">{footer}</div>}
    </section>
  );
}

type KpiTileProps = {
  label: string;
  subtitle?: string;
  value: string;
  eyebrow?: string;
};

export function KpiTile({ label, subtitle, value, eyebrow }: KpiTileProps) {
  return (
    <div className="flex min-h-[110px] flex-col items-center justify-between rounded-3xl border border-white/5 bg-gradient-to-br from-[#10213f]/80 via-[#07142d]/85 to-[#020915]/95 p-4 text-center text-slate-200 shadow-[0_18px_40px_rgba(1,6,20,0.75)]">
      {eyebrow && <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">{eyebrow}</p>}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-white leading-tight">{label}</p>
        {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
      </div>
      <p className="mt-auto text-xl font-semibold text-white tracking-tight">{value}</p>
    </div>
  );
}

const adminRowOne = [
  { label: "Staffed %", subtitle: "today / WTD", value: "0 / 0%" },
  { label: "Employee +/-", subtitle: "today / WTD", value: "0 / 0" },
  { label: "Average Tenure", subtitle: "(months)", value: "0" },
];

const adminRowTwo = [
  { label: "Training Compliance", subtitle: "today / WTD", value: "0 / 0%" },
  { label: "Cadence Completion", subtitle: "Daily / WTD", value: "0% / 0%" },
  { label: "Challenges Completed", subtitle: "today / WTD", value: "0 / 0" },
];

const adminRowThree = [{ label: "Meetings Held", subtitle: "today / WTD", value: "0 / 0 / 0" }];

const cashSpotlightTile = { label: "Cash +/-", subtitle: "Daily / WTD", value: "$0 / $0" };

const adminOpsTiles = [
  { label: "Claims submitted", subtitle: "today / WTD", value: "0 / 0" },
  { label: "Inventory Saved / Exported", subtitle: "today / WTD", value: "0 / 0" },
  { label: "IT repairs submitted", subtitle: "today / WTD", value: "0 / 0" },
  { label: "R&M requests submitted", subtitle: "today / WTD", value: "0 / 0" },
];

const liveKpiTiles = [
  { label: "Cars", subtitle: "Daily / WTD", value: "0 / 0" },
  { label: "Sales", subtitle: "Daily / WTD", value: "$0 / $0" },
  { label: "ARO", subtitle: "Daily / WTD", value: "$0 / $0" },
  { label: "Big4", value: "0 / 0%" },
  { label: "Coolants", value: "0 / 0%" },
  { label: "Diffs", value: "0 / 0%" },
  { label: "Fuel Filters", value: "0" },
  { label: "Mobil1 (Promo)", value: "0" },
  { label: "Donations", value: "$0" },
  { label: "Turned Cars", subtitle: "# / $", value: "0 / $0" },
  { label: "Zero Shops", subtitle: "# / %", value: "0 / 0%" },
  { label: "Manual Work Orders", subtitle: "created today / WTD", value: "0 / $0" },
];

export function ExecutiveDashboard() {
  return (
    <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="flex flex-col gap-6">
        <DashboardSectionCard title="Admin Management" eyebrow="People systems">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {adminRowOne.map((tile) => (
              <KpiTile key={tile.label} {...tile} />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {adminRowTwo.map((tile) => (
              <KpiTile key={tile.label} {...tile} />
            ))}
          </div>
          <div className="grid gap-3">
            {adminRowThree.map((tile) => (
              <KpiTile key={tile.label} {...tile} />
            ))}
          </div>
        </DashboardSectionCard>
        <DashboardSectionCard title="Live Activity" eyebrow="Current Contest">
          <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4">
            <p className="text-sm font-semibold text-white">Live Activity</p>
            <p className="text-xs text-slate-400">Contest status</p>
            <p className="mt-3 text-xl font-semibold text-white"># / $</p>
          </div>
        </DashboardSectionCard>
        <DashboardSectionCard title="Live Chat Box">
          <p className="text-sm text-slate-300">Live chat feed / DM notes will appear here.</p>
        </DashboardSectionCard>
      </div>

      <div className="flex flex-col gap-6">
        <DashboardSectionCard
          title="Live KPIs"
          eyebrow="Ops pulse"
          headerAddon={
            <div className="rounded-3xl border border-white/5 bg-slate-900/50 p-3 text-slate-200 shadow-inner shadow-black/30 min-w-[160px] text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{cashSpotlightTile.subtitle}</p>
              <p className="text-base font-semibold text-white">{cashSpotlightTile.label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{cashSpotlightTile.value}</p>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {liveKpiTiles.map((tile) => (
              <KpiTile key={tile.label} {...tile} />
            ))}
          </div>
        </DashboardSectionCard>

        <DashboardSectionCard title="Admin / Ops" eyebrow="Claims • Inventory • IT">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {adminOpsTiles.map((tile) => (
              <KpiTile key={tile.label} {...tile} />
            ))}
          </div>
        </DashboardSectionCard>

        <DashboardSectionCard title="Equipment & Ops Checks" eyebrow="Compliance">
          <KpiTile label="Equipment Checks" subtitle="today / WTD" value="0 / 0" />
        </DashboardSectionCard>
      </div>
    </section>
  );
}
