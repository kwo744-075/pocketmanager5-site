"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabaseClient";
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
  | "mobil1"
  | "staffing";

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
  staffing: number | null;
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
  { key: "staffing", label: "Staffing" },
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
  staffing: 0,
};

const temperatureChips: { value: Temperature; label: string; accent: string }[] = [
  { value: "green", label: "Green", accent: "bg-emerald-400/20 text-emerald-200" },
  { value: "yellow", label: "Yellow", accent: "bg-amber-400/20 text-amber-200" },
  { value: "red", label: "Red", accent: "bg-rose-500/20 text-rose-200" },
];

const slotOrder = Object.keys(SLOT_DEFINITIONS) as TimeSlotKey[];

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
  const [loginEmail, setLoginEmail] = useState<string | null>(null);
  const [manualEmail, setManualEmail] = useState("");
  const [hierarchy, setHierarchy] = useState<HierarchyRow | null>(null);
  const [shopMeta, setShopMeta] = useState<ShopMeta | null>(null);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotStateMap>(() => buildInitialSlots());
  const [slotSnapshot, setSlotSnapshot] = useState<SlotStateMap | null>(null);
  const [dailyTotals, setDailyTotals] = useState<Totals>(EMPTY_TOTALS);
  const [weeklyTotals, setWeeklyTotals] = useState<Totals>(EMPTY_TOTALS);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingTotals, setLoadingTotals] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const queryEmail = params.get("email");
    const storedEmail = window.localStorage.getItem("loginEmail");
    const resolved = (queryEmail ?? storedEmail ?? "").trim().toLowerCase();

    if (queryEmail && resolved) {
      window.localStorage.setItem("loginEmail", resolved);
    }

    setLoginEmail(resolved || null);
  }, []);

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
        const { data, error } = await supabase
          .from("shops")
          .select("id, shop_number, shop_name, district_id, region_id")
          .eq("shop_number", numericShop)
          .limit(1)
          .maybeSingle();

        if (cancelled) {
          return;
        }

        if (error) {
          console.error("shops lookup error", error);
          setHierarchyError("Unable to map hierarchy shop to a Pulse Check shop record.");
          setShopMeta(null);
          return;
        }

        if (!data) {
          setHierarchyError("No matching shop record was found for this login.");
          setShopMeta(null);
          return;
        }

        setShopMeta(data as ShopMeta);
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
          staffing: toInputValue(row.staffing),
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
        const { data, error } = await supabase
          .from("check_ins")
          .select(
            "time_slot,cars,sales,big4,coolants,diffs,donations,mobil1,staffing,temperature,is_submitted,submitted_at"
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
      const [dailyResponse, weeklyResponse] = await Promise.all([
        supabase
          .from("shop_daily_totals")
          .select(
            "total_cars,total_sales,total_big4,total_coolants,total_diffs,total_donations,total_mobil1"
          )
          .eq("shop_id", shopId)
          .eq("check_in_date", dailyDate)
          .maybeSingle(),
        supabase
          .from("shop_wtd_totals")
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
        staffing: 0,
      });

      if (dailyResponse.error && dailyResponse.error.code !== "PGRST116") {
        throw dailyResponse.error;
      }

      if (weeklyResponse.error && weeklyResponse.error.code !== "PGRST116") {
        throw weeklyResponse.error;
      }

      setDailyTotals(buildTotals(dailyResponse.data ?? null));
      setWeeklyTotals(buildTotals(weeklyResponse.data ?? null));
    } catch (err) {
      console.error("loadTotals error", err);
      setDailyTotals(EMPTY_TOTALS);
      setWeeklyTotals(EMPTY_TOTALS);
    } finally {
      setLoadingTotals(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    if (!shopMeta?.id) {
      return;
    }
    await Promise.all([loadCheckIns(shopMeta.id), loadTotals(shopMeta.id)]);
    setStatusMessage("Data refreshed");
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

  const hasDirtyFields = useMemo(() => {
    return slotOrder.some((slot) => slots[slot].dirty);
  }, [slots]);

  const updateMetric = (slot: TimeSlotKey, key: MetricKey, value: string) => {
    setSlots((prev) => ({
      ...prev,
      [slot]: {
        ...prev[slot],
        metrics: {
          ...prev[slot].metrics,
          [key]: value,
        },
        status: prev[slot].status === "submitted" ? "submitted" : "draft",
        dirty: true,
      },
    }));
  };

  const updateTemperature = (slot: TimeSlotKey, value: Temperature) => {
    setSlots((prev) => ({
      ...prev,
      [slot]: {
        ...prev[slot],
        temperature: value,
        status: prev[slot].status === "submitted" ? "submitted" : "draft",
        dirty: true,
      },
    }));
  };

  const handleSubmit = async () => {
    if (!shopMeta?.id) {
      setStatusMessage("Missing shop mapping – cannot submit.");
      return;
    }

    const rowsPayload: CheckInRow[] = [];

    slotOrder.forEach((slotKey) => {
      const slotState = slots[slotKey];
      const hasValue = METRIC_FIELDS.some((field) => slotState.metrics[field.key].trim());

      if (!hasValue && slotState.status === "pending") {
        return;
      }

      rowsPayload.push({
        time_slot: SLOT_DEFINITIONS[slotKey].dbSlot,
        cars: toNumberValue(slotState.metrics.cars),
        sales: toNumberValue(slotState.metrics.sales),
        big4: toNumberValue(slotState.metrics.big4),
        coolants: toNumberValue(slotState.metrics.coolants),
        diffs: toNumberValue(slotState.metrics.diffs),
        donations: toNumberValue(slotState.metrics.donations),
        mobil1: toNumberValue(slotState.metrics.mobil1),
        staffing: toNumberValue(slotState.metrics.staffing),
        temperature: slotState.temperature,
        is_submitted: true,
        submitted_at: new Date().toISOString(),
      } as CheckInRow);
    });

    if (rowsPayload.length === 0) {
      setStatusMessage("Enter at least one slot before submitting.");
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const today = todayISO();
      const payload = rowsPayload.map((row) => ({
        shop_id: shopMeta.id,
        check_in_date: today,
        time_slot: row.time_slot,
        cars: row.cars ?? 0,
        sales: row.sales ?? 0,
        big4: row.big4 ?? 0,
        coolants: row.coolants ?? 0,
        diffs: row.diffs ?? 0,
        donations: row.donations ?? 0,
        mobil1: row.mobil1 ?? 0,
        staffing: row.staffing ?? 0,
        temperature: row.temperature ?? "green",
        is_submitted: true,
        status: "complete",
        submitted_at: row.submitted_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("check_ins").upsert(payload, {
        onConflict: "shop_id,check_in_date,time_slot",
      });

      if (error) {
        throw error;
      }

      setStatusMessage("Check-in saved successfully.");
      await refreshAll();
    } catch (err) {
      console.error("submit check-in error", err);
      setStatusMessage("Unable to submit check-in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    if (slotSnapshot) {
      setSlots(cloneSlots(slotSnapshot));
    } else {
      setSlots(buildInitialSlots());
    }
    setStatusMessage("Form reset to last loaded values.");
  };

  const handleManualLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = manualEmail.trim().toLowerCase();
    if (!normalized) {
      return;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem("loginEmail", normalized);
    }
    setLoginEmail(normalized);
    setManualEmail("");
  };

  const renderLoginCapture = () => (
    <form
      onSubmit={handleManualLogin}
      className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-inner shadow-black/20"
    >
      <h2 className="text-lg font-semibold text-white">Enter work login email</h2>
      <p className="mt-2 text-sm text-slate-400">We use this email to load your hierarchy scope from Supabase.</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          placeholder="you@take5.com"
          value={manualEmail}
          onChange={(event) => setManualEmail(event.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm text-white outline-none focus:border-emerald-400"
          required
        />
        <button
          type="submit"
          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-400"
        >
          Save & Load
        </button>
      </div>
    </form>
  );

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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-900/70 bg-slate-950/60 p-4 shadow-lg shadow-black/30 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <RetailPills />
          </div>
          <div className="text-center">
            <p className="text-[10px] tracking-[0.3em] uppercase text-emerald-400">Pulse Check5</p>
            <h1 className="text-xl font-semibold text-slate-50">Check-in reliability dashboard</h1>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <button
              onClick={refreshAll}
              disabled={!shopMeta?.id || busy}
              className="inline-flex items-center justify-center rounded-full border border-emerald-400/70 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
            >
              Refresh data
            </button>
            <HierarchyStamp />
          </div>
        </header>

        {!loginEmail && renderLoginCapture()}

        {hierarchyError && (
          <div className="rounded-xl border border-rose-500/50 bg-rose-900/40 px-4 py-3 text-sm text-rose-100">
            {hierarchyError}
          </div>
        )}

        {renderStatusBanner()}

        <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-inner shadow-black/30 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Scope</p>
            <h2 className="mt-1 text-lg font-semibold text-white">{scope ?? "Unknown"}</h2>
            <p className="text-sm text-slate-400">
              {hierarchy?.district_name} • {hierarchy?.region_name} • {hierarchy?.division_name}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Shop</p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {shopMeta?.shop_name ? `${shopMeta.shop_name} (#${shopMeta.shop_number ?? "?"})` : "Resolving shop…"}
            </h2>
            <p className="text-sm text-slate-400">{submissionCount} of {slotOrder.length} slots submitted today</p>
          </div>
        </section>

        <ProgressOverview submitted={submissionCount} total={slotOrder.length} loading={loadingSlots} />

        <MetricsGrid dailyTotals={dailyTotals} weeklyTotals={weeklyTotals} loading={loadingTotals} />

        <section className="space-y-4">
          {slotOrder.map((slotKey) => (
            <TimeSlotCard
              key={slotKey}
              slotKey={slotKey}
              slotState={slots[slotKey]}
              definition={SLOT_DEFINITIONS[slotKey]}
              onMetricChange={updateMetric}
              onTemperatureChange={updateTemperature}
              loading={loadingSlots}
            />
          ))}
        </section>

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 shadow-inner shadow-black/40 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-300">Need to start over? Reset reloads the last saved state.</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400"
              disabled={busy}
            >
              Reset form
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-400 disabled:opacity-50"
              disabled={busy || !shopMeta?.id || (!hasDirtyFields && submissionCount === 0)}
            >
              {submitting ? "Saving…" : "Submit check-in"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function ProgressOverview({ submitted, total, loading }: { submitted: number; total: number; loading: boolean }) {
  const percent = Math.round((submitted / total) * 100);
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between text-sm text-slate-300">
        <span>Daily check-in cadence</span>
        <span>
          {submitted}/{total} slots • {percent}%
        </span>
      </div>
      <div className="mt-3 h-3 w-full rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${loading ? 0 : percent}%` }} />
      </div>
    </section>
  );
}

function MetricsGrid({ dailyTotals, weeklyTotals, loading }: { dailyTotals: Totals; weeklyTotals: Totals; loading: boolean }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between text-sm text-slate-300">
        <span>Performance rollup</span>
        {loading && <span className="text-xs text-slate-500">Loading totals…</span>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {METRIC_FIELDS.map((field) => (
          <MetricCard key={field.key} field={field} dailyValue={dailyTotals[field.key]} weeklyValue={weeklyTotals[field.key]} />
        ))}
      </div>
    </section>
  );
}

function MetricCard({ field, dailyValue, weeklyValue }: { field: MetricField; dailyValue: number; weeklyValue: number }) {
  const format = (value: number) => {
    if (field.format === "currency") {
      return currencyFormatter.format(value);
    }
    return numberFormatter.format(value);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{field.label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{format(dailyValue)}</p>
      <p className="text-xs text-slate-400">Daily</p>
      <p className="mt-2 text-sm text-slate-300">
        <span className="font-semibold">WTD:</span> {format(weeklyValue)}
      </p>
    </div>
  );
}

function TimeSlotCard({
  slotKey,
  slotState,
  definition,
  onMetricChange,
  onTemperatureChange,
  loading,
}: {
  slotKey: TimeSlotKey;
  slotState: SlotState;
  definition: { label: string; description: string; dbSlot: string };
  onMetricChange: (slot: TimeSlotKey, key: MetricKey, value: string) => void;
  onTemperatureChange: (slot: TimeSlotKey, temp: Temperature) => void;
  loading: boolean;
}) {
  const submittedLabel = slotState.submittedAt
    ? new Date(slotState.submittedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 shadow-sm shadow-black/30">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-400">{definition.description}</p>
          <h3 className="text-xl font-semibold text-white">{definition.label}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <StatusChip status={slotState.status} submittedLabel={submittedLabel} />
          {temperatureChips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => onTemperatureChange(slotKey, chip.value)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${chip.accent} ${
                slotState.temperature === chip.value ? "opacity-100" : "opacity-50 hover:opacity-80"
              }`}
              disabled={loading}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        {METRIC_FIELDS.map((field) => (
          <label
            key={field.key}
            className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs font-semibold uppercase tracking-wide text-slate-400"
          >
            {field.label}
            <input
              type="number"
              inputMode="decimal"
              value={slotState.metrics[field.key]}
              onChange={(event) => onMetricChange(slotKey, field.key, event.target.value)}
              className="mt-2 rounded-lg border border-slate-700 bg-slate-950/40 px-2 py-1 text-base font-semibold text-white outline-none focus:border-emerald-400"
              placeholder="0"
              disabled={loading}
            />
          </label>
        ))}
      </div>
    </article>
  );
}

function StatusChip({ status, submittedLabel }: { status: SlotStatus; submittedLabel: string | null }) {
  if (status === "submitted") {
    return (
      <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold text-emerald-200">
        Submitted {submittedLabel ? `@ ${submittedLabel}` : ""}
      </span>
    );
  }

  if (status === "draft") {
    return (
      <span className="rounded-full bg-amber-400/20 px-3 py-1 text-[11px] font-semibold text-amber-200">
        Draft saved
      </span>
    );
  }

  return (
    <span className="rounded-full bg-slate-700/60 px-3 py-1 text-[11px] font-semibold text-slate-200">
      Pending entry
    </span>
  );
}
