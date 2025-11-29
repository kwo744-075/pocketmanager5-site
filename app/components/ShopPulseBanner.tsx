type BannerMetric = {
  label: string;
  value: string;
};

type ShopPulseBannerProps = {
  title: string;
  subtitle: string;
  metrics: BannerMetric[];
  loading: boolean;
  onClick?: () => void;
  error?: string;
  ctaLabel?: string;
};

export function ShopPulseBanner({
  title,
  subtitle,
  metrics,
  loading,
  onClick,
  error,
  ctaLabel = "View summary →",
}: ShopPulseBannerProps) {
  const Container: "button" | "div" = onClick ? "button" : "div";

  return (
    <Container
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`w-full rounded-[30px] border border-white/5 bg-[#040c1c]/95 p-5 text-left shadow-[0_25px_70px_rgba(1,6,20,0.75)] backdrop-blur transition ${
        onClick ? "hover:border-emerald-400/70" : ""
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300">Pulse Check</p>
          <h2 className="text-2xl font-semibold text-white">{title}</h2>
          <p className="text-sm text-slate-300">{subtitle}</p>
        </div>
        {onClick && (
          <span className="self-start rounded-full border border-emerald-400/60 px-3 py-1 text-xs font-semibold text-emerald-300">
            {ctaLabel}
          </span>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-white/5 bg-gradient-to-br from-[#10213f]/80 via-[#07142d]/80 to-[#020915]/95 p-4 shadow-[0_18px_40px_rgba(1,6,20,0.75)]"
          >
            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">{metric.label}</p>
            <p className="mt-2 text-xl font-semibold text-white">{loading ? "--" : metric.value}</p>
          </div>
        ))}
      </div>
    </Container>
  );
}

export type { BannerMetric };
