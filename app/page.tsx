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
import { getCachedSummaryForLogin, normalizeLogin, writeHierarchySummaryCache } from "@/lib/hierarchyCache";
import { fetchShopTotals, EMPTY_TOTALS, type PulseTotalsResult, type PulseTotals } from "@/lib/pulseTotals";
import { fetchHierarchyRollups, type RollupSummary, type RollupSlice } from "@/lib/pulseRollups";
import { fetchActiveContests } from "@/lib/contests";

type HierarchySummary = {
  login: string;
  scope_level: string | null;
  division_name: string | null;
  region_name: string | null;
  district_name: string | null;
  shop_number: string | null;
  shops_in_district: number | null;
  districts_in_region: number | null;
  shops_in_region: number | null;
  regions_in_division: number | null;
  shops_in_division: number | null;
};

type ShopMeta = {
  id: string;
  shop_number: number | null;
  shop_name: string | null;
  district_id: string | null;
  region_id: string | null;
};

type ContestHighlight = {
  activeCount: number;
  leadTitle: string | null;
  endsOn: string | null;
};

type HeroQuickActionVariant = "contest" | "rankings" | "people" | "ops" | "manager" | "dm";

type HeroQuickAction = {
  key: HeroQuickActionVariant;
  title: string;
  eyebrow: string;
  primary: string;
  secondary: string;
  href: string;
  variant: HeroQuickActionVariant;
};

const HERO_QUICK_LEFT_KEYS: HeroQuickActionVariant[] = ["people", "ops", "manager"];
const HERO_QUICK_RIGHT_KEYS: HeroQuickActionVariant[] = ["dm", "contest", "rankings"];


const integerFormatter = new Intl.NumberFormat("en-US");
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

const formatIntegerCompact = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return integerFormatter.format(Math.round(value));
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
    fuelFilters: totals.fuelFilters,
    donations: totals.donations,
  };
};


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
  const [divisionId, setDivisionId] = useState<string | null>(null);
  const [rollups, setRollups] = useState(EMPTY_ROLLUPS);
  const [contestHighlight, setContestHighlight] = useState<ContestHighlight>({
    activeCount: 0,
    leadTitle: null,
    endsOn: null,
  });
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
    let cancelled = false;

    const loadContests = async () => {
      try {
        const contests = await fetchActiveContests(4);
        if (cancelled) {
          return;
        }

        if (!contests.length) {
          setContestHighlight({ activeCount: 0, leadTitle: null, endsOn: null });
          return;
        }

        const leadContest = contests[0];
        setContestHighlight({
          activeCount: contests.length,
          leadTitle: leadContest?.title ?? null,
          endsOn: leadContest?.end_date ?? null,
        });
      } catch (error) {
        if (!cancelled) {
          console.error("Home contest fetch error", error);
          setContestHighlight({ activeCount: 0, leadTitle: null, endsOn: null });
        }
      }
    };

    loadContests();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loginEmail) {
      setHierarchy(null);
      setHierarchyLoading(false);
      setHierarchyError(null);
      return;
    }

    let cancelled = false;
    const normalized = normalizeLogin(loginEmail);
    if (!normalized) {
      setHierarchy(null);
      setHierarchyLoading(false);
      setHierarchyError("Unable to load your hierarchy scope.");
      return;
    }

    const cachedSummary = getCachedSummaryForLogin(normalized);
    if (cachedSummary) {
      setHierarchy((cachedSummary as HierarchySummary) ?? null);
      setHierarchyError(null);
    }
    setHierarchyLoading(true);
    setHierarchyError(null);

    const run = async () => {
      try {
        // Prefer server API which reads normalized tables; fall back to the legacy view
        let resolved: HierarchySummary | null = null;
        try {
          const resp = await fetch("/api/hierarchy/summary", { credentials: "same-origin" });
          if (resp.ok) {
            const body = await resp.json();
            resolved = (body?.data ?? null) as HierarchySummary | null;
          } else if (resp.status === 401) {
            // Session is invalid, clear local login state and redirect to login
            console.warn("Session expired, redirecting to login");
            if (typeof window !== "undefined") {
              window.localStorage.removeItem("loggedIn");
              window.localStorage.removeItem("loginEmail");
              window.localStorage.removeItem("userScopeLevel");
              window.localStorage.removeItem("userDisplayName");
              window.localStorage.removeItem("shopStore");
              window.location.href = "/login?redirect=/";
            }
            return;
          } else {
            console.error("Home hierarchy API status", resp.status);
          }
        } catch (apiErr) {
          console.error("Home hierarchy API error", apiErr);
        }

        if (!resolved) {
          // fallback to legacy view
          const { data, error } = await supabase
            .from("hierarchy_summary_vw")
            .select("*")
            .eq("login", normalized)
            .maybeSingle();

          if (error) {
            console.error("Home hierarchy_summary_vw error", error);
          } else {
            resolved = (data as HierarchySummary | null) ?? null;
          }
        }

        if (cancelled) return;

        if (resolved) {
          setHierarchy(resolved);
          setHierarchyError(null);
          writeHierarchySummaryCache(resolved);
        } else {
          const fallback = getCachedSummaryForLogin(normalized);
          if (fallback) {
            setHierarchy((fallback as HierarchySummary) ?? null);
            setHierarchyError(null);
          } else {
            setHierarchy(null);
            setHierarchyError("Unable to load your hierarchy scope.");
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Home hierarchy fetch error", err);
          if (!getCachedSummaryForLogin(normalized)) {
            setHierarchy(null);
            setHierarchyError("Unable to load your hierarchy scope.");
          }
        }
      } finally {
        if (!cancelled) setHierarchyLoading(false);
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
    fetchShopTotals(shopMeta.id)
      .then((result) => {
        if (!cancelled) {
          setPulseTotals(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Home pulse totals error", err);
          setPulseTotals({ daily: { ...EMPTY_TOTALS }, weekly: { ...EMPTY_TOTALS } });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shopMeta?.id]);

  useEffect(() => {
    if (!shopMeta?.id) {
      setRollups(EMPTY_ROLLUPS);
      return;
    }

    const districtId = shopMeta.district_id;
    const regionId = shopMeta.region_id;
    const divisionKey = divisionId;

    if (!districtId && !regionId && !divisionKey) {
      setRollups(EMPTY_ROLLUPS);
      return;
    }

    let cancelled = false;

    const loadRollups = async () => {
      try {
        const result = await fetchHierarchyRollups({
          districtId,
          regionId,
          divisionId: divisionKey ?? undefined,
          districtLabel: hierarchy?.district_name ?? null,
          regionLabel: hierarchy?.region_name ?? null,
          divisionLabel: hierarchy?.division_name ?? null,
          dailyDate: todayISO(),
          weekStart: getWeekStartISO(),
        });

        if (!cancelled) {
          setRollups(result);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Home rollups error", err);
          setRollups(EMPTY_ROLLUPS);
        }
      }
    };

    loadRollups();

    return () => {
      cancelled = true;
    };
  }, [shopMeta?.id, shopMeta?.district_id, shopMeta?.region_id, divisionId, hierarchy?.district_name, hierarchy?.region_name, hierarchy?.division_name]);

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

  const contestEndsLabel = useMemo(() => {
    if (!contestHighlight.endsOn) {
      return "Sync daily progress";
    }
    const parsed = new Date(contestHighlight.endsOn);
    if (Number.isNaN(parsed.getTime())) {
      return "Sync daily progress";
    }
    return `Ends ${parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }, [contestHighlight.endsOn]);
  const rankingHighlight = useMemo(() => {
    const reference = rollups.district ?? rollups.region ?? rollups.division ?? shopSummary;
    if (!reference) {
      return {
        eyebrow: "Leaderboards",
        primary: "View standings",
        secondary: "Shop + district rankings",
      };
    }

    const label = reference.label ?? (reference.scope === "SHOP" ? "Shop" : reference.scope ?? "Scope");
    const percentValue =
      typeof reference.weekly.big4Pct === "number" && !Number.isNaN(reference.weekly.big4Pct)
        ? `${formatPercent(reference.weekly.big4Pct)} Big 4`
        : null;
    const carsValue =
      typeof reference.weekly.cars === "number" && !Number.isNaN(reference.weekly.cars)
        ? `${formatIntegerCompact(reference.weekly.cars)} cars`
        : null;

    return {
      eyebrow: reference.scope === "SHOP" ? "Shop scope" : `${reference.scope?.toLowerCase() ?? "scope"} view`,
      primary: percentValue ?? carsValue ?? "View standings",
      secondary: `${label} standings`,
    };
  }, [rollups.district, rollups.region, rollups.division, shopSummary]);
  const heroQuickActions = useMemo<HeroQuickAction[]>(
    () => [
      {
        key: "people",
        title: "People portal",
        eyebrow: "Staffing + dev",
        primary: "Keep schedules, coaching, and training synced",
        secondary: "Scheduling • Training • Coaching",
        href: "/pocket-manager5/features/employee-scheduling",
        variant: "people",
      },
      {
        key: "ops",
        title: "OPS portal",
        eyebrow: "Operations grid",
        primary: "Checkbooks, crash kits, and alerts in one spot",
        secondary: "Mini POS • Ops hub • Alerts",
        href: "/pocket-manager5/features/ops",
        variant: "ops",
      },
      {
        key: "manager",
        title: "Manager portal",
        eyebrow: "Clipboard stack",
        primary: "Supply ordering, KPIs, and wage guardrails",
        secondary: "Clipboard • Supplies • KPIs",
        href: "/pocket-manager5/features/managers-clipboard",
        variant: "manager",
      },
      {
        key: "dm",
        title: "DM portal",
        eyebrow: "District toolkit",
        primary: "Cadence, visits, and review decks",
        secondary: "Schedules • Visits • Reviews",
        href: "/pocket-manager5/dm-tools",
        variant: "dm",
      },
      {
        key: "contest",
        title: "Contest portal",
        eyebrow: contestHighlight.activeCount ? `${contestHighlight.activeCount} live` : "Launch push",
        primary: contestHighlight.leadTitle ?? "Start a contest to push KPIs",
        secondary: contestEndsLabel,
        href: "/contests",
        variant: "contest",
      },
      {
        key: "rankings",
        title: "Rankings",
        eyebrow: rankingHighlight.eyebrow,
        primary: rankingHighlight.primary,
        secondary: rankingHighlight.secondary,
        href: "/rankings/detail",
        variant: "rankings",
      },
    ],
    [contestHighlight.activeCount, contestHighlight.leadTitle, contestEndsLabel, rankingHighlight],
  );
  const heroQuickLeftActions = useMemo(
    () => heroQuickActions.filter((action) => HERO_QUICK_LEFT_KEYS.includes(action.variant)),
    [heroQuickActions],
  );
  const heroQuickRightActions = useMemo(
    () => heroQuickActions.filter((action) => HERO_QUICK_RIGHT_KEYS.includes(action.variant)),
    [heroQuickActions],
  );
  const brandTileClasses =
    "inline-flex items-center justify-center gap-1.5 rounded-[18px] border border-white/5 bg-gradient-to-br from-[#0c1a36]/90 via-[#07142d]/90 to-[#030a18]/95 px-3 py-2 text-[10px] font-semibold text-slate-100 shadow-[0_12px_30px_rgba(1,6,20,0.75)] backdrop-blur transition hover:border-emerald-400/60 min-w-[120px]";
  const heroQuickBaseClasses =
    "relative flex min-w-[150px] max-w-[230px] flex-col gap-1 rounded-2xl border px-3 py-2 text-left text-sm shadow-[0_20px_45px_rgba(3,10,22,0.65)] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300";
  const heroQuickVariantClasses: Record<HeroQuickActionVariant, string> = {
    people: "border-emerald-400/50 bg-gradient-to-br from-emerald-500/20 via-emerald-500/5 to-[#050b1b]/90",
    ops: "border-cyan-400/50 bg-gradient-to-br from-cyan-500/20 via-cyan-500/5 to-[#050b1b]/90",
    manager: "border-amber-400/50 bg-gradient-to-br from-amber-500/20 via-amber-500/5 to-[#050b1b]/90",
    dm: "border-violet-400/50 bg-gradient-to-br from-violet-500/20 via-violet-500/5 to-[#050b1b]/90",
    contest: "border-amber-400/50 bg-gradient-to-br from-amber-500/20 via-amber-500/5 to-[#050b1b]/90",
    rankings: "border-sky-400/50 bg-gradient-to-br from-sky-500/20 via-sky-500/5 to-[#050b1b]/90",
  };
  const heroQuickScaleClasses =
    "transform-gpu scale-[0.85] hover:scale-[0.9] focus-visible:scale-[0.9] transition-transform";
  const heroQuickCtaClasses: Record<HeroQuickActionVariant, string> = {
    people: "text-emerald-200",
    ops: "text-cyan-200",
    manager: "text-amber-200",
    dm: "text-violet-200",
    contest: "text-white",
    rankings: "text-sky-200",
  };

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
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <header className="space-y-2.5">
          <div className="space-y-2.5">
            <div className="space-y-1">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                <Link
                  href="/pocket-manager5"
                  className={`${brandTileClasses} justify-self-start`}
                  aria-label="Go to Pocket Manager5"
                >
                  <BrandWordmark
                    brand="pocket"
                    mode="dark"
                    showBadge={false}
                    className="text-[1.1rem] leading-none"
                  />
                </Link>
                <div className="text-center">
                  <h1 className="text-2xl sm:text-3xl font-bold">
                    <span className="text-red-500">P</span>ocket&nbsp;Manager
                    <span className="text-red-500">5</span>
                  </h1>
                </div>
                <Link
                  href="/pulse-check5"
                  className={`${brandTileClasses} justify-self-end`}
                  aria-label="Open Pulse Check5"
                >
                  <BrandWordmark
                    brand="pulse"
                    mode="dark"
                    showBadge={false}
                    className="text-[1.1rem] leading-none"
                  />
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex flex-col items-start gap-2">
                <RetailPills />
              </div>

              <div className="flex w-full justify-start md:w-auto md:justify-end">
                <button
                  onClick={handleAuthClick}
                  className="rounded-full border border-emerald-400/80 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                >
                  {isLoggedIn ? "Logout" : "Login"}
                </button>
              </div>
            </div>
            <div className="text-left text-xs text-slate-400">
              {hierarchyLoading ? (
                <p className="text-slate-500">Loading scope…</p>
              ) : hierarchyError ? (
                <p className="text-amber-300">Scope unavailable</p>
              ) : (
                <HierarchyStamp align="left" hierarchy={hierarchy} loginEmail={loginEmail} />
              )}
            </div>
            <div className="grid w-full gap-3 pt-2 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {heroQuickLeftActions.map((action) => {
                  const ariaLabelParts = [action.title, action.primary, action.secondary].filter(Boolean);
                  const ariaLabel = ariaLabelParts.length ? ariaLabelParts.join(". ") : `Open ${action.title}`;
                  return (
                    <Link
                      key={action.key}
                      href={action.href}
                      className={`${heroQuickBaseClasses} ${heroQuickVariantClasses[action.variant]} ${heroQuickScaleClasses}`}
                      aria-label={ariaLabel}
                    >
                      <p className="text-sm font-semibold text-white">{action.title}</p>
                      <span className={`text-xs font-semibold ${heroQuickCtaClasses[action.variant]}`}>Open →</span>
                    </Link>
                  );
                })}
              </div>
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <span aria-hidden="true" className="hidden lg:block" />
                {heroQuickRightActions.map((action) => {
                  const ariaLabelParts = [action.title, action.primary, action.secondary].filter(Boolean);
                  const ariaLabel = ariaLabelParts.length ? ariaLabelParts.join(". ") : `Open ${action.title}`;
                  return (
                    <Link
                      key={action.key}
                      href={action.href}
                      className={`${heroQuickBaseClasses} ${heroQuickVariantClasses[action.variant]} ${heroQuickScaleClasses}`}
                      aria-label={ariaLabel}
                    >
                      <p className="text-sm font-semibold text-white">{action.title}</p>
                      <span className={`text-xs font-semibold ${heroQuickCtaClasses[action.variant]}`}>Open →</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </header>

        {hierarchyError && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {hierarchyError}
          </div>
        )}

        <section>
          <ExecutiveDashboard
            kpiOnClick={(label) => {
              if (label === 'Cars' && shopMeta?.id) {
                router.push(`/pulse-check5/daily/${todayISO()}#shop-${shopMeta.id}`);
              } else if (label === 'Cars') {
                router.push('/pulse-check5');
              }
            }}
          />
        </section>

      </div>
    </main>
  );
}



