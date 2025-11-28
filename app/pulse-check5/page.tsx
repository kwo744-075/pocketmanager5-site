"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, pulseSupabase } from "@/lib/supabaseClient";
import { RetailPills } from "@/app/components/RetailPills";
import { HierarchyStamp } from "@/app/components/HierarchyStamp";

type ScopeLevel = "SHOP" | "DISTRICT" | "REGION" | "DIVISION";

type HierarchyRow = {
  login: string;
  scope_level: ScopeLevel | null;
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

type MetricKey =
  | "cars"
  | "sales"
  | "big4"
  | "coolants"
  | "diffs"
  | "donations"
  | "mobil1";

type MetricField = {
  key: MetricKey;
  label: string;
  helper?: string;
  format?: "currency" | "number";
};

type Totals = Record<MetricKey, number>;

type TotalsRow = {
  total_cars: number | null;
  total_sales: number | null;
  total_big4: number | null;
  total_coolants: number | null;
  total_diffs: number | null;
  total_donations: number | null;
  total_mobil1: number | null;
};

type Temperature = "green" | "yellow" | "red";

type SlotStatus = "pending" | "draft" | "submitted";

type TimeSlotKey = "12:00" | "14:30" | "17:00" | "20:00";

type SlotState = {
  metrics: Record<MetricKey, string>;
  temperature: Temperature;
  status: SlotStatus;
  submittedAt: string | null;
  dirty: boolean;
};

type SlotStateMap = Record<TimeSlotKey, SlotState>;

type CheckInRow = {
  time_slot: string | null;
  cars: number | null;
  sales: number | null;
  big4: number | null;
  coolants: number | null;
  diffs: number | null;
  donations: number | null;
  mobil1: number | null;
  temperature: Temperature | null;
  is_submitted: boolean | null;
  submitted_at: string | null;
};

const METRIC_FIELDS: MetricField[] = [
  { key: "cars", label: "Cars" },
  { key: "sales", label: "Sales", format: "currency" },
  { key: "big4", label: "Big 4" },
  { key: "coolants", label: "Coolants" },
  { key: "diffs", label: "Diffs" },
  { key: "donations", label: "Donations" },
  { key: "mobil1", label: "Mobil 1" },
];

const SLOT_DEFINITIONS: Record<TimeSlotKey, { label: string; description: string; dbSlot: string }> = {
  "12:00": { label: "Noon", description: "12 PM window", dbSlot: "12pm" },
  "14:30": { label: "2:30 PM", description: "Afternoon window", dbSlot: "2:30pm" },
  "17:00": { label: "5 PM", description: "Evening window", dbSlot: "5pm" },
  "20:00": { label: "8 PM", description: "Close of business", dbSlot: "8pm" },
};

const DB_SLOT_TO_DISPLAY: Record<string, TimeSlotKey> = {
  "12pm": "12:00",
  "2:30pm": "14:30",
  "5pm": "17:00",
  "8pm": "20:00",
};

const EMPTY_TOTALS: Totals = {
  cars: 0,
  sales: 0,
  big4: 0,
  coolants: 0,
  diffs: 0,
  donations: 0,
  mobil1: 0,
};

const temperatureChips: { value: Temperature; label: string; accent: string }[] = [
  { value: "green", label: "Green", accent: "bg-emerald-400/20 text-emerald-200" },
  { value: "yellow", label: "Yellow", accent: "bg-amber-400/20 text-amber-200" },
  { value: "red", label: "Red", accent: "bg-rose-500/20 text-rose-200" },
];

const slotOrder = Object.keys(SLOT_DEFINITIONS) as TimeSlotKey[];
const EVENING_SLOTS: TimeSlotKey[] = ["17:00", "20:00"];
const SLOT_UNLOCK_RULES: Record<TimeSlotKey, { hour: number; minute: number; label: string }> = {
  "12:00": { hour: 12, minute: 0, label: "12:00 PM" },
  "14:30": { hour: 14, minute: 30, label: "2:30 PM" },
  "17:00": { hour: 17, minute: 0, label: "5:00 PM" },
  "20:00": { hour: 20, minute: 0, label: "8:00 PM" },
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-US");

const createEmptySlotState = (): SlotState => {
  const metrics = METRIC_FIELDS.reduce<Record<MetricKey, string>>((acc, field) => {
    acc[field.key] = "";
    return acc;
  }, {} as Record<MetricKey, string>);

  return {
    metrics,
    temperature: "green",
    status: "pending",
    submittedAt: null,
    dirty: false,
  };
};

const buildInitialSlots = (): SlotStateMap => {
  const slots: Partial<SlotStateMap> = {};
  slotOrder.forEach((slot) => {
    slots[slot] = createEmptySlotState();
  });
  return slots as SlotStateMap;
};

const cloneSlots = (source: SlotStateMap): SlotStateMap => {
  const next: Partial<SlotStateMap> = {};
  slotOrder.forEach((slot) => {
    const reference = source[slot];
    next[slot] = {
      ...reference,
      metrics: { ...reference.metrics },
      dirty: false,
    };
  });
  return next as SlotStateMap;
};

const createTotalsAccumulator = (): Totals => ({ ...EMPTY_TOTALS });

const buildSlotTotals = (slotMap: SlotStateMap, slotKeys: TimeSlotKey[]): Totals => {
  const totals = createTotalsAccumulator();
  slotKeys.forEach((slotKey) => {
    const slot = slotMap[slotKey];
    if (!slot || slot.status !== "submitted") {
      return;
    }
    METRIC_FIELDS.forEach((field) => {
      totals[field.key] += toNumberValue(slot.metrics[field.key]);
    });
  });
  return totals;
};

const toInputValue = (value: number | null | undefined): string => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
};

const toNumberValue = (value: string): number => {
  if (!value.trim()) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const todayISO = () => new Date().toISOString().split("T")[0];

const getWeekStartISO = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day;
  const first = new Date(now.setDate(diff));
  return first.toISOString().split("T")[0];
};

export default function PulseCheckPage() {
  const router = useRouter();
  const [loginEmail, setLoginEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [hierarchy, setHierarchy] = useState<HierarchyRow | null>(null);
  const [shopMeta, setShopMeta] = useState<ShopMeta | null>(null);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotStateMap>(() => buildInitialSlots());
  const [slotSnapshot, setSlotSnapshot] = useState<SlotStateMap | null>(null);
  const [dailyTotals, setDailyTotals] = useState<Totals>(EMPTY_TOTALS);
  const [weeklyTotals, setWeeklyTotals] = useState<Totals>(EMPTY_TOTALS);
  const [weeklyEveningTotals, setWeeklyEveningTotals] = useState<Totals>(EMPTY_TOTALS);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingTotals, setLoadingTotals] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<TimeSlotKey | null>(slotOrder[0]);
  const [eveningOnly, setEveningOnly] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const needsLogin = authChecked && !loginEmail;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const interval = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedEmail = (window.localStorage.getItem("loginEmail") ?? "").trim().toLowerCase();
    const loggedIn = window.localStorage.getItem("loggedIn") === "true";

    if (!storedEmail || !loggedIn) {
      setLoginEmail(null);
      setAuthChecked(true);
      router.replace("/login?redirect=/pulse-check5");
      return;
    }

    setLoginEmail(storedEmail);
    setAuthChecked(true);
  }, [router]);

  useEffect(() => {
    if (!loginEmail) {
      setHierarchy(null);
      setShopMeta(null);
      return;
    }

    let cancelled = false;
    setLoadingHierarchy(true);
    setHierarchyError(null);

    const fetchHierarchy = async () => {
      try {
        const { data, error } = await supabase
          .from("hierarchy_summary_vw")
          .select("*")
          .eq("login", loginEmail.toLowerCase())
          .maybeSingle();

        if (cancelled) {
          return;
        }

        if (error) {
          console.error("hierarchy_summary_vw error", error);
          setHierarchyError("Unable to load hierarchy. Please try again.");
          setHierarchy(null);
        } else if (!data) {
          setHierarchyError("No hierarchy record was found for this login email.");
          setHierarchy(null);
        } else {
          setHierarchy(data as HierarchyRow);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Pulse Check hierarchy error", err);
          setHierarchyError("Unexpected error loading hierarchy.");
        }
      } finally {
        if (!cancelled) {
          setLoadingHierarchy(false);
        }
      }
    };

    fetchHierarchy();

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
      setHierarchyError("Shop number is not a valid number in hierarchy mapping.");
      setShopMeta(null);
      return;
    }

    let cancelled = false;

    const fetchShopMetadata = async () => {
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
          setHierarchyError(null);
          setShopMeta(resolved);
          return;
        }

        if (lastError) {
          console.error("shops lookup error", lastError);
          setHierarchyError("Unable to map your shop right now. Please refresh in a bit.");
        } else {
          setHierarchyError("This login isn't linked to a Pulse Check shop yet. Ask your admin to enable it.");
        }
        setShopMeta(null);
      } catch (err) {
        if (!cancelled) {
          console.error("Shop metadata error", err);
          setHierarchyError("Unexpected error resolving shop metadata.");
          setShopMeta(null);
        }
      }
    };

    fetchShopMetadata();

    return () => {
      cancelled = true;
    };
  }, [hierarchy]);

  const hydrateSlotsFromRows = useCallback((rows: CheckInRow[]): SlotStateMap => {
    const next = buildInitialSlots();

    rows.forEach((row) => {
      if (!row.time_slot) {
        return;
      }

      const slotKey = DB_SLOT_TO_DISPLAY[row.time_slot];
      if (!slotKey) {
        return;
      }

      next[slotKey] = {
        metrics: {
          cars: toInputValue(row.cars),
          sales: toInputValue(row.sales),
          big4: toInputValue(row.big4),
          coolants: toInputValue(row.coolants),
          diffs: toInputValue(row.diffs),
          donations: toInputValue(row.donations),
          mobil1: toInputValue(row.mobil1),
        },
        temperature: row.temperature ?? "green",
        status: row.is_submitted ? "submitted" : "draft",
        submittedAt: row.submitted_at,
        dirty: false,
      };
    });

    return next;
  }, []);

  const loadCheckIns = useCallback(
    async (shopId: string) => {
      setLoadingSlots(true);
      try {
        const { data, error } = await pulseSupabase
          .from("check_ins")
          .select(
            "time_slot,cars,sales,big4,coolants,diffs,donations,mobil1,temperature,is_submitted,submitted_at"
          )
          .eq("shop_id", shopId)
          .eq("check_in_date", todayISO());

        if (error) {
          throw error;
        }

        const rows = (data ?? []) as CheckInRow[];
        const hydrated = hydrateSlotsFromRows(rows);
        setSlots(hydrated);
        setSlotSnapshot(cloneSlots(hydrated));
      } catch (err) {
        console.error("loadCheckIns error", err);
        setStatusMessage("Unable to load check-ins right now.");
      } finally {
        setLoadingSlots(false);
      }
    },
    [hydrateSlotsFromRows]
  );

  const loadTotals = useCallback(async (shopId: string) => {
    setLoadingTotals(true);
    const dailyDate = todayISO();
    const weekStart = getWeekStartISO();

    try {
      const [dailyResponse, weeklyResponse, weeklyEveningResponse] = await Promise.all([
        pulseSupabase
          .from("shop_daily_totals")
          .select(
            "total_cars,total_sales,total_big4,total_coolants,total_diffs,total_donations,total_mobil1"
          )
          .eq("shop_id", shopId)
          .eq("check_in_date", dailyDate)
          .maybeSingle(),
        pulseSupabase
          .from("shop_wtd_totals")
          .select(
            "total_cars,total_sales,total_big4,total_coolants,total_diffs,total_donations,total_mobil1"
          )
          .eq("shop_id", shopId)
          .eq("week_start", weekStart)
          .order("current_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
        pulseSupabase
          .from("shop_wtd_evening_totals")
          .select(
            "total_cars,total_sales,total_big4,total_coolants,total_diffs,total_donations,total_mobil1"
          )
          .eq("shop_id", shopId)
          .eq("week_start", weekStart)
          .order("current_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const buildTotals = (row: TotalsRow | null): Totals => ({
        cars: row?.total_cars ?? 0,
        sales: row?.total_sales ?? 0,
        big4: row?.total_big4 ?? 0,
        coolants: row?.total_coolants ?? 0,
        diffs: row?.total_diffs ?? 0,
        donations: row?.total_donations ?? 0,
        mobil1: row?.total_mobil1 ?? 0,
      });

      if (dailyResponse.error && dailyResponse.error.code !== "PGRST116") {
        throw dailyResponse.error;
      }

      if (weeklyResponse.error && weeklyResponse.error.code !== "PGRST116") {
        throw weeklyResponse.error;
      }

      if (weeklyEveningResponse.error && weeklyEveningResponse.error.code !== "PGRST116") {
        throw weeklyEveningResponse.error;
      }

      setDailyTotals(buildTotals(dailyResponse.data ?? null));
      setWeeklyTotals(buildTotals(weeklyResponse.data ?? null));
      setWeeklyEveningTotals(buildTotals(weeklyEveningResponse.data ?? null));
    } catch (err) {
      console.error("loadTotals error", err);
      setDailyTotals(EMPTY_TOTALS);
      setWeeklyTotals(EMPTY_TOTALS);
      setWeeklyEveningTotals(EMPTY_TOTALS);
    } finally {
      setLoadingTotals(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    if (!shopMeta?.id) {
      return;
    }
    await Promise.all([loadCheckIns(shopMeta.id), loadTotals(shopMeta.id)]);
    setStatusMessage(null);
  }, [loadCheckIns, loadTotals, shopMeta?.id]);

  useEffect(() => {
    if (!shopMeta?.id) {
      return;
    }
    refreshAll();
  }, [shopMeta?.id, refreshAll]);

  const scope = hierarchy?.scope_level?.toUpperCase() as ScopeLevel | undefined;
  const submissionCount = useMemo(() => {
    return slotOrder.filter((slot) => slots[slot].status === "submitted").length;
  }, [slots]);

  const computeDirtyFlag = useCallback(
    (slotKey: TimeSlotKey, candidate: SlotState) => {
      const reference = slotSnapshot?.[slotKey];
      if (!reference) {
        const hasMetrics = METRIC_FIELDS.some((field) => candidate.metrics[field.key].trim() !== "");
        return hasMetrics || candidate.temperature !== "green";
      }
      const metricsChanged = METRIC_FIELDS.some(
        (field) => candidate.metrics[field.key] !== reference.metrics[field.key]
      );
      const temperatureChanged = candidate.temperature !== reference.temperature;
      return metricsChanged || temperatureChanged;
    },
    [slotSnapshot]
  );

  const hasDirtyFields = useMemo(() => {
    return slotOrder.some((slot) => slots[slot]?.dirty);
  }, [slots]);

  const isSlotUnlocked = useCallback(
    (slotKey: TimeSlotKey) => {
      const rule = SLOT_UNLOCK_RULES[slotKey];
      if (!rule) {
        return true;
      }
      const unlock = new Date();
      unlock.setHours(rule.hour, rule.minute, 0, 0);
      return clock >= unlock.getTime();
    },
    [clock]
  );

  const slotUnlockedMap = useMemo(() => {
    return slotOrder.reduce<Record<TimeSlotKey, boolean>>((acc, slotKey) => {
      acc[slotKey] = isSlotUnlocked(slotKey);
      return acc;
    }, {} as Record<TimeSlotKey, boolean>);
  }, [isSlotUnlocked]);

  const eveningSlotTotals = useMemo(() => buildSlotTotals(slots, EVENING_SLOTS), [slots]);

  const resolvedDailyTotals = useMemo(
    () => (eveningOnly ? eveningSlotTotals : dailyTotals),
    [eveningOnly, eveningSlotTotals, dailyTotals]
  );

  const resolvedWeeklyTotals = useMemo(
    () => (eveningOnly ? weeklyEveningTotals : weeklyTotals),
    [eveningOnly, weeklyEveningTotals, weeklyTotals]
  );

  const rollupLoading = loadingTotals || (eveningOnly && loadingSlots);

  const slotChoices = slotOrder;

  useEffect(() => {
    if (activeSlot && slotUnlockedMap[activeSlot]) {
      return;
    }
    const firstUnlocked = slotChoices.find((slot) => slotUnlockedMap[slot]);
    if (firstUnlocked && firstUnlocked !== activeSlot) {
      setActiveSlot(firstUnlocked);
    }
  }, [activeSlot, slotChoices, slotUnlockedMap]);

  const resolvedSlotKey =
    activeSlot && slotChoices.includes(activeSlot) ? activeSlot : slotChoices[0];
  const currentSlotKey = resolvedSlotKey ?? slotOrder[0];
  const currentSlotState = slots[currentSlotKey] ?? createEmptySlotState();
  const currentDefinition = SLOT_DEFINITIONS[currentSlotKey];
  const currentSlotLocked = !slotUnlockedMap[currentSlotKey];

  const updateMetric = useCallback(
    (slotKey: TimeSlotKey, key: MetricKey, value: string) => {
      setSlots((prev) => {
        const existing = prev[slotKey] ?? createEmptySlotState();
        const nextSlot: SlotState = {
          ...existing,
          metrics: {
            ...existing.metrics,
            [key]: value,
          },
          status: existing.status === "submitted" ? "draft" : existing.status,
        };
        nextSlot.dirty = computeDirtyFlag(slotKey, nextSlot);
        return {
          ...prev,
          [slotKey]: nextSlot,
        };
      });
    },
    [computeDirtyFlag]
  );

  const updateTemperature = useCallback(
    (slotKey: TimeSlotKey, temp: Temperature) => {
      setSlots((prev) => {
        const existing = prev[slotKey] ?? createEmptySlotState();
        const nextSlot: SlotState = {
          ...existing,
          temperature: temp,
          status: existing.status === "submitted" ? "draft" : existing.status,
        };
        nextSlot.dirty = computeDirtyFlag(slotKey, nextSlot);
        return {
          ...prev,
          [slotKey]: nextSlot,
        };
      });
    },
    [computeDirtyFlag]
  );

  const handleReset = useCallback(() => {
    if (slotSnapshot) {
      setSlots(cloneSlots(slotSnapshot));
    } else {
      setSlots(buildInitialSlots());
    }
    setStatusMessage("Form reset");
  }, [slotSnapshot]);

  const handleSubmit = useCallback(async () => {
    if (!shopMeta?.id) {
      setStatusMessage("Resolve your shop before submitting.");
      return;
    }

    const slotState = currentSlotState;
    const submittedAt = new Date().toISOString();
    const payload = {
      shop_id: shopMeta.id,
      check_in_date: todayISO(),
      time_slot: currentDefinition.dbSlot,
      cars: toNumberValue(slotState.metrics.cars),
      sales: toNumberValue(slotState.metrics.sales),
      big4: toNumberValue(slotState.metrics.big4),
      coolants: toNumberValue(slotState.metrics.coolants),
      diffs: toNumberValue(slotState.metrics.diffs),
      donations: toNumberValue(slotState.metrics.donations),
      mobil1: toNumberValue(slotState.metrics.mobil1),
      temperature: slotState.temperature,
      is_submitted: true,
      submitted_at: submittedAt,
    };

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const { error } = await pulseSupabase
        .from("check_ins")
        .upsert(payload, { onConflict: "shop_id,check_in_date,time_slot" });

      if (error) {
        throw error;
      }

      setSlots((prev) => {
        const next = { ...prev };
        next[currentSlotKey] = {
          ...slotState,
          status: "submitted",
          submittedAt,
          dirty: false,
        };
        return next;
      });

      setSlotSnapshot((prev) => {
        const base = prev ? { ...prev } : buildInitialSlots();
        base[currentSlotKey] = {
          ...slotState,
          status: "submitted",
          submittedAt,
          dirty: false,
        };
        return base;
      });

      setStatusMessage(`${currentDefinition.label} slot submitted`);
      await loadTotals(shopMeta.id);
    } catch (err) {
      console.error("handleSubmit error", err);
      setStatusMessage("Unable to submit slot right now.");
    } finally {
      setSubmitting(false);
    }
  }, [shopMeta?.id, currentSlotKey, currentSlotState, currentDefinition, loadTotals]);

  const renderStatusBanner = () => {
    if (!statusMessage) {
      return null;
    }
    return (
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
        {statusMessage}
      </div>
    );
  };

  const busy = loadingHierarchy || loadingSlots || loadingTotals || submitting;
  if (!authChecked) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">Checking your Pulse Check access…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-3 py-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-4">
            <header className="space-y-3 rounded-3xl border border-slate-900/70 bg-slate-950/70 p-3 shadow-2xl shadow-black/40">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <p className="text-[9px] tracking-[0.3em] uppercase text-emerald-400">Pulse Check5</p>
                  <h1 className="text-lg font-semibold text-white">Live KPI Board</h1>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                  <Image src="/window.svg" alt="Pulse Check" width={90} height={28} priority />
                  <HierarchyStamp />
                </div>
              </div>
              <ShopMicroCard
                scopeLabel={scope ?? "Resolve scope"}
                hierarchy={hierarchy}
                shopMeta={shopMeta}
                submissionCount={submissionCount}
                totalSlots={slotOrder.length}
                loading={loadingSlots}
              />
              <div className="flex flex-wrap items-start gap-4 text-[10px] text-slate-400">
                <div className="flex flex-col gap-1 text-left">
                  <RetailPills />
                  <button
                    onClick={refreshAll}
                    disabled={!shopMeta?.id || busy}
                    className="inline-flex w-fit items-center justify-center rounded-full border border-emerald-400/70 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
                  >
                    Refresh data
                  </button>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-slate-800/70 bg-slate-900/60 px-3 py-1 text-[9px] uppercase tracking-wide text-slate-400">
                  <span>5-8 only</span>
                  <ToggleSwitch checked={eveningOnly} onChange={setEveningOnly} />
                </div>
              </div>
            </header>

            <MetricsGrid
              dailyTotals={resolvedDailyTotals}
              weeklyTotals={resolvedWeeklyTotals}
              loading={rollupLoading}
              viewLabel={eveningOnly ? "5-8 PM submitted slots" : "All-day performance"}
            />

            <ContestPanel />
          </div>

          <aside className="w-full max-w-[15rem] justify-self-center">
            <div className="space-y-3 rounded-3xl border border-emerald-700/30 bg-slate-950/90 p-4 shadow-2xl shadow-black/50">
              <div>
                <p className="text-[9px] uppercase tracking-[0.3em] text-emerald-300">Field check-ins</p>
              </div>

              {needsLogin ? (
                <LoginPrompt />
              ) : (
                <div className="space-y-4">
                  {hierarchyError && (
                    <div className="rounded-xl border border-rose-500/50 bg-rose-900/40 px-3 py-2 text-xs text-rose-100">
                      {hierarchyError}
                    </div>
                  )}
                  {renderStatusBanner()}

                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Select slot</p>
                    <div className="grid grid-cols-2 gap-1">
                      {slotChoices.map((slotKey) => {
                        const unlocked = slotUnlockedMap[slotKey];
                        return (
                        <button
                          key={slotKey}
                          type="button"
                          onClick={() => {
                              if (unlocked) {
                              setActiveSlot(slotKey);
                            }
                          }}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                            currentSlotKey === slotKey
                              ? "bg-emerald-500 text-emerald-900"
                                : unlocked
                                ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                                : "bg-slate-900/60 text-slate-500"
                          }`}
                          disabled={loadingSlots || !unlocked}
                          title={unlocked ? undefined : `Locked until ${SLOT_UNLOCK_RULES[slotKey]?.label ?? "unlock"}`}
                        >
                          {SLOT_DEFINITIONS[slotKey].label}
                        </button>
                        );
                      })}
                    </div>
                  </div>

                  <SlotForm
                    slotKey={currentSlotKey}
                    slotState={currentSlotState}
                    definition={currentDefinition}
                    onMetricChange={updateMetric}
                    onTemperatureChange={updateTemperature}
                    loading={loadingSlots}
                    locked={currentSlotLocked}
                    compact
                  />

                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="rounded-xl border border-slate-600 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-400"
                      disabled={busy}
                    >
                      Reset form
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="rounded-xl bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-400 disabled:opacity-50"
                      disabled={busy || !shopMeta?.id || currentSlotLocked || (!hasDirtyFields && submissionCount === 0)}
                    >
                      {submitting ? "Saving…" : "Submit check-in"}
                    </button>
                  </div>

                  <RankingsPanel compact href="/rankings/detail" />
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function ShopMicroCard({
  scopeLabel,
  hierarchy,
  shopMeta,
  submissionCount,
  totalSlots,
  loading,
}: {
  scopeLabel: string;
  hierarchy: HierarchyRow | null;
  shopMeta: ShopMeta | null;
  submissionCount: number;
  totalSlots: number;
  loading: boolean;
}) {
  const shopLabel = shopMeta?.shop_name
    ? `${shopMeta.shop_name} (#${shopMeta.shop_number ?? "?"})`
    : hierarchy?.shop_number
    ? `Shop #${hierarchy.shop_number}`
    : "Resolving shop…";

  const locationLabel = [hierarchy?.district_name, hierarchy?.region_name]
    .filter(Boolean)
    .join(" • ") || "Update hierarchy mapping";

  const percent = totalSlots === 0 ? 0 : Math.round((submissionCount / totalSlots) * 100);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-[10px] text-slate-300">
      <div className="flex-1 min-w-[180px]">
        <p className="text-[8px] uppercase tracking-[0.35em] text-emerald-400">{scopeLabel}</p>
        <p className="text-base font-semibold text-white">{shopLabel}</p>
        <p className="text-[10px] text-slate-400">{locationLabel}</p>
      </div>
      <div className="min-w-[140px] flex-1">
        <div className="flex items-center justify-between text-[9px] uppercase tracking-wide text-slate-500">
          <span>Daily cadence</span>
          <span className="text-xs font-semibold text-white">
            {submissionCount}/{totalSlots}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${loading ? 0 : percent}%` }}
          />
        </div>
        <p className="mt-1 text-[9px] text-slate-500">{percent}% of slots submitted</p>
      </div>
    </div>
  );
}

function MetricsGrid({
  dailyTotals,
  weeklyTotals,
  loading,
  viewLabel,
}: {
  dailyTotals: Totals;
  weeklyTotals: Totals;
  loading: boolean;
  viewLabel: string;
}) {
  return (
    <section className="space-y-1.5 rounded-2xl border border-slate-800 bg-slate-900/40 p-1.5 text-center text-[10px]">
      <div className="space-y-0.5">
        <p className="text-slate-300 text-sm font-semibold">Performance rollup</p>
        {loading && <p className="text-[10px] text-slate-500">Loading totals…</p>}
        <p className="text-[10px] text-slate-500">{viewLabel}</p>
      </div>
      <div className="mx-auto grid max-w-2xl gap-1.5 sm:grid-cols-2">
        {METRIC_FIELDS.map((field) => (
          <MetricCard
            key={field.key}
            field={field}
            dailyValue={dailyTotals[field.key]}
            weeklyValue={weeklyTotals[field.key]}
          />
        ))}
      </div>
    </section>
  );
}

function MetricCard({
  field,
  dailyValue,
  weeklyValue,
}: {
  field: MetricField;
  dailyValue: number;
  weeklyValue: number;
}) {
  const format = (value: number) => {
    if (field.format === "currency") {
      return currencyFormatter.format(value);
    }
    return numberFormatter.format(value);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-1.5 text-center">
      <p className="text-[8px] uppercase tracking-wide text-slate-500">{field.label}</p>
      <p className="mt-1 text-base font-semibold text-white">{format(dailyValue)}</p>
      <p className="text-[9px] text-slate-400">Daily</p>
      <p className="mt-1 text-[10px] text-slate-300">
        <span className="font-semibold">WTD:</span> {format(weeklyValue)}
      </p>
    </div>
  );
}

function RankingsPanel({ compact = false, href }: { compact?: boolean; href?: string }) {
  const sample = [
    { label: "Cars leader", value: "Baton Rouge South", detail: "128 cars" },
    { label: "Sales leader", value: "Gulf Coast", detail: "$42K" },
    { label: "Mobil 1 leader", value: "#18 Uptown", detail: "46 units" },
  ];

  const body = (
    <section
      className={`rounded-3xl border border-slate-900 bg-slate-950/70 shadow-inner shadow-black/30 transition ${
        compact ? "p-3 text-[10px]" : "p-5"
      } ${href ? "hover:border-emerald-500/40" : ""}`}
    >
      <h3 className={`${compact ? "text-base" : "text-lg"} font-semibold text-white`}>
        Rankings snapshot
      </h3>
      <p className={`${compact ? "text-[9px]" : "text-xs"} text-slate-400`}>
        Live data coming soon – placeholder Pulse KPI leaders.
      </p>
      <ul className={`mt-3 space-y-1.5 ${compact ? "text-[11px]" : "text-sm"}`}>
        {sample.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/50 px-3 py-2"
          >
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">{row.label}</p>
              <p className="font-semibold text-white">{row.value}</p>
            </div>
            <span className="text-xs text-emerald-300">{row.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        aria-label="Open detailed rankings"
      >
        {body}
      </Link>
    );
  }

  return body;
}

function ContestPanel() {
  const contests = [
    { name: "Mobil 1 push", status: "Week 3 of 4", metric: "122% to plan" },
    { name: "Big 4 blitz", status: "175 stores participating", metric: "+8% WoW" },
  ];

  return (
    <section className="rounded-3xl border border-slate-900 bg-slate-950/70 p-5 shadow-inner shadow-black/30">
      <h3 className="text-lg font-semibold text-white">Contest trackers</h3>
      <p className="text-xs text-slate-400">Drive focus to current incentives and weekly pushes.</p>
      <div className="mt-4 space-y-3 text-sm">
        {contests.map((contest) => (
          <div key={contest.name} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-[11px] uppercase tracking-wide text-amber-300">{contest.name}</p>
            <p className="text-slate-300">{contest.status}</p>
            <p className="text-sm font-semibold text-white">{contest.metric}</p>
          </div>
        ))}
      </div>
    </section>
  );
}


function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full border border-slate-600 transition ${
        checked ? "bg-emerald-500 border-emerald-400" : "bg-slate-800"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
          checked ? "translate-x-4" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function SlotForm({
  slotKey,
  slotState,
  definition,
  onMetricChange,
  onTemperatureChange,
  loading,
  compact,
  locked,
}: {
  slotKey: TimeSlotKey;
  slotState: SlotState;
  definition: { label: string; description: string; dbSlot: string };
  onMetricChange: (slot: TimeSlotKey, key: MetricKey, value: string) => void;
  onTemperatureChange: (slot: TimeSlotKey, temp: Temperature) => void;
  loading: boolean;
  compact?: boolean;
  locked?: boolean;
}) {
  const submittedLabel = slotState.submittedAt
    ? new Date(slotState.submittedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;
  const unlockLabel = SLOT_UNLOCK_RULES[slotKey]?.label ?? definition.label;
  const subLabelClass = compact ? "text-[9px]" : "text-[10px]";
  const headingSize = compact ? "text-sm" : "text-base";
  const temperatureText = compact ? "text-[9px]" : "text-[10px]";
  const inputText = compact ? "text-xs" : "text-sm";
  const spacing = compact ? "space-y-2 p-2" : "space-y-4 p-3";
  const gridGap = compact ? "gap-1.5" : "gap-2";

  return (
    <div className={`${spacing} rounded-2xl border border-slate-800 bg-slate-900/70`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`${subLabelClass} uppercase tracking-wide text-slate-400`}>{definition.description}</p>
          <h3 className={`${headingSize} font-semibold text-white`}>{definition.label}</h3>
        </div>
        <StatusChip status={slotState.status} submittedLabel={submittedLabel} />
      </div>
      {locked && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-200">
          Slot locked until {unlockLabel}. Check back later.
        </div>
      )}
      <div className={`flex flex-wrap gap-1 ${temperatureText}`}>
        {temperatureChips.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => onTemperatureChange(slotKey, chip.value)}
            className={`rounded-full px-2.5 py-0.5 font-semibold transition ${chip.accent} ${
              slotState.temperature === chip.value ? "opacity-100" : "opacity-50 hover:opacity-80"
            }`}
            disabled={loading || locked}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <div className={`grid ${gridGap} sm:grid-cols-2`}>
        {METRIC_FIELDS.map((field) => (
          <label
            key={field.key}
            className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400"
          >
            {field.label}
            <input
              type="number"
              inputMode="decimal"
              value={slotState.metrics[field.key]}
              onChange={(event) => onMetricChange(slotKey, field.key, event.target.value)}
              className={`mt-1 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1 ${inputText} font-semibold text-white outline-none focus:border-emerald-400`}
              placeholder="0"
              disabled={loading || locked}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function StatusChip({ status, submittedLabel }: { status: SlotStatus; submittedLabel: string | null }) {
  if (status === "submitted") {
    return (
      <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-semibold text-emerald-200">
        Submitted {submittedLabel ? `@ ${submittedLabel}` : ""}
      </span>
    );
  }

  if (status === "draft") {
    return (
      <span className="rounded-full bg-amber-400/20 px-3 py-1 text-[10px] font-semibold text-amber-200">
        Draft saved
      </span>
    );
  }

  return (
    <span className="rounded-full bg-slate-800 px-3 py-1 text-[10px] font-semibold text-slate-200">
      Pending entry
    </span>
  );
}

function LoginPrompt() {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-center text-sm text-slate-300">
      <p>Sign in to Pocket Manager5 to submit Pulse Check slots on the web.</p>
      <Link
        href="/login"
        className="mt-3 inline-flex items-center justify-center rounded-full border border-emerald-400/70 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
      >
        Go to login
      </Link>
    </div>
  );
}
