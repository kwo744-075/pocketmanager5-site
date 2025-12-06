import type { ReactNode } from "react";

type BannerMetric = {
  label: string;
  value: string;
  secondaryValue?: string;
  subtitle?: string;
};

type ScopeToggleValue = "daily" | "weekly";

type ShopPulseBannerProps = {
  title: string;
  subtitle?: string;
  metrics: BannerMetric[];
  loading: boolean;
  onClick?: () => void;
  error?: string;
  ctaLabel?: string;
  cadence?: {
    submitted: number;
    total: number;
    percent: number;
    loading?: boolean;
  };
  viewToggle?: {
    label: string;
    checked: boolean;
    onChange: (value: boolean) => void;
  };
  scopeToggle?: {
    value: ScopeToggleValue;
    onChange: (value: ScopeToggleValue) => void;
  };
};

export function ShopPulseBanner({
  title,
  subtitle,
  metrics,
  loading,
  onClick,
  error,
  ctaLabel = "View summary →",
  cadence,
  viewToggle,
  scopeToggle,
}: ShopPulseBannerProps) {
  const Container: "button" | "div" = onClick ? "button" : "div";
  const showViewToggle = Boolean(viewToggle && !onClick);
  const showScopeToggle = Boolean(scopeToggle);
  const controlCardBase =
    "w-full rounded-[18px] border border-white/12 bg-[#080f1e]/85 px-3 py-2 text-left text-[11px] text-slate-200 shadow-[0_18px_40px_rgba(1,6,20,0.45)] sm:px-3";

  const controls: ReactNode[] = [];

  if (cadence) {
    controls.push(
      <div key="cadence" className={`${controlCardBase} flex flex-col gap-1`}>
        <span className="text-[9px] uppercase tracking-[0.35em] text-slate-500">Check-in status</span>
        <div className="flex items-center justify-between text-white">
          <span className="text-[11px] font-semibold">
            {cadence.loading ? "--/--" : `${cadence.submitted}/${cadence.total}`}
          </span>
          <span className="text-[11px] font-semibold">
            {cadence.loading ? "--%" : `${cadence.percent}%`}
          </span>
        </div>
      </div>
    );
  }

  if (showViewToggle && viewToggle) {
    controls.push(
      <div key="view" className={`${controlCardBase}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[9px] uppercase tracking-[0.35em] text-slate-500">View mode</span>
            <p className="text-[11px] font-semibold text-white">{viewToggle.label}</p>
          </div>
          <BannerToggleSwitch checked={viewToggle.checked} onChange={viewToggle.onChange} />
        </div>
      </div>
    );
  }

  if (showScopeToggle && scopeToggle) {
    controls.push(
      <div key="scope" className={`${controlCardBase}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[9px] uppercase tracking-[0.35em] text-slate-500">Metric scope</span>
            <p className="text-[11px] font-semibold text-white">
              {scopeToggle.value === "daily" ? "Daily" : "Week to date"}
            </p>
          </div>
          <div className="flex gap-1">
            {(["daily", "weekly"] as ScopeToggleValue[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (scopeToggle.value !== option) {
                    scopeToggle.onChange(option);
                  }
                }}
                className={`rounded-xl border px-1.5 py-0.5 text-[10px] font-semibold transition ${
                  scopeToggle.value === option
                    ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100"
                    : "border-white/10 text-slate-300 hover:border-emerald-400/50"
                }`}
              >
                {option === "daily" ? "Daily" : "WTD"}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const controlCols =
    controls.length >= 3 ? "grid-cols-1 sm:grid-cols-3" : controls.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1";

  return (
    <Container
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`w-full rounded-[30px] border border-sky-400/30 bg-gradient-to-br from-[#041a36]/95 via-[#050f22]/95 to-[#010409]/98 p-5 text-left shadow-[0_35px_80px_rgba(3,8,25,0.75)] backdrop-blur transition ${
        onClick ? "hover:border-emerald-400/70" : ""
      }`}
    >
      <div className="flex flex-col gap-4">
        {controls.length > 0 && <div className={`grid gap-2 ${controlCols}`}>{controls}</div>}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-semibold text-white">{title}</h2>
            {subtitle && <p className="text-sm text-slate-300">{subtitle}</p>}
          </div>
          {onClick && (
            <span className="inline-flex items-center justify-center rounded-full border border-emerald-400/60 px-3 py-1 text-xs font-semibold text-emerald-300">
              {ctaLabel}
            </span>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      <div className="mt-4 flex flex-col items-start space-y-1 text-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-200">
          <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_0_4px_rgba(16,185,129,0.2)] animate-pulse" />
          LIVE KPIs
        </div>
        <p className="text-[9px] uppercase tracking-[0.35em] text-slate-500">KPI summary</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {metrics.map((metric) => {
          const highlightScope = scopeToggle?.value ?? "daily";
          return (
            <div
              key={metric.label}
              className="flex min-h-[96px] flex-col justify-between rounded-[18px] border border-white/12 bg-gradient-to-br from-[#061229]/92 via-[#050b1d]/94 to-[#02060f]/97 px-3 py-2 text-slate-200 shadow-[0_18px_40px_rgba(1,6,20,0.65)]"
            >
              <div className="space-y-0.5">
                <p className="text-[11px] font-semibold text-white tracking-tight">{metric.label}</p>
                {metric.subtitle && <p className="text-[9px] text-slate-400">{metric.subtitle}</p>}
              </div>
              <div className="mt-auto text-base font-semibold tracking-tight">
                {loading ? (
                  <span className="text-slate-500">--</span>
                ) : metric.secondaryValue ? (
                  <div className="flex items-baseline gap-1 text-sm">
                    <span className={highlightScope === "daily" ? "text-white" : "text-slate-500"}>{metric.value}</span>
                    <span className="text-slate-600">/</span>
                    <span className={highlightScope === "weekly" ? "text-white" : "text-slate-500"}>{metric.secondaryValue}</span>
                  </div>
                ) : (
                  <span className="text-white">{metric.value}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Container>
  );
}

export type { BannerMetric };

function BannerToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      className={`relative inline-flex h-4 w-8 items-center rounded-full border border-slate-600 transition ${
        checked ? "bg-emerald-500 border-emerald-400" : "bg-slate-800"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${
          checked ? "translate-x-3.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
