"use client";

// app/page.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HierarchyStamp } from "@/app/components/HierarchyStamp";
import { RetailPills } from "@/app/components/RetailPills";
import { BrandWordmark } from "@/app/components/BrandWordmark";
import { ExecutiveDashboard } from "@/app/components/ExecutiveDashboard";
import { supabase, pulseSupabase } from "@/lib/supabaseClient";
import { fetchRetailContext } from "@/lib/retailCalendar";
import { fetchShopTotals, type PulseTotalsResult, type PulseTotals } from "@/lib/pulseTotals";
import { fetchHierarchyRollups, type RollupSummary, type RollupSlice } from "@/lib/pulseRollups";

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
  district_id: string | null;
  region_id: string | null;
};


const integerFormatter = new Intl.NumberFormat("en-US");
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const todayISO = () => new Date().toISOString().split("T")[0];

const getWeekStartISO = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day;
  const first = new Date(now.setDate(diff));
  return first.toISOString().split("T")[0];
};

const EMPTY_ROLLUPS = {
  district: null as RollupSummary | null,
  region: null as RollupSummary | null,
  division: null as RollupSummary | null,
};

const formatPercent = (value: number | null) => {
  if (value === null || Number.isNaN(value)) {
    return "--";
  }
  return `${value.toFixed(1)}%`;
};

const buildSliceFromTotals = (totals: PulseTotals): RollupSlice => {
  const cars = totals.cars;
  const safePercent = (value: number) => (cars > 0 ? (value / cars) * 100 : null);
  return {
    cars,
    sales: totals.sales,
    aro: cars > 0 ? totals.sales / cars : null,
    big4Pct: safePercent(totals.big4),
    coolantsPct: safePercent(totals.coolants),
    diffsPct: safePercent(totals.diffs),
    mobil1Pct: safePercent(totals.mobil1),
    donations: totals.donations,
  };
};

type GridMetric = {
  label: string;
  value: string;
  caption?: string;
  tone?: "default" | "success" | "warning";
  secondaryLabel?: string;
  secondaryValue?: string;
};

const formatCurrencyCompact = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return currencyFormatter.format(Math.round(value));
};

const formatIntegerCompact = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return integerFormatter.format(Math.round(value));
};

type LiveKpiConfig = {
  label: string;
  caption?: string;
  getter: (summary: RollupSummary) => string;
};

const LIVE_KPI_CONFIG: LiveKpiConfig[] = [
  { label: "Donations today", caption: "Round-up", getter: (summary) => formatCurrencyCompact(summary.daily.donations) },
  { label: "Donations WTD", caption: "Week to date", getter: (summary) => formatCurrencyCompact(summary.weekly.donations) },
  { label: "Big 4 mix", caption: "Week mix", getter: (summary) => formatPercent(summary.weekly.big4Pct) },
  { label: "Coolants mix", caption: "Week mix", getter: (summary) => formatPercent(summary.weekly.coolantsPct) },
  { label: "Diffs mix", caption: "Week mix", getter: (summary) => formatPercent(summary.weekly.diffsPct) },
  { label: "Mobil 1 mix", caption: "Week mix", getter: (summary) => formatPercent(summary.weekly.mobil1Pct) },
];

const buildLiveKpiMetrics = (summary: RollupSummary | null): GridMetric[] => {
  const carsDaily = formatIntegerCompact(summary?.daily.cars ?? null);
  const carsWtd = formatIntegerCompact(summary?.weekly.cars ?? null);
  const salesDaily = formatCurrencyCompact(summary?.daily.sales ?? null);
  const salesWtd = formatCurrencyCompact(summary?.weekly.sales ?? null);
  const aroDaily = formatCurrencyCompact(summary?.daily.aro ?? null);
  const aroWtd = formatCurrencyCompact(summary?.weekly.aro ?? null);

  const baseline: GridMetric[] = [
    {
      label: "Cars",
      caption: "Daily / WTD",
      value: carsDaily,
      secondaryLabel: "WTD",
      secondaryValue: carsWtd,
    },
    {
      label: "Sales",
      caption: "Daily / WTD",
      value: salesDaily,
      secondaryLabel: "WTD",
      secondaryValue: salesWtd,
    },
    {
      label: "ARO",
      caption: "Daily / WTD",
      value: aroDaily,
      secondaryLabel: "WTD",
      secondaryValue: aroWtd,
    },
  ];

  const extended = LIVE_KPI_CONFIG.map(({ label, caption, getter }) => ({
    label,
    caption,
    value: summary ? getter(summary) : "--",
  }));

  return [...baseline, ...extended];
};

const ADMIN_MANAGEMENT_METRICS: GridMetric[] = [
  {
    label: "Current contests",
    value: "2",
    caption: "Region Big 4 push; Zero Zeros challenge",
    tone: "warning",
  },
  {
    label: "Challenges today / WTD",
    value: "3 / 11",
    caption: "Completed challenges (placeholder)",
  },
  {
    label: "Inventory saved/exported",
    value: "12",
    caption: "Inventory files saved or exported (placeholder)",
  },
  {
    label: "Cadence completion",
    value: "86% / 93%",
    caption: "Daily / WTD cadence completion (placeholder)",
    tone: "success",
  },
  {
    label: "Games played",
    value: "18",
    caption: "Pocket Manager games or flashcards (placeholder)",
  },
  {
    label: "Current staffed %",
    value: "94%",
    caption: "Of target labor hours (placeholder)",
    tone: "success",
  },
  {
    label: "Employees +/-",
    value: "+1 / -0",
    caption: "Staffing changes (placeholder)",
  },
  {
    label: "Training compliance",
    value: "92%",
    caption: "Shop-wide training (placeholder)",
    tone: "success",
  },
  {
    label: "Staffed vs ideal",
    value: "94%",
    caption: "Scheduled vs ideal (placeholder)",
  },
  {
    label: "Average tenure",
    value: "3.2 yrs",
    caption: "Average SM/ASM tenure (placeholder)",
  },
  {
    label: "Meetings today / WTD",
    value: "2 / 7",
    caption: "Shop visits or meetings (placeholder)",
  },
  {
    label: "Claims submitted today / WTD",
    value: "1 / 3",
    caption: "Warranty or damage claims (placeholder)",
  },
];

const buildAdminManagementMetrics = (): GridMetric[] => ADMIN_MANAGEMENT_METRICS;

type MetricsPanelProps = {
  title: string;
  eyebrow: string;
  metrics: GridMetric[];
};

function MetricsPanel({ title, eyebrow, metrics }: MetricsPanelProps) {
  return (
    <div className="rounded-3xl border border-slate-900/70 bg-slate-950/70 p-4 shadow-2xl shadow-black/20 space-y-3">
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">{eyebrow}</p>
        <h3 className="text-xl font-semibold text-white">{title}</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {metrics.map((metric) => (
          <MetricGridCard key={metric.label} metric={metric} />
        ))}
      </div>
    </div>
  );
}

function MetricGridCard({ metric }: { metric: GridMetric }) {
  const toneClass =
    metric.tone === "success"
      ? "text-emerald-200"
      : metric.tone === "warning"
      ? "text-amber-200"
      : "text-slate-100";

  return (
    <div className="flex min-h-[110px] flex-col items-center justify-between rounded-2xl border border-slate-800/70 bg-slate-900/60 p-3 text-center">
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">{metric.label}</p>
        {metric.caption && <p className="text-[10px] text-slate-500">{metric.caption}</p>}
      </div>
      <div className="mt-auto space-y-1">
        <p className={`text-lg font-semibold ${toneClass}`}>{metric.value}</p>
        {metric.secondaryValue && (
          <p className="text-xs text-slate-400">
            {metric.secondaryLabel ? `${metric.secondaryLabel}: ` : ""}
            {metric.secondaryValue}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [hierarchy, setHierarchy] = useState<HierarchySummary | null>(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(true);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);
  const [shopMeta, setShopMeta] = useState<ShopMeta | null>(null);
  const [pulseTotals, setPulseTotals] = useState<PulseTotalsResult | null>(null);
  const [pulseLoading, setPulseLoading] = useState(false);
  const [retailLabel, setRetailLabel] = useState("");
  const [storedShopName, setStoredShopName] = useState<string | null>(null);
  const [divisionId, setDivisionId] = useState<string | null>(null);
  const [rollups, setRollups] = useState(EMPTY_ROLLUPS);
  const [rollupsLoading, setRollupsLoading] = useState(false);
  const [rollupsError, setRollupsError] = useState<string | null>(null);
  const [activeScope, setActiveScope] = useState<RollupSummary["scope"]>("SHOP");
  const needsLogin = authChecked && !loginEmail;

  const syncAuthState = useCallback(() => {
    if (typeof window === "undefined") return;

    const storedLoggedIn = window.localStorage.getItem("loggedIn") === "true";
    const storedEmail = (window.localStorage.getItem("loginEmail") ?? "").trim().toLowerCase();

    if (!storedLoggedIn || !storedEmail) {
      setIsLoggedIn(false);
      setLoginEmail(null);
      setAuthChecked(true);
      router.replace("/login?redirect=/");
      return;
    }

    setIsLoggedIn(true);
    setLoginEmail(storedEmail);
    setAuthChecked(true);
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "loggedIn" || event.key === "loginEmail") {
        syncAuthState();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [syncAuthState]);

  useEffect(() => {
    syncAuthState();
  }, [syncAuthState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setStoredShopName(window.localStorage.getItem("shopUserName"));
  }, [loginEmail]);

  useEffect(() => {
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
  }, [loginEmail]);

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
              .select("id, shop_number, shop_name, district_id, region_id")
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
    if (!shopMeta?.region_id) {
      setDivisionId(null);
      return;
    }

    let cancelled = false;

    const fetchDivision = async () => {
      try {
        const { data, error } = await pulseSupabase
          .from("regions")
          .select("division_id")
          .eq("id", shopMeta.region_id)
          .maybeSingle();

        if (cancelled) {
          return;
        }

        if (error && error.code !== "PGRST116") {
          console.error("regions lookup error", error);
          setDivisionId(null);
          return;
        }

        setDivisionId((data?.division_id as string | null) ?? null);
      } catch (err) {
        if (!cancelled) {
          console.error("regions lookup exception", err);
          setDivisionId(null);
        }
      }
    };

    fetchDivision();

    return () => {
      cancelled = true;
    };
  }, [shopMeta?.region_id]);

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
    if (!shopMeta?.id) {
      setRollups(EMPTY_ROLLUPS);
      setRollupsError(null);
      return;
    }

    const districtId = shopMeta.district_id;
    const regionId = shopMeta.region_id;
    const divisionKey = divisionId;

    if (!districtId && !regionId && !divisionKey) {
      setRollups(EMPTY_ROLLUPS);
      setRollupsError(null);
      return;
    }

    let cancelled = false;
    setRollupsLoading(true);

    fetchHierarchyRollups({
      districtId,
      regionId,
      divisionId: divisionKey ?? undefined,
      districtLabel: hierarchy?.district_name ?? null,
      regionLabel: hierarchy?.region_name ?? null,
      divisionLabel: hierarchy?.division_name ?? null,
      dailyDate: todayISO(),
      weekStart: getWeekStartISO(),
    })
      .then((result) => {
        if (!cancelled) {
          setRollups(result);
          setRollupsError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Home rollups error", err);
          setRollups(EMPTY_ROLLUPS);
          setRollupsError("Unable to load hierarchy rollups right now.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRollupsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shopMeta?.id, shopMeta?.district_id, shopMeta?.region_id, divisionId, hierarchy?.district_name, hierarchy?.region_name, hierarchy?.division_name]);

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

  const shopSummary = useMemo(() => {
    if (!pulseTotals || !shopMeta?.id) return null;
    return {
      scope: "SHOP" as RollupSummary["scope"],
      label: shopMeta?.shop_name ?? (hierarchy?.shop_number ? `Shop #${hierarchy.shop_number}` : "Your shop"),
      daily: buildSliceFromTotals(pulseTotals.daily),
      weekly: buildSliceFromTotals(pulseTotals.weekly),
    } satisfies RollupSummary;
  }, [pulseTotals, shopMeta?.id, shopMeta?.shop_name, hierarchy?.shop_number]);

  const summaryOptions = useMemo(() => {
    const options: RollupSummary[] = [];
    if (shopSummary) options.push(shopSummary);
    if (rollups.district) options.push(rollups.district);
    if (rollups.region) options.push(rollups.region);
    if (rollups.division) options.push(rollups.division);
    return options;
  }, [shopSummary, rollups.district, rollups.region, rollups.division]);

  useEffect(() => {
    if (!summaryOptions.length) {
      return;
    }
    const current = summaryOptions.find((option) => option.scope === activeScope);
    if (!current) {
      setActiveScope(summaryOptions[0].scope);
    }
  }, [summaryOptions, activeScope]);

  const activeSummary = summaryOptions.find((option) => option.scope === activeScope) ?? null;
  const liveKpiCards = useMemo(() => buildLiveKpiMetrics(activeSummary ?? null), [activeSummary]);
  const adminManagementCards = useMemo(() => buildAdminManagementMetrics(), []);
  const rollupSubtitle = retailLabel ? `${retailLabel} • All-day performance` : "All-day performance";
  const liveScopeLoading = activeSummary?.scope === "SHOP" ? pulseLoading : rollupsLoading;
  const livePanelEyebrow = activeSummary
    ? `${activeSummary.label} • ${
        activeSummary.scope === "SHOP" ? "shop scope" : activeSummary.scope.toLowerCase()
      }${liveScopeLoading ? " • refreshing" : ""}`
    : "Live scope";
  const heroGreeting = storedShopName?.trim()
    ? storedShopName.trim()
    : hierarchy?.shop_number
    ? `Shop #${hierarchy.shop_number}`
    : null;
  const brandTileClasses =
    "inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-3 text-xs font-semibold text-slate-100 shadow-lg shadow-black/20 transition hover:border-emerald-400/60 w-full sm:w-auto sm:min-w-[160px]";
  const panelBaseClasses =
    "relative overflow-hidden rounded-3xl border border-slate-900/80 bg-slate-950/80 p-6 shadow-2xl shadow-black/30";
  const panelOverlayClasses =
    "pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-900/40 via-slate-950/40 to-black/60";

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
        <p className="text-sm text-slate-400">Checking login status…</p>
      </main>
    );
  }

  if (needsLogin) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
        <p className="text-sm text-slate-400">Redirecting to login…</p>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        {/* Header */}
        <header className={`${panelBaseClasses}`}>
          <div className={panelOverlayClasses} />
          <div className="relative space-y-5">
            <p className="text-center text-sm font-semibold text-slate-200">
              <span className="text-red-500">P</span>ocket Manager
              <span className="text-red-500">5</span> • <span className="text-red-500">P</span>ulse Check
              <span className="text-red-500">5</span>
            </p>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <Link
                href="/pocket-manager5"
                className={`${brandTileClasses} md:flex-1 md:max-w-[180px]`}
                aria-label="Go to Pocket Manager5"
              >
                <BrandWordmark
                  brand="pocket"
                  mode="dark"
                  showBadge={false}
                  className="text-[1.5rem] leading-none"
                />
              </Link>

              <div className="text-center md:flex md:flex-col md:items-center md:justify-center md:flex-1">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold">
                  <span className="text-red-500">P</span>ocket&nbsp;Manager
                  <span className="text-red-500">5</span>
                </h1>
                {heroGreeting && (
                  <p className="text-xs text-slate-400">Hi {heroGreeting}, keep the pulse green.</p>
                )}
              </div>

              <Link
                href="/pulse-check5"
                className={`${brandTileClasses} md:flex-1 md:max-w-[180px]`}
                aria-label="Open Pulse Check5"
              >
                <BrandWordmark
                  brand="pulse"
                  mode="dark"
                  showBadge={false}
                  className="text-[1.5rem] leading-none"
                />
              </Link>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex flex-col items-start gap-2">
                <RetailPills />
              </div>

              <div className="flex flex-col items-start md:items-end gap-2">
                <button
                  onClick={handleAuthClick}
                  className="inline-flex items-center justify-center rounded-full border border-emerald-400/80 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                >
                  {isLoggedIn ? "Logout" : "Login"}
                </button>
                {hierarchyLoading ? (
                  <p className="text-xs text-slate-500">Loading scope…</p>
                ) : hierarchyError ? (
                  <p className="text-xs text-amber-300">Scope unavailable</p>
                ) : (
                  <HierarchyStamp />
                )}
              </div>
            </div>
          </div>
        </header>

        {hierarchyError && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {hierarchyError}
          </div>
        )}

        {summaryOptions.length > 0 && activeSummary && (
          <section className={panelBaseClasses}>
            <div className={panelOverlayClasses} />
            <div className="relative space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {summaryOptions.map((option) => (
                    <button
                      key={option.scope}
                      onClick={() => setActiveScope(option.scope)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        option.scope === activeScope
                          ? "border-emerald-400 bg-emerald-500/10 text-emerald-200"
                          : "border-slate-700 text-slate-400 hover:border-emerald-500/40 hover:text-emerald-200"
                      }`}
                    >
                      {option.scope === "SHOP" ? "Shop" : option.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{rollupSubtitle}</p>
              </div>
              {rollupsError && summaryOptions.length > 1 && (
                <p className="text-xs text-amber-300">{rollupsError}</p>
              )}
              <div className="grid gap-6 lg:grid-cols-2">
                <MetricsPanel
                  title="LIVE KPIs"
                  eyebrow={livePanelEyebrow}
                  metrics={liveKpiCards}
                />
                <MetricsPanel
                  title="Admin Management"
                  eyebrow="Coaching + compliance snapshot"
                  metrics={adminManagementCards}
                />
              </div>
            </div>
          </section>
        )}

        <section className={panelBaseClasses}>
          <div className={panelOverlayClasses} />
          <div className="relative">
            <ExecutiveDashboard />
          </div>
        </section>

      </div>
    </main>
  );
}



