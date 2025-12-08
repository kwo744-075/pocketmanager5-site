import type { ReactNode } from "react";

const cardBaseClasses =
  "relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#04142a]/92 via-[#050b1d]/95 to-[#01040c]/98 p-3 shadow-[0_28px_70px_rgba(3,10,25,0.75)] backdrop-blur";
const cardOverlayClasses =
  "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_55%)]";
const tileBaseClasses =
  "flex min-h-[78px] flex-col items-center justify-between rounded-[16px] border border-white/12 px-2.5 py-2 text-center text-slate-200 shadow-[0_12px_28px_rgba(1,6,20,0.55)]";

type TileVariant = "emerald" | "sky" | "violet" | "amber" | "rose" | "cyan" | "indigo" | "slate";

const TILE_VARIANT_CLASSES: Record<TileVariant, string> = {
  emerald: "bg-gradient-to-br from-[#033326]/90 via-[#06231c]/92 to-[#010c0a]/96",
  sky: "bg-gradient-to-br from-[#052543]/90 via-[#041628]/92 to-[#010911]/96",
  violet: "bg-gradient-to-br from-[#2b0b3a]/88 via-[#180822]/92 to-[#090311]/96",
  amber: "bg-gradient-to-br from-[#3a1f05]/90 via-[#221103]/92 to-[#0c0401]/96",
  rose: "bg-gradient-to-br from-[#3a051b]/90 via-[#210210]/92 to-[#0c0106]/96",
  cyan: "bg-gradient-to-br from-[#023440]/90 via-[#032d36]/92 to-[#010d11]/96",
  indigo: "bg-gradient-to-br from-[#0c1240]/90 via-[#070b28]/92 to-[#020513]/96",
  slate: "bg-gradient-to-br from-[#0b1a32]/85 via-[#060f21]/90 to-[#030812]/95",
};

const TILE_VARIANTS = Object.keys(TILE_VARIANT_CLASSES) as TileVariant[];

const getRandomVariant = (): TileVariant => {
  const randomIndex = Math.floor(Math.random() * TILE_VARIANTS.length);
  return TILE_VARIANTS[randomIndex] ?? "slate";
};

type DashboardTile = {
  label: string;
  subtitle?: string;
  value: string;
  eyebrow?: string;
  variant?: TileVariant;
};

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
      <div className={cardOverlayClasses} />
      <div className="relative border-b border-white/5 pb-2 flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
        <div>
          {eyebrow && <p className="text-[9px] uppercase tracking-[0.35em] text-slate-500">{eyebrow}</p>}
          <h3 className="mt-0.5 text-lg font-semibold text-white">{title}</h3>
        </div>
        {headerAddon}
      </div>
      <div className="relative space-y-2 pt-2">{children}</div>
      {footer && <div className="relative mt-2 border-t border-white/5 pt-2 text-xs text-slate-400">{footer}</div>}
    </section>
  );
}

type KpiTileProps = DashboardTile;

export function KpiTile({ label, subtitle, value, eyebrow, variant }: KpiTileProps) {
  const resolvedVariant = variant ?? getRandomVariant();
  return (
    <div className={`${tileBaseClasses} ${TILE_VARIANT_CLASSES[resolvedVariant]} space-y-0.5`}>
      {eyebrow && <p className="text-[8px] uppercase tracking-[0.35em] text-slate-500">{eyebrow}</p>}
      <div className="space-y-0.5">
        <p className="text-[11px] font-semibold text-white leading-tight">{label}</p>
        {subtitle && <p className="text-[9px] text-slate-400">{subtitle}</p>}
      </div>
      <p className="mt-auto text-base font-semibold text-white tracking-tight">{value}</p>
    </div>
  );
}

const adminRowOne: DashboardTile[] = [
  { label: "Staffed %", subtitle: "today / WTD", value: "0 / 0%" },
  { label: "Employee +/-", subtitle: "today / WTD", value: "0 / 0" },
  { label: "Average Tenure", subtitle: "(months)", value: "0" },
];

const adminRowTwo: DashboardTile[] = [
  { label: "Training Compliance", subtitle: "today / WTD", value: "0 / 0%" },
  { label: "Cadence Completion", subtitle: "Daily / WTD", value: "0% / 0%" },
  { label: "Challenges Completed", subtitle: "today / WTD", value: "0 / 0" },
];

const adminRowThree: DashboardTile[] = [
  { label: "Meetings Held", subtitle: "today / WTD", value: "0 / 0 / 0" },
];

const cashSpotlightTile: DashboardTile = { label: "Cash +/-", subtitle: "Daily / WTD", value: "$0 / $0" };

const adminOpsTiles: DashboardTile[] = [
  { label: "Claims submitted", subtitle: "today / WTD", value: "0 / 0" },
  { label: "Inventory Saved / Exported", subtitle: "today / WTD", value: "0 / 0" },
  { label: "IT repairs submitted", subtitle: "today / WTD", value: "0 / 0" },
  { label: "R&M requests submitted", subtitle: "today / WTD", value: "0 / 0" },
];

const equipmentChecksTiles: DashboardTile[] = [
  { label: "Mileage Printers", subtitle: "today / WTD", value: "0 / 0" },
  { label: "WO Printers", subtitle: "today / WTD", value: "0 / 0" },
  { label: "Working CC Machines", subtitle: "today / WTD", value: "0 / 0" },
  { label: "Bay PCs", subtitle: "today / WTD", value: "0 / 0" },
  { label: "Evacs Machines", subtitle: "today / WTD", value: "0 / 0" },
  { label: "Coolant Machines", subtitle: "today / WTD", value: "0 / 0" },
];

const liveKpiTiles: DashboardTile[] = [
  { label: "Cars", subtitle: "Daily / WTD", value: "0 / 0" },
  { label: "Sales", subtitle: "Daily / WTD", value: "$0 / $0" },
  { label: "ARO", subtitle: "Daily / WTD", value: "$0 / $0" },
  { label: "Big4", value: "0 / 0%" },
  { label: "Coolants", value: "0 / 0%" },
  { label: "Diffs", value: "0 / 0%" },
  { label: "Fuel Filters", value: "0" },
  { label: "Mobil1 (Promo)", value: "0" },
  // Insert additional NPS-related banner tiles between the controllables row and donations
  { label: "NPS", subtitle: "Guest Score", value: "0%" },
  { label: "NPS Manager Visit", subtitle: "Visits", value: "0" },
  { label: "NPS Water", subtitle: "Quality", value: "0%" },
  { label: "Email Collection", subtitle: "Opt-ins", value: "0" },
  { label: "Donations", value: "$0" },
  { label: "Turned Cars", subtitle: "# / $", value: "0 / $0" },
  { label: "Zero Shops", subtitle: "# / %", value: "0 / 0%" },
  { label: "Manual Work Orders", subtitle: "created today / WTD", value: "0 / $0" },
];

export function ExecutiveDashboard() {
  return (
    <section className="grid gap-2.5 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="flex flex-col gap-2.5">
        <DashboardSectionCard title="Admin Management">
          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {adminRowOne.map((tile) => (
              <KpiTile key={tile.label} {...tile} />
            ))}
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {adminRowTwo.map((tile) => (
              <KpiTile key={tile.label} {...tile} />
            ))}
          </div>
          <div className="grid gap-1.5">
            {adminRowThree.map((tile) => (
              <KpiTile key={tile.label} {...tile} />
            ))}
          </div>
        </DashboardSectionCard>
        <DashboardSectionCard title="Admin / Ops">
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {adminOpsTiles.map((tile) => (
              <KpiTile key={tile.label} {...tile} />
            ))}
          </div>
        </DashboardSectionCard>
        <DashboardSectionCard title="Live Activity" eyebrow="Current Contest">
          <div className={`${tileBaseClasses} w-full gap-1 text-left`}>
            <p className="text-[11px] font-semibold text-white">Live Activity</p>
            <p className="text-[9px] text-slate-400">Contest status</p>
            <p className="text-base font-semibold text-white"># / $</p>
          </div>
        </DashboardSectionCard>
        <DashboardSectionCard title="Live Chat Box">
          <p className="text-[11px] text-slate-300">Live chat feed / DM notes will appear here.</p>
        </DashboardSectionCard>
      </div>

      <div className="flex flex-col gap-2.5">
        <DashboardSectionCard
          title="Live KPIs"
          headerAddon={
            <div className="rounded-[12px] border border-white/15 bg-gradient-to-br from-emerald-500/15 via-slate-900/70 to-slate-950/85 px-1.5 py-1 text-slate-100 shadow-[0_6px_16px_rgba(1,6,20,0.55)] min-w-[72px] text-center">
              <p className="text-[8px] uppercase tracking-[0.32em] text-emerald-200/80">{cashSpotlightTile.subtitle}</p>
              <p className="text-[11px] font-semibold text-white">{cashSpotlightTile.label}</p>
              <p className="mt-0.5 text-base font-semibold text-white">{cashSpotlightTile.value}</p>
            </div>
          }
        >
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {liveKpiTiles.map((tile) => (
              <KpiTile key={tile.label} {...tile} />
            ))}
          </div>
        </DashboardSectionCard>

        <DashboardSectionCard title="Admin / Ops">
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {adminOpsTiles.map((tile) => (
              <KpiTile key={tile.label} {...tile} />
            ))}
          </div>
        </DashboardSectionCard>

        <DashboardSectionCard title="Equipment & Ops Checks" eyebrow="Compliance">
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {equipmentChecksTiles.map((tile) => (
              <KpiTile key={tile.label} {...tile} />
            ))}
          </div>
        </DashboardSectionCard>
      </div>
    </section>
  );
}
