"use client";

// app/page.tsx
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HierarchyStamp } from "@/app/components/HierarchyStamp";
import { RetailPills } from "@/app/components/RetailPills";
import { supabase, pulseSupabase } from "@/lib/supabaseClient";
import { fetchRetailContext } from "@/lib/retailCalendar";
import { fetchShopTotals, type PulseTotalsResult, EMPTY_TOTALS } from "@/lib/pulseTotals";

type HierarchySummary = {
  login: string;
  scope_level: string | null;
  division_name: string | null;
  region_name: string | null;
  district_name: string | null;
  shop_number: string | null;
};

type ShopMeta = {
  id: string;
  shop_number: number | null;
  shop_name: string | null;
};

type BannerMetric = {
  label: string;
  value: string;
};

const integerFormatter = new Intl.NumberFormat("en-US");
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const aroFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const formatPercent = (value: number) => `${percentFormatter.format(value)}%`;


type MetricCardProps = {
  label: string;
  value: string;
  note: string;
};

function MetricCard({ label, value, note }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-center">
      <p className="text-[11px] text-slate-400 mb-1">{label}</p>
      <p className="text-lg font-semibold text-emerald-300 break-words">
        {value}
      </p>
      <p className="text-[10px] text-slate-500 mt-1">{note}</p>
    </div>
  );
}

function ShopPulseBanner({
  title,
  subtitle,
  metrics,
  loading,
  onClick,
  error,
}: {
  title: string;
  subtitle: string;
  metrics: BannerMetric[];
  loading: boolean;
  onClick: () => void;
  error?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-3xl border border-emerald-500/30 bg-slate-950/70 p-5 text-left shadow-inner shadow-black/40 transition hover:border-emerald-400"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-400">Pulse Check</p>
          <h2 className="text-2xl font-semibold text-white">{title}</h2>
          <p className="text-sm text-slate-300">{subtitle}</p>
        </div>
        <span className="self-start rounded-full border border-emerald-400/60 px-3 py-1 text-xs font-semibold text-emerald-300">
          View summary →
        </span>
      </div>
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3"
          >
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{metric.label}</p>
            <p className="mt-1 text-xl font-semibold text-white">
              {loading ? "--" : metric.value}
            </p>
          </div>
        ))}
      </div>
    </button>
  );
}

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("loggedIn") === "true";
  });
  const [hierarchy, setHierarchy] = useState<HierarchySummary | null>(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(true);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);
  const [shopMeta, setShopMeta] = useState<ShopMeta | null>(null);
  const [pulseTotals, setPulseTotals] = useState<PulseTotalsResult | null>(null);
  const [pulseLoading, setPulseLoading] = useState(false);
  const [retailLabel, setRetailLabel] = useState("");
  const [storedShopName, setStoredShopName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "loggedIn") {
        setIsLoggedIn(event.newValue === "true");
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setStoredShopName(window.localStorage.getItem("shopUserName"));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const loginEmail = window.localStorage.getItem("loginEmail");
    if (!loginEmail) {
      setHierarchy(null);
      setHierarchyError(null);
      setHierarchyLoading(false);
      return;
    }

    let cancelled = false;
    const normalized = loginEmail.trim().toLowerCase();
    setHierarchyLoading(true);
    setHierarchyError(null);

    const run = async () => {
      try {
        const { data, error } = await supabase
          .from("hierarchy_summary_vw")
          .select("*")
          .eq("login", normalized)
          .maybeSingle();

        if (cancelled) {
          return;
        }

        if (error) {
          console.error("Home hierarchy_summary_vw error", error);
          setHierarchy(null);
          setHierarchyError("Unable to load your hierarchy scope.");
        } else {
          setHierarchy((data as HierarchySummary | null) ?? null);
          setHierarchyError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Home hierarchy fetch error", err);
          setHierarchy(null);
          setHierarchyError("Unable to load your hierarchy scope.");
        }
      } finally {
        if (!cancelled) {
          setHierarchyLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hierarchy?.shop_number) {
      setShopMeta(null);
      return;
    }

    const numericShop = Number(hierarchy.shop_number);
    if (Number.isNaN(numericShop)) {
      setShopMeta(null);
      return;
    }

    let cancelled = false;

    const fetchMeta = async () => {
      try {
        const clients = [pulseSupabase, supabase];
        let resolved: ShopMeta | null = null;
        let lastError: unknown = null;

        for (const client of clients) {
          try {
            const { data, error } = await client
              .from("shops")
              .select("id, shop_number, shop_name")
              .eq("shop_number", numericShop)
              .limit(1)
              .maybeSingle();

            if (error && error.code !== "PGRST116") {
              lastError = error;
              continue;
            }

            if (data) {
              resolved = data as ShopMeta;
              break;
            }
          } catch (clientErr) {
            lastError = clientErr;
          }
        }

        if (cancelled) {
          return;
        }

        if (resolved) {
          setShopMeta(resolved);
        } else {
          setShopMeta(null);
          if (lastError) {
            console.error("Home shop lookup error", lastError);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Home shop metadata error", err);
          setShopMeta(null);
        }
      }
    };

    fetchMeta();

    return () => {
      cancelled = true;
    };
  }, [hierarchy?.shop_number]);

  useEffect(() => {
    if (!shopMeta?.id) {
      setPulseTotals(null);
      return;
    }

    let cancelled = false;
    setPulseLoading(true);

    fetchShopTotals(shopMeta.id)
      .then((result) => {
        if (!cancelled) {
          setPulseTotals(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Home pulse totals error", err);
          setPulseTotals(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPulseLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shopMeta?.id]);

  useEffect(() => {
    const run = async () => {
      const context = await fetchRetailContext();
      if (context) {
        setRetailLabel(`${context.quarterLabel}-${context.periodLabel}-${context.weekLabel} ${context.dateLabel}`);
      }
    };

    run();
  }, []);

  const handleAuthClick = () => {
    router.push(isLoggedIn ? "/logout" : "/login");
  };

  const isShopScope = hierarchy?.scope_level?.toUpperCase() === "SHOP";
  const showPulseBanner = Boolean(isShopScope && shopMeta);
  const bannerShopNumber = hierarchy?.shop_number ?? (shopMeta?.shop_number ? String(shopMeta.shop_number) : null);
  const bannerShopName =
    shopMeta?.shop_name ?? storedShopName ?? (bannerShopNumber ? `Shop ${bannerShopNumber}` : "Your shop");
  const bannerSubtitle = retailLabel || "Retail calendar resolving…";

  const bannerMetrics: BannerMetric[] = useMemo(() => {
    const daily = pulseTotals?.daily ?? EMPTY_TOTALS;
    const cars = daily.cars;
    const aro = cars > 0 ? daily.sales / Math.max(cars, 1) : 0;
    return [
      { label: "Cars", value: integerFormatter.format(cars) },
      { label: "Sales $", value: currencyFormatter.format(daily.sales) },
      { label: "ARO $", value: aroFormatter.format(aro || 0) },
      { label: "Big 4 %", value: formatPercent(daily.big4) },
      { label: "Coolants %", value: formatPercent(daily.coolants) },
      { label: "Diffs %", value: formatPercent(daily.diffs) },
    ];
  }, [pulseTotals]);

  const handlePulseBannerClick = () => {
    if (!shopMeta?.id) {
      return;
    }

    const params = new URLSearchParams({ shopId: shopMeta.id });
    if (bannerShopNumber) {
      params.set("shopNumber", bannerShopNumber);
    }
    if (bannerShopName) {
      params.set("shopName", bannerShopName);
    }
    if (retailLabel) {
      params.set("retailLabel", retailLabel);
    }

    router.push(`/pulse-check5/shop-summary?${params.toString()}`);
  };
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        {/* Header */}
        <header className="space-y-5">
          <p className="text-center text-sm font-semibold text-slate-200">
            <span className="text-red-500">P</span>ocket Manager
            <span className="text-red-500">5</span> • <span className="text-red-500">P</span>ulse Check
            <span className="text-red-500">5</span>
          </p>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col items-start gap-2">
              <RetailPills />
              <Link
                href="/pocket-manager5"
                className="inline-flex items-center rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300 transition hover:border-emerald-400/60"
                aria-label="Go to Pocket Manager5"
              >
                <Image src="/logos/pocket-manager5.svg" width={150} height={40} alt="Pocket Manager5" priority />
              </Link>
            </div>

            <div className="text-center space-y-2">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold">
                <span className="text-red-500">P</span>ocket&nbsp;Manager
                <span className="text-red-500">5</span> control center
              </h1>
              <p className="text-sm text-slate-400">Visits, cadence, and Pulse Check data now ride side-by-side.</p>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2">
              <button
                onClick={handleAuthClick}
                className="inline-flex items-center justify-center rounded-full border border-emerald-400/80 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
              >
                {isLoggedIn ? "Logout" : "Login"}
              </button>
              <HierarchyStamp />
              <Link
                href="/pulse-check5"
                className="inline-flex items-center rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300 transition hover:border-emerald-400/60"
                aria-label="Open Pulse Check5"
              >
                <Image src="/logos/pulse-check5.svg" width={140} height={38} alt="Pulse Check5" />
              </Link>
            </div>
          </div>
        </header>

        {showPulseBanner && (
          <ShopPulseBanner
            title={`Pulse Check – ${bannerShopName ?? "Your shop"}`}
            subtitle={bannerSubtitle}
            metrics={bannerMetrics}
            loading={pulseLoading || hierarchyLoading}
            onClick={handlePulseBannerClick}
            error={hierarchyError ?? undefined}
          />
        )}

        {/* Main dashboard: left KPIs / center 4x3 grid / right KPIs */}
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_minmax(0,1.1fr)] items-start">
          {/* LEFT COLUMN – CURRENT ACTIVITY (stacked KPI boxes) */}
          <div className="space-y-4">
            <MetricCard
              label="Current contests"
              value="2"
              note="Region Big 4 push; Zero Zeros challenge (placeholder)"
            />
            <MetricCard
              label="Challenges done today / WTD"
              value="3 / 11"
              note="Completed challenges (placeholder)"
            />
            {/* extra placeholders on left */}
            <MetricCard
              label="Inventory saved/exported today"
              value="12"
              note="Inventory files saved or exported (placeholder)"
            />
            <MetricCard
              label="Cadence completion daily / WTD"
              value="86% / 93%"
              note="Daily / WTD cadence completion (placeholder)"
            />
            <MetricCard
              label="Games / flashcards played today"
              value="18"
              note="Pocket Manager games or flashcards played (placeholder)"
            />
          </div>

          {/* CENTER COLUMN – SUMMARY ROLLUP (4x3 grid) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-lg shadow-black/30 space-y-4">
            <p className="text-[10px] tracking-[0.25em] uppercase text-emerald-400 text-center">
              Summary rollup (Pocket Manager5 + Pulse Check5)
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 text-xs">
              {/* 12 metrics, now 4 columns x 3 rows on xl */}
              <MetricCard
                label="Shops checked in today"
                value="12 / 14"
                note="Live from Pulse Check5 (placeholder)"
              />
              <MetricCard
                label="Cars"
                value="186"
                note="Today (placeholder)"
              />
              <MetricCard
                label="Sales"
                value="$24,580"
                note="PTD sales (placeholder)"
              />
              <MetricCard
                label="ARO"
                value="$105.32"
                note="Avg. ticket (placeholder)"
              />
              <MetricCard
                label="Big 4 performance (PTD)"
                value="103.8%"
                note="Region rollup (placeholder)"
              />
              <MetricCard
                label="Coolants"
                value="15 / 35.2%"
                note="Units sold PTD / mix % (placeholder)"
              />

              <MetricCard
                label="Diffs"
                value="12 / 28.9%"
                note="Units sold PTD / mix % (placeholder)"
              />
              <MetricCard
                label="Current labor hours +/-"
                value="+3.2"
                note="Vs. target (placeholder)"
              />
              <MetricCard
                label="Cash +/-"
                value="+$21.34"
                note="Over / short today (placeholder)"
              />
              <MetricCard
                label="Turned cars today"
                value="7 / $849.56"
                note="Count / est. loss (turned x ARO, placeholder)"
              />
              <MetricCard
                label="Manual work orders today"
                value="15 / $1784.00"
                note="Manual work orders saved #/$"
              />
              <MetricCard
                label="Zero shops"
                value="3"
                note="Shops with zeros in FF, coolants, or diffs (placeholder)"
              />
            </div>

            <p className="text-[10px] text-slate-500 mt-1 text-center">
              These values are static for now. Next step is wiring them to your
              existing Supabase views for Pocket Manager5 and Pulse Check5.
            </p>
          </div>

          {/* RIGHT COLUMN – OTHER STATS (stacked KPI boxes) */}
          <div className="space-y-4">
            <MetricCard
              label="Current staffed %"
              value="94%"
              note="Of target labor hours (placeholder)"
            />
            <div className="mt-4 grid grid-cols-2 gap-4">
              <MetricCard
                label="Employees +/-"
                value="+1 / -0"
                note="Staffing changes (placeholder)"
              />
              <MetricCard
                label="Training compliance"
                value="92%"
                note="Shop-wide (placeholder)"
              />
              <MetricCard
                label="Staffed %"
                value="94%"
                note="Scheduled vs. ideal (placeholder)"
              />
              <MetricCard
                label="Average tenure"
                value="3.2 yrs"
                note="Average SM/ASM tenure (placeholder)"
              />
            </div>
            <MetricCard
              label="Meetings today / WTD"
              value="2 / 7"
              note="Shop visits / meetings (placeholder)"
            />
            <MetricCard
              label="Claims submitted today / WTD"
              value="1 / 3"
              note="Warranty / damage claims (placeholder)"
            />
          </div>
        </section>

        {/* Two app tiles */}
        <section className="grid md:grid-cols-2 gap-8">
          {/* Pocket Manager5 card */}
          <a
            href="/pocket-manager5"
            className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between hover:border-emerald-400/80 hover:bg-slate-900 transition"
          >
            <div>
              <h2 className="text-xl font-semibold mb-2 flex items-center justify-between">
                <span>Pocket Manager5</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-400">
                  Daily ops
                </span>
              </h2>
              <p className="text-sm text-slate-300 mb-4">
                Mobile-first toolkit for shop managers and DMs: visits, labor,
                coaching, training, and quick references – designed to live in
                your pocket.
              </p>
              <ul className="text-xs text-slate-300 space-y-2 mb-4">
                <li>• Daily management cadence in your hand</li>
                <li>• Drill down from region → district → shop</li>
                <li>• Ties into your existing Pocket Manager5 app data</li>
              </ul>
            </div>
            <button className="mt-2 inline-flex items-center justify-center rounded-xl border border-emerald-400/70 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-300 group-hover:bg-emerald-500/20">
              Go to Pocket Manager5 →
            </button>
          </a>

          {/* Pulse Check5 card */}
          <a
            href="/pulse-check5"
            className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between hover:border-emerald-400/80 hover:bg-slate-900 transition"
          >
            <div>
              <h2 className="text-xl font-semibold mb-2 flex items-center justify-between">
                <span>Pulse Check5</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-400">
                  Live KPIs
                </span>
              </h2>
              <p className="text-sm text-slate-300 mb-4">
                High-level dashboards for RDs and DMs: shop-by-shop status,
                Big 4, labor, and trends so you know where to coach today.
              </p>
              <ul className="text-xs text-slate-300 space-y-2 mb-4">
                <li>• Region heartbeat in one view</li>
                <li>• Daily &amp; weekly KPI rollups</li>
                <li>• Built to plug into your current Supabase schema</li>
              </ul>
            </div>
            <button className="mt-2 inline-flex items-center justify-center rounded-xl border border-emerald-400/70 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-300 group-hover:bg-emerald-500/20">
              Go to Pulse Check5 →
            </button>
          </a>
        </section>
      </div>
    </main>
  );
}



