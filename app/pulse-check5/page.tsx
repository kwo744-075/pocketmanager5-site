"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { supabase, pulseSupabase } from "@/lib/supabaseClient";
import { getCachedSummaryForLogin, normalizeLogin, writeHierarchySummaryCache } from "@/lib/hierarchyCache";
import { RetailPills } from "@/app/components/RetailPills";
import Chip from "@/app/components/Chip";
import { ShopPulseBanner, type BannerMetric } from "@/app/components/ShopPulseBanner";
import { buildRetailTimestampLabel } from "@/lib/retailTimestamp";

type AlignmentRow = {
  store: number | string | null;
  shop_name?: string | null;
};

type AlignmentQueryResult = {
  data: AlignmentRow[] | null;
  error: { code?: string } | null;
};

const CHECKIN_SIM_TEST_URL =
  "https://okzgxhennmjmvcnnzyur.supabase.co/storage/v1/object/sign/test-data%20Gulf/Checkins%20Test%20Sheet%20Master..xlsx?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iYmNkZTQ0OC0zMDkxLTRlOTMtYjY4Ni0yMDljYzYyZjEwODAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ0ZXN0LWRhdGEgR3VsZi9DaGVja2lucyBUZXN0IFNoZWV0IE1hc3Rlci4ueGxzeCIsImlhdCI6MTc2NDU2Njg2OCwiZXhwIjoxNzk2MTAyODY4fQ.W7kvJi2M_Y4KrernR0CzNTdkUwRkN7a10JQobCGun2k" as const;

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
  | "fuelFilters"
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
  total_fuel_filters: number | null;
  total_donations: number | null;
  total_mobil1: number | null;
  district_id?: string | null;
  region_id?: string | null;
  current_date?: string | null;
  district_name?: string | null;
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

type ShopGridSlice = {
  cars: number;
  sales: number;
  aro: number | null;
  big4Pct: number | null;
  coolantsPct: number | null;
  diffsPct: number | null;
  fuelFiltersPct: number | null;
  mobil1Pct: number | null;
  donations: number;
};

type ShopTotalsRow = {
  shop_id: string;
  total_cars: number | null;
  total_sales: number | null;
  total_big4: number | null;
  total_coolants: number | null;
  total_diffs: number | null;
  total_fuel_filters: number | null;
  total_donations: number | null;
  total_mobil1: number | null;
  district_name?: string | null;
};

type DistrictGridRow = {
  id: string;
  label: string;
  descriptor: string;
  kind: "district" | "shop" | "region";
  isCurrentShop?: boolean;
  metrics: Record<TrendKpiKey, string>;
};

type DistrictScopeOption = {
  key: string;
  type: "district" | "region";
  label: string;
  helper?: string | null;
  districtId?: string | null;
  regionId?: string | null;
  alignmentDistrictName?: string | null;
};

type CheckInRow = {
  shop_id?: string | null;
  check_in_date?: string | null;
  time_slot: string | null;
  cars: number | null;
  sales: number | null;
  big4: number | null;
  coolants: number | null;
  diffs: number | null;
  fuel_filters?: number | null;
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
  { key: "fuelFilters", label: "FF" },
  { key: "donations", label: "Donations", format: "currency" },
  { key: "mobil1", label: "Mobil 1" },
];

const METRIC_FORMAT_LOOKUP: Record<MetricKey, MetricField["format"] | undefined> = METRIC_FIELDS.reduce(
  (acc, field) => {
    acc[field.key] = field.format;
    return acc;
  },
  {} as Record<MetricKey, MetricField["format"] | undefined>,
);

type SimSlotEntry = {
  slot: TimeSlotKey;
  metrics: Partial<Record<MetricKey, string>>;
  temperature?: Temperature;
  shopNumber?: number | null;
};

type SimRowIssue = {
  row: number;
  message: string;
};

const SIM_SLOT_HEADER_ALIASES = ["slot", "time slot", "timeslot", "window", "time", "slot label"] as const;
const SIM_TEMPERATURE_ALIASES = ["temp", "temperature", "floor temp", "floor temperature"] as const;
const SIM_SHOP_HEADER_ALIASES = [
  "shop",
  "shop #",
  "shop number",
  "store",
  "store #",
  "store number",
  "location",
  "location #",
] as const;

const METRIC_HEADER_ALIASES: Record<MetricKey, string[]> = {
  cars: ["cars", "car count", "# cars"],
  sales: ["sales", "revenue", "$ sales", "sales $"],
  big4: ["big4", "big 4"],
  coolants: ["coolants", "coolant"],
  diffs: ["diffs", "differentials", "diff"],
  fuelFilters: ["fuel filters", "fuel filter", "ff"],
  donations: ["donations", "donation", "charity"],
  mobil1: ["mobil1", "mobil 1", "m1"],
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitWithCancellation = async (controller: { cancelled: boolean }, duration: number) => {
  const step = 500;
  let elapsed = 0;
  while (elapsed < duration && !controller.cancelled) {
    const next = Math.min(step, duration - elapsed);
    await wait(next);
    elapsed += next;
  }
};

const normalizeCellString = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }
  return "";
};

const escapeLikePattern = (value: string) => value.replace(/[\\%_]/g, "\\$&");

// Query alignment rows from the canonical `company_alignment` table,
// falling back to the legacy `shop_alignment` table when needed.
const fetchAlignmentRows = async (
  column: string,
  op: "eq" | "ilike",
  value: string,
  limit?: number,
) => {
  const selectCols = "store,shop_name";
  const order = { ascending: true } as const;

  const runQuery = async (table: string): Promise<AlignmentQueryResult> => {
    try {
      if (op === "eq") {
        const q = supabase.from(table).select(selectCols).eq(column, value).order("store", order);
        if (limit) (q as unknown as { limit?: (n: number) => unknown }).limit?.(limit);
        return await q;
      }

      const q = supabase.from(table).select(selectCols).ilike(column, value).order("store", order);
      if (limit) (q as unknown as { limit?: (n: number) => unknown }).limit?.(limit);
      return await q;
    } catch (err) {
      return {
        data: null,
        error: err && typeof err === "object" ? (err as { code?: string }) : { code: undefined },
      };
    }
  };

  let result = await runQuery("company_alignment");
  const errCode = result?.error?.code;
  if ((result?.error || !result?.data) && errCode !== "PGRST116") {
    // try fallback
    result = await runQuery("shop_alignment");
  }
  return result;
};

const normalizeSheetRow = (row: Record<string, unknown>): Record<string, unknown> => {
  return Object.entries(row).reduce<Record<string, unknown>>((acc, [key, cell]) => {
    if (typeof key === "string") {
      const normalizedKey = key.trim().toLowerCase();
      if (normalizedKey) {
        acc[normalizedKey] = cell;
      }
    }
    return acc;
  }, {} as Record<string, unknown>);
};

const pickAliasValue = (row: Record<string, unknown>, aliases: readonly string[]) => {
  for (const alias of aliases) {
    if (alias in row) {
      const value = row[alias];
      if (value !== undefined && value !== null && normalizeCellString(value) !== "") {
        return value;
      }
    }
  }
  return null;
};

const parseNumericCell = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "").trim();
    if (!cleaned) {
      return null;
    }
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseShopNumber = (value: unknown): number | null => {
  const numeric = parseNumericCell(value);
  if (numeric === null) {
    return null;
  }
  const rounded = Math.round(numeric);
  return Number.isFinite(rounded) ? rounded : null;
};

const temperatureMap: Record<string, Temperature> = {
  green: "green",
  yellow: "yellow",
  red: "red",
};

const resolveTemperatureFromValue = (value: unknown): Temperature | null => {
  const text = normalizeCellString(value).toLowerCase();
  if (!text) {
    return null;
  }
  const direct = temperatureMap[text];
  if (direct) {
    return direct;
  }
  if (text.startsWith("g")) return "green";
  if (text.startsWith("y")) return "yellow";
  if (text.startsWith("r")) return "red";
  return null;
};

const resolveSlotKeyFromValue = (value: unknown): TimeSlotKey | null => {
  const text = normalizeCellString(value).toLowerCase();
  if (!text) return null;

  // Common textual matches
  if (/(noon|12\s*:?(00)?\s*(pm)?|lunch)/.test(text)) return "12:00";
  if (/(2[:.]?30|14[:.]?30|afternoon|midday)/.test(text)) return "14:30";
  if (/(5\s*pm|17[:.]?00|evening)/.test(text)) return "17:00";
  if (/(8\s*pm|20[:.]?00|close|closing)/.test(text)) return "20:00";

  // Numeric / ordinal / shorthand slot identifiers (1..4, slot 1, s1, 1st)
  const numericMatch = text.match(/(?:^|\b)(?:slot|s|window|timeslot|shift)?\s*#?\s*([1-4])(st|nd|rd|th)?(?:\b|$)/);
  if (numericMatch && numericMatch[1]) {
    const idx = Number(numericMatch[1]);
    switch (idx) {
      case 1:
        return "12:00";
      case 2:
        return "14:30";
      case 3:
        return "17:00";
      case 4:
        return "20:00";
      default:
        return null;
    }
  }

  // Bare numbers like "1", "2" on their own
  const bareNum = text.match(/^([1-4])$/);
  if (bareNum && bareNum[1]) {
    const idx = Number(bareNum[1]);
    if (idx === 1) return "12:00";
    if (idx === 2) return "14:30";
    if (idx === 3) return "17:00";
    if (idx === 4) return "20:00";
  }

  return null;
};


const buildSimEntriesFromRows = (
  rows: Record<string, unknown>[],
  targetShopNumber: number | null,
  sheetName?: string | null,
): { entries: SimSlotEntry[]; issues: SimRowIssue[] } => {
  const entries: SimSlotEntry[] = [];
  const issues: SimRowIssue[] = [];

  rows.forEach((rawRow, index) => {
    const rowNumber = index + 2; // account for header row
    const row = normalizeSheetRow(rawRow);
    const slotValue = pickAliasValue(row, SIM_SLOT_HEADER_ALIASES);
    let slot = resolveSlotKeyFromValue(slotValue);
    // If the row doesn't include a slot label, try inferring from the sheet name.
    if (!slot && sheetName) {
      slot = resolveSlotKeyFromValue(sheetName);
    }
    if (!slot) {
      issues.push({ row: rowNumber, message: "Missing or unrecognized slot label" });
      return;
    }

    const rowShopNumber = parseShopNumber(pickAliasValue(row, SIM_SHOP_HEADER_ALIASES));
    if (targetShopNumber && rowShopNumber && rowShopNumber !== targetShopNumber) {
      return;
    }

    const metrics: Partial<Record<MetricKey, string>> = {};
    let hasMetric = false;
    METRIC_FIELDS.forEach((field) => {
      const raw = pickAliasValue(row, METRIC_HEADER_ALIASES[field.key]);
      const numeric = parseNumericCell(raw);
      if (numeric === null) {
        return;
      }
      hasMetric = true;
      const format = METRIC_FORMAT_LOOKUP[field.key];
      if (format === "currency") {
        metrics[field.key] = numeric.toFixed(2);
      } else {
        metrics[field.key] = Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2);
      }
    });

    if (!hasMetric) {
      issues.push({ row: rowNumber, message: "No numeric metric values were detected" });
      return;
    }

    entries.push({
      slot,
      metrics,
      temperature: resolveTemperatureFromValue(pickAliasValue(row, SIM_TEMPERATURE_ALIASES)) ?? undefined,
      shopNumber: rowShopNumber,
    });
  });

  return { entries, issues };
};

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
  fuelFilters: 0,
  donations: 0,
  mobil1: 0,
};

const temperatureChips: { value: Temperature; label: string; accent: string; colorHex?: string }[] = [
  { value: "green", label: "Green", accent: "bg-emerald-400/20 text-emerald-200", colorHex: "#10b981" },
  { value: "yellow", label: "Yellow", accent: "bg-amber-400/20 text-amber-200", colorHex: "#f59e0b" },
  { value: "red", label: "Red", accent: "bg-rose-500/20 text-rose-200", colorHex: "#ef4444" },
];

const slotOrder = Object.keys(SLOT_DEFINITIONS) as TimeSlotKey[];
const EVENING_SLOTS: TimeSlotKey[] = ["17:00", "20:00"];
const SLOT_UNLOCK_RULES: Record<TimeSlotKey, { label: string; startMinutes: number; endMinutes: number }> = {
  "12:00": { label: "12:00 PM", startMinutes: 9 * 60, endMinutes: 13 * 60 + 30 },
  "14:30": { label: "2:30 PM", startMinutes: 13 * 60 + 30, endMinutes: 16 * 60 },
  "17:00": { label: "5:00 PM", startMinutes: 16 * 60, endMinutes: 19 * 60 },
  "20:00": { label: "8:00 PM", startMinutes: 19 * 60, endMinutes: 9 * 60 },
};

const minutesSinceMidnight = (timestamp: number) => {
  const current = new Date(timestamp);
  return current.getHours() * 60 + current.getMinutes();
};

const isWithinWindow = (minutes: number, start: number, end: number) => {
  if (start <= end) {
    return minutes >= start && minutes < end;
  }
  return minutes >= start || minutes < end;
};

type TrendKpiKey =
  | "cars"
  | "sales"
  | "aro"
  | "donations"
  | "big4"
  | "coolants"
  | "diffs"
  | "fuelFilters"
  | "mobil1";

type TrendValueFormat = "number" | "currency" | "aro" | "percent";

const TREND_KPI_HEADERS: Array<{ key: TrendKpiKey; label: string; format: TrendValueFormat }> = [
  { key: "cars", label: "Cars", format: "number" },
  { key: "sales", label: "Sales", format: "currency" },
  { key: "aro", label: "ARO", format: "aro" },
  { key: "big4", label: "Big 4", format: "percent" },
  { key: "coolants", label: "Coolants", format: "percent" },
  { key: "diffs", label: "Diffs", format: "percent" },
  { key: "fuelFilters", label: "FF", format: "percent" },
  { key: "mobil1", label: "Mobil 1", format: "percent" },
  { key: "donations", label: "Donations", format: "currency" },
];

const METRIC_COLUMN_COUNT = TREND_KPI_HEADERS.length;
const DISTRICT_GRID_TEMPLATE = `1.8fr repeat(${METRIC_COLUMN_COUNT}, minmax(0, 1fr))`;
const TREND_GRID_TEMPLATE = `1.5fr repeat(${METRIC_COLUMN_COUNT}, minmax(0, 1fr))`;

const TREND_SCOPE_WEIGHTS: Record<ScopeLevel, number> = {
  SHOP: 1,
  DISTRICT: 0.96,
  REGION: 0.92,
  DIVISION: 0.88,
};

const TREND_KPI_TEMPLATE: Record<TrendKpiKey, { base: number; decay: number; min?: number }> = {
  cars: { base: 220, decay: 5, min: 120 },
  sales: { base: 48000, decay: 1200, min: 20000 },
  aro: { base: 215, decay: 2, min: 160 },
  donations: { base: 900, decay: 25, min: 250 },
  big4: { base: 48, decay: 0.6, min: 30 },
  coolants: { base: 24, decay: 0.3, min: 12 },
  diffs: { base: 9, decay: 0.2, min: 4 },
  fuelFilters: { base: 14, decay: 0.2, min: 5 },
  mobil1: { base: 18, decay: 0.25, min: 8 },
};

type PulsePanelTone = "aurora" | "violet" | "amber" | "cobalt";

const PULSE_PANEL_TONES: Record<PulsePanelTone, { container: string; overlay: string }> = {
  aurora: {
    container:
      "border-emerald-400/40 bg-gradient-to-br from-[#021321]/95 via-[#030c1b]/96 to-[#01040b]/98 shadow-[0_30px_85px_rgba(8,42,74,0.85)]",
    overlay: "bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.25),_transparent_55%)]",
  },
  violet: {
    container:
      "border-fuchsia-400/40 bg-gradient-to-br from-[#1a0528]/95 via-[#0f041a]/96 to-[#05020b]/98 shadow-[0_30px_85px_rgba(74,15,94,0.75)]",
    overlay: "bg-[radial-gradient(circle_at_top,_rgba(217,70,239,0.25),_transparent_55%)]",
  },
  amber: {
    container:
      "border-amber-400/40 bg-gradient-to-br from-[#2d1804]/95 via-[#1b0c03]/96 to-[#0a0401]/98 shadow-[0_30px_85px_rgba(84,51,10,0.78)]",
    overlay: "bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.22),_transparent_50%)]",
  },
  cobalt: {
    container:
      "border-sky-400/40 bg-gradient-to-br from-[#04132d]/95 via-[#050d20]/96 to-[#01040c]/98 shadow-[0_30px_85px_rgba(15,36,84,0.78)]",
    overlay: "bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.24),_transparent_55%)]",
  },
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-US");

const formatDecimal = (value: number | null) => {
  if (value === null) return "--";
  return value.toFixed(1);
};

const formatPercent = (value: number | null) => {
  if (value === null || Number.isNaN(value)) {
    return "--";
  }
  return `${value.toFixed(1)}%`;
};


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

const mergeSimEntryIntoSlotState = (existing: SlotState | undefined, entry: SimSlotEntry): SlotState => {
  const base = existing
    ? {
        ...existing,
        metrics: { ...existing.metrics },
      }
    : createEmptySlotState();

  (Object.keys(entry.metrics) as MetricKey[]).forEach((metricKey) => {
    const value = entry.metrics[metricKey];
    if (typeof value === "string" && value.trim().length) {
      base.metrics[metricKey] = value;
    }
  });

  if (entry.temperature) {
    base.temperature = entry.temperature;
  }

  base.status = "draft";
  base.dirty = true;
  base.submittedAt = null;
  return base;
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

const buildShopSliceFromTotals = (row: ShopTotalsRow | null | undefined): ShopGridSlice => {
  const cars = row?.total_cars ?? 0;
  const sales = row?.total_sales ?? 0;
  const big4 = row?.total_big4 ?? 0;
  const coolants = row?.total_coolants ?? 0;
  const diffs = row?.total_diffs ?? 0;
  const fuelFilters = row?.total_fuel_filters ?? 0;
  const mobil1 = row?.total_mobil1 ?? 0;
  const donations = row?.total_donations ?? 0;
  const percent = (value: number) => (cars > 0 ? (value / cars) * 100 : null);

  return {
    cars,
    sales,
    aro: cars > 0 ? sales / cars : null,
    big4Pct: percent(big4),
    coolantsPct: percent(coolants),
    diffsPct: percent(diffs),
    fuelFiltersPct: percent(fuelFilters),
    mobil1Pct: percent(mobil1),
    donations,
  } satisfies ShopGridSlice;
};

const convertTotalsRowToShopRow = (row: TotalsRow | null, id: string): ShopTotalsRow | null => {
  if (!row) {
    return null;
  }
  return {
    shop_id: id,
    total_cars: row.total_cars ?? 0,
    total_sales: row.total_sales ?? 0,
    total_big4: row.total_big4 ?? 0,
    total_coolants: row.total_coolants ?? 0,
    total_diffs: row.total_diffs ?? 0,
    total_fuel_filters: row.total_fuel_filters ?? 0,
    total_donations: row.total_donations ?? 0,
    total_mobil1: row.total_mobil1 ?? 0,
    district_name: row.district_name ?? null,
  };
};

const formatMetricPair = (primary: string, secondary: string) => `${primary} / ${secondary}`;
const formatIntegerValue = (value: number) => numberFormatter.format(Math.round(value ?? 0));
const formatCurrencyValue = (value: number) => currencyFormatter.format(Math.round(value ?? 0));
const formatAroValue = (value: number | null) => (value === null ? "--" : `$${formatDecimal(value)}`);

const buildGridMetrics = (daily: ShopGridSlice, weekly: ShopGridSlice): Record<TrendKpiKey, string> => ({
  cars: formatMetricPair(formatIntegerValue(daily.cars), formatIntegerValue(weekly.cars)),
  sales: formatMetricPair(formatCurrencyValue(daily.sales), formatCurrencyValue(weekly.sales)),
  aro: formatMetricPair(formatAroValue(daily.aro), formatAroValue(weekly.aro)),
  big4: formatMetricPair(formatPercent(daily.big4Pct), formatPercent(weekly.big4Pct)),
  coolants: formatMetricPair(formatPercent(daily.coolantsPct), formatPercent(weekly.coolantsPct)),
  diffs: formatMetricPair(formatPercent(daily.diffsPct), formatPercent(weekly.diffsPct)),
  fuelFilters: formatMetricPair(formatPercent(daily.fuelFiltersPct), formatPercent(weekly.fuelFiltersPct)),
  mobil1: formatMetricPair(formatPercent(daily.mobil1Pct), formatPercent(weekly.mobil1Pct)),
  donations: formatMetricPair(formatCurrencyValue(daily.donations), formatCurrencyValue(weekly.donations)),
});

const buildPlaceholderGridMetrics = (): Record<TrendKpiKey, string> =>
  TREND_KPI_HEADERS.reduce<Record<TrendKpiKey, string>>((acc, header) => {
    acc[header.key] = formatMetricPair("--", "--");
    return acc;
  }, {} as Record<TrendKpiKey, string>);

const buildPlaceholderShopRows = (count: number, options?: { descriptor?: string; highlightCurrent?: boolean }) => {
  if (!count || count <= 0) {
    return [] as DistrictGridRow[];
  }
  const descriptor = options?.descriptor ?? "Awaiting mapping";
  return Array.from({ length: count }).map((_, index) => ({
    id: `placeholder-shop-${index + 1}`,
    label: `Shop slot ${index + 1}`,
    descriptor,
    kind: "shop" as DistrictGridRow["kind"],
    isCurrentShop: options?.highlightCurrent && index === 0,
    metrics: buildPlaceholderGridMetrics(),
  }));
};

const resolvePlaceholderCount = (candidate?: number | null) => {
  if (typeof candidate === "number" && candidate > 0) {
    return candidate;
  }
  return 4;
};

const coerceLabelString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const resolveDistrictLabelFromRow = (row: Record<string, unknown>, fallbackIndex: number) => {
  const labelKeys = ["name", "district_name", "label", "title", "display_name", "code"];
  for (const key of labelKeys) {
    const candidate = coerceLabelString(row[key]);
    if (candidate) {
      return candidate;
    }
  }
  return `District ${fallbackIndex + 1}`;
};


const todayISO = () => new Date().toISOString().split("T")[0];

const getWeekStartISO = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day;
  const first = new Date(now.setDate(diff));
  return first.toISOString().split("T")[0];
};

const formatTrendValue = (value: number, format: TrendValueFormat): string => {
  switch (format) {
    case "currency":
      return currencyFormatter.format(Math.round(value));
    case "aro":
      return value <= 0 ? "--" : `$${formatDecimal(value)}`;
    case "percent":
      return formatPercent(value);
    default:
      return numberFormatter.format(Math.round(value));
  }
};

export default function PulseCheckPage() {
  const router = useRouter();
  const [loginEmail, setLoginEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [hierarchy, setHierarchy] = useState<HierarchyRow | null>(null);
  const [shopMeta, setShopMeta] = useState<ShopMeta | null>(null);
  const [homeShopMeta, setHomeShopMeta] = useState<ShopMeta | null>(null);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotStateMap>(() => buildInitialSlots());
  const [slotSnapshot, setSlotSnapshot] = useState<SlotStateMap | null>(null);
  const [dailyTotals, setDailyTotals] = useState<Totals>(EMPTY_TOTALS);
  const [weeklyTotals, setWeeklyTotals] = useState<Totals>(EMPTY_TOTALS);
  const [weeklyEveningTotals, setWeeklyEveningTotals] = useState<Totals>(EMPTY_TOTALS);
  const [districtGridRows, setDistrictGridRows] = useState<DistrictGridRow[]>([]);
  const [districtGridLoading, setDistrictGridLoading] = useState(false);
  const [districtGridError, setDistrictGridError] = useState<string | null>(null);
  const [regionDistricts, setRegionDistricts] = useState<Array<{ id: string | null; label: string }>>([]);
  const [selectedScopeKey, setSelectedScopeKey] = useState<string | null>(null);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingTotals, setLoadingTotals] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<TimeSlotKey | null>(slotOrder[0]);
  const [eveningOnly, setEveningOnly] = useState(false);
  const [kpiScope, setKpiScope] = useState<"daily" | "weekly">("daily");
  const [clock, setClock] = useState(() => Date.now());
  const [proxyPanelOpen, setProxyPanelOpen] = useState(false);
  const [proxyInput, setProxyInput] = useState("");
  const [proxyBusy, setProxyBusy] = useState(false);
  const [proxyMessage, setProxyMessage] = useState<string | null>(null);
  const [proxyMessageTone, setProxyMessageTone] = useState<"info" | "error" | "success">("info");
  const [simBusy, setSimBusy] = useState(false);
  const [simStatus, setSimStatus] = useState<string | null>(null);
  const [simProgress, setSimProgress] = useState(0);
  const [simQueueSize, setSimQueueSize] = useState(0);
  const [showAllTrendRows, setShowAllTrendRows] = useState(false);
  const simControllerRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const [selectedBreakdownDate, setSelectedBreakdownDate] = useState(() => todayISO());
  const needsLogin = authChecked && !loginEmail;
  const panelBaseClasses = (tone: PulsePanelTone = "aurora", padding: string = "p-5") =>
    `relative overflow-hidden rounded-[30px] border ${padding} backdrop-blur ${PULSE_PANEL_TONES[tone].container}`;
  const panelOverlayClasses = (tone: PulsePanelTone = "aurora") =>
    `pointer-events-none absolute inset-0 ${PULSE_PANEL_TONES[tone].overlay}`;
  const scope = hierarchy?.scope_level?.toUpperCase() as ScopeLevel | undefined;
  const canProxy = scope ? scope !== "SHOP" : false;
  const scopeOptions = useMemo<DistrictScopeOption[]>(() => {
    const map = new Map<string, DistrictScopeOption>();
    const addOption = (option: DistrictScopeOption) => {
      if (!option.key) {
        return;
      }
      const normalizedLabel = option.label?.trim() || (option.type === "region" ? "Region overview" : "District view");
      if (!map.has(option.key)) {
        map.set(option.key, { ...option, label: normalizedLabel });
      }
    };

    if (shopMeta?.district_id) {
      addOption({
        key: `district:${shopMeta.district_id}`,
        type: "district",
        districtId: shopMeta.district_id,
        alignmentDistrictName: hierarchy?.district_name ?? null,
        label: hierarchy?.district_name ?? "My district",
        helper: "Linked to this login",
      });
    } else if (hierarchy?.district_name) {
      addOption({
        key: "district:hierarchy",
        type: "district",
        districtId: null,
        alignmentDistrictName: hierarchy.district_name,
        label: hierarchy.district_name,
        helper: "Alignment fallback (link district for KPIs)",
      });
    }

    regionDistricts.forEach((district) => {
      if (!district.id) {
        return;
      }
      addOption({
        key: `district:${district.id}`,
        type: "district",
        districtId: district.id,
        alignmentDistrictName: district.label,
        label: district.label,
      });
    });

    if (shopMeta?.region_id) {
      addOption({
        key: `region:${shopMeta.region_id}`,
        type: "region",
        regionId: shopMeta.region_id,
        label: hierarchy?.region_name ? `${hierarchy.region_name} region` : "Region overview",
        helper: "Roll up to region",
      });
    }

    return Array.from(map.values());
  }, [shopMeta?.district_id, shopMeta?.region_id, hierarchy?.district_name, hierarchy?.region_name, regionDistricts]);

  useEffect(() => {
    if (!scopeOptions.length) {
      setSelectedScopeKey(null);
      return;
    }
    setSelectedScopeKey((prev) => {
      if (prev && scopeOptions.some((option) => option.key === prev)) {
        return prev;
      }
      return scopeOptions[0]?.key ?? null;
    });
  }, [scopeOptions]);

  const selectedScope = useMemo(() => scopeOptions.find((option) => option.key === selectedScopeKey) ?? null, [scopeOptions, selectedScopeKey]);
  const districtGridVisible = scopeOptions.length > 0 || Boolean(hierarchy?.district_name);

  const lookupShopMeta = useCallback(async (shopNumber: number) => {
    const clients = [pulseSupabase, supabase];
    let lastError: unknown = null;

    for (const client of clients) {
      try {
        const { data, error } = await client
          .from("shops")
          .select("id, shop_number, shop_name, district_id, region_id")
          .eq("shop_number", shopNumber)
          .limit(1)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          lastError = error;
          continue;
        }

        if (data) {
          return data as ShopMeta;
        }
      } catch (clientErr) {
        lastError = clientErr;
      }
    }

    if (lastError) {
      throw lastError;
    }

    return null;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const interval = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!canProxy) {
      setProxyPanelOpen(false);
    }
  }, [canProxy]);

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

    const normalizedLogin = normalizeLogin(loginEmail);
    if (!normalizedLogin) {
      setHierarchy(null);
      setHierarchyError("Unable to load hierarchy. Please try again.");
      setLoadingHierarchy(false);
      return;
    }

    const cachedSummary = getCachedSummaryForLogin(normalizedLogin);
    if (cachedSummary) {
      setHierarchy((cachedSummary as HierarchyRow) ?? null);
      setHierarchyError(null);
    }

    const fetchHierarchy = async () => {
      try {
        const { data, error } = await supabase
          .from("hierarchy_summary_vw")
          .select("*")
          .eq("login", normalizedLogin)
          .maybeSingle();

        if (cancelled) {
          return;
        }

          if (error) {
          console.error("hierarchy_summary_vw error", error);
          if (!getCachedSummaryForLogin(normalizedLogin)) {
            setHierarchyError("Unable to load hierarchy. Please try again.");
            setHierarchy(null);
          }
        } else if (!data) {
          const fallback = getCachedSummaryForLogin(normalizedLogin);
          if (fallback) {
            setHierarchy((fallback as HierarchyRow) ?? null);
            setHierarchyError(null);
          } else {
            setHierarchyError("No hierarchy record was found for this login email.");
            setHierarchy(null);
          }
        } else {
          setHierarchy(data as HierarchyRow);
          setHierarchyError(null);
          writeHierarchySummaryCache(data as HierarchyRow);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Pulse Check hierarchy error", err);
          if (!getCachedSummaryForLogin(normalizedLogin)) {
            setHierarchyError("Unexpected error loading hierarchy.");
            setHierarchy(null);
          }
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
      setHomeShopMeta(null);
      setShopMeta(null);
      return;
    }

    const numericShop = Number(hierarchy.shop_number);
    if (Number.isNaN(numericShop)) {
      setHierarchyError("Shop number is not a valid number in hierarchy mapping.");
      setHomeShopMeta(null);
      setShopMeta(null);
      return;
    }

    let cancelled = false;

    const fetchShopMetadata = async () => {
      try {
        const resolved = await lookupShopMeta(numericShop);

        if (cancelled) {
          return;
        }

        if (resolved) {
          setHierarchyError(null);
          setHomeShopMeta(resolved);
          setShopMeta(resolved);
          setProxyPanelOpen(false);
          setProxyInput("");
          setProxyMessage(null);
          setProxyMessageTone("info");
          return;
        }

        setHierarchyError("This login isn't linked to a Pulse Check shop yet. Ask your admin to enable it.");
        setHomeShopMeta(null);
        setShopMeta(null);
      } catch (err) {
        if (!cancelled) {
          console.error("Shop metadata error", err);
          setHierarchyError("Unexpected error resolving shop metadata.");
          setHomeShopMeta(null);
          setShopMeta(null);
        }
      }
    };

    fetchShopMetadata();

    return () => {
      cancelled = true;
    };
  }, [hierarchy, lookupShopMeta]);

  useEffect(() => {
    if (!shopMeta?.region_id) {
      setRegionDistricts([]);
      return;
    }

    let cancelled = false;

    const loadRegionDistricts = async () => {
      try {
        const { data, error } = await pulseSupabase
          .from("districts")
          .select("*")
          .eq("region_id", shopMeta.region_id);

        if (cancelled) {
          return;
        }

        if (error && error.code !== "PGRST116") {
          console.error("Region districts lookup error", error);
          setRegionDistricts(
            shopMeta.district_id
              ? [
                  {
                    id: shopMeta.district_id,
                    label: hierarchy?.district_name ?? "My district",
                  },
                ]
              : []
          );
          return;
        }

        const mapped = (data ?? []).map((row, index) => {
          const record = row as Record<string, unknown> & { id?: string | null };
          const id = typeof record.id === "string" ? record.id : null;
          return {
            id,
            label: resolveDistrictLabelFromRow(record, index),
          };
        });

        const normalized = mapped.reduce<Array<{ id: string | null; label: string }>>((acc, entry) => {
          if (!entry.id) {
            return acc;
          }
          if (!acc.some((existing) => existing.id === entry.id)) {
            acc.push(entry);
          }
          return acc;
        }, []);

        if (shopMeta.district_id && !normalized.some((entry) => entry.id === shopMeta.district_id)) {
          normalized.push({
            id: shopMeta.district_id,
            label: hierarchy?.district_name ?? "My district",
          });
        }

        normalized.sort((a, b) => a.label.localeCompare(b.label));

        setRegionDistricts(normalized);
      } catch (err) {
        if (!cancelled) {
          console.error("Region districts lookup exception", err);
          setRegionDistricts(
            shopMeta.district_id
              ? [
                  {
                    id: shopMeta.district_id,
                    label: hierarchy?.district_name ?? "My district",
                  },
                ]
              : []
          );
        }
      }
    };

    loadRegionDistricts();

    return () => {
      cancelled = true;
    };
  }, [shopMeta?.region_id, shopMeta?.district_id, hierarchy?.district_name]);

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
          fuelFilters: toInputValue(row.fuel_filters ?? null),
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
      const selectColumnsWithFuelFilters =
        "time_slot,cars,sales,big4,coolants,diffs,fuel_filters,donations,mobil1,temperature,is_submitted,submitted_at";
      const legacySelectColumns =
        "time_slot,cars,sales,big4,coolants,diffs,donations,mobil1,temperature,is_submitted,submitted_at";

      const fetchRows = async (columns: string) => {
        const { data, error } = await pulseSupabase
          .from("check_ins")
          .select(columns)
          .eq("shop_id", shopId)
          .eq("check_in_date", todayISO());

        if (error) {
          throw error;
        }

        return (data ?? []) as unknown as CheckInRow[];
      };

      const isFuelFilterMissing = (error: unknown) => {
        if (!error || typeof error !== "object") {
          return false;
        }
        const message =
          (error as { message?: string }).message ||
          (error as { details?: string }).details ||
          (error as { error?: string }).error ||
          "";
        return String(message).toLowerCase().includes("fuel_filters");
      };

      try {
        let rows: CheckInRow[];

        try {
          rows = await fetchRows(selectColumnsWithFuelFilters);
        } catch (err) {
          if (isFuelFilterMissing(err)) {
            console.warn("fuel_filters missing in check_ins cache; using legacy columns");
            rows = await fetchRows(legacySelectColumns);
          } else {
            throw err;
          }
        }

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
            "total_cars,total_sales,total_big4,total_coolants,total_diffs,total_fuel_filters,total_donations,total_mobil1"
          )
          .eq("shop_id", shopId)
          .eq("check_in_date", dailyDate)
          .maybeSingle(),
        pulseSupabase
          .from("shop_wtd_totals")
          .select(
            "total_cars,total_sales,total_big4,total_coolants,total_diffs,total_fuel_filters,total_donations,total_mobil1"
          )
          .eq("shop_id", shopId)
          .eq("week_start", weekStart)
          .order("current_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
        pulseSupabase
          .from("shop_wtd_evening_totals")
          .select(
            "total_cars,total_sales,total_big4,total_coolants,total_diffs,total_fuel_filters,total_donations,total_mobil1"
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
        fuelFilters: row?.total_fuel_filters ?? 0,
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

  useEffect(() => {
    if (!shopMeta?.id) {
      return;
    }

    let refreshToken: number | null = null;
    const scheduleRefresh = () => {
      if (typeof window === "undefined") {
        refreshAll();
        return;
      }
      if (refreshToken) {
        return;
      }
      refreshToken = window.setTimeout(() => {
        refreshToken = null;
        refreshAll();
      }, 400);
    };

    const channel = pulseSupabase
      .channel(`pulse-check-ins:${shopMeta.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "check_ins", filter: `shop_id=eq.${shopMeta.id}` },
        (payload) => {
          const record = (payload.new ?? payload.old) as CheckInRow | null;
          if (!record) {
            return;
          }
          if (record.time_slot && record.shop_id === shopMeta.id) {
            // Only refresh for today's data to avoid unnecessary churn.
            if (record.check_in_date ? record.check_in_date === todayISO() : true) {
              scheduleRefresh();
            }
          } else {
            scheduleRefresh();
          }
        }
      )
      .subscribe();

    return () => {
      if (refreshToken) {
        window.clearTimeout(refreshToken);
      }
      pulseSupabase.removeChannel(channel);
    };
  }, [shopMeta?.id, refreshAll]);

  useEffect(() => {
    if (!districtGridVisible) {
      setDistrictGridRows([]);
      setDistrictGridError(null);
      setDistrictGridLoading(false);
      return;
    }

    if (!selectedScope) {
      if (!scopeOptions.length) {
        setDistrictGridRows([]);
        setDistrictGridError("Link a district to this shop to view scope KPIs.");
      }
      setDistrictGridLoading(false);
      return;
    }

    if (selectedScope.type === "district" && !selectedScope.districtId && !selectedScope.alignmentDistrictName) {
      const placeholderRows = buildPlaceholderShopRows(resolvePlaceholderCount(hierarchy?.shops_in_district), {
        descriptor: "Link this shop to a district",
        highlightCurrent: Boolean(shopMeta?.id),
      });
      setDistrictGridRows([
        ...placeholderRows,
        {
          id: "district-unlinked",
          label: selectedScope.label ?? hierarchy?.district_name ?? "District overview",
          descriptor: "Link a district to this shop to load KPIs.",
          kind: "district",
          metrics: buildPlaceholderGridMetrics(),
        },
      ]);
      setDistrictGridError("Link a district to this shop to view scope KPIs.");
      setDistrictGridLoading(false);
      return;
    }

    if (selectedScope.type === "region" && !selectedScope.regionId) {
      setDistrictGridRows([
        {
          id: "region-unlinked",
          label: selectedScope.label ?? hierarchy?.region_name ?? "Region overview",
          descriptor: "Unable to resolve your region scope.",
          kind: "region",
          metrics: buildPlaceholderGridMetrics(),
        },
      ]);
      setDistrictGridError("Unable to resolve your region scope.");
      setDistrictGridLoading(false);
      return;
    }

    let cancelled = false;

    const fetchHierarchy = async () => {
      try {
        let resolved: HierarchyRow | null = null;
        try {
          const resp = await fetch("/api/hierarchy/summary");
          if (resp.ok) {
            const body = await resp.json();
            resolved = body?.data ?? null;
          } else {
            console.error("Pulse Check hierarchy API status", resp.status);
          }
        } catch (apiErr) {
          console.error("Pulse Check hierarchy API error", apiErr);
        }

        if (!resolved) {
          const { data, error } = await supabase
            .from("hierarchy_summary_vw")
            .select("*")
            .eq("login", normalizeLogin(loginEmail))
            .maybeSingle();

          if (error) {
            console.error("hierarchy_summary_vw error", error);
          } else {
            resolved = (data as HierarchyRow | null) ?? null;
          }
        }

        if (cancelled) return;

        if (!resolved) {
          const fallback = getCachedSummaryForLogin(normalizeLogin(loginEmail));
          if (fallback) {
            setHierarchy((fallback as HierarchyRow) ?? null);
            setHierarchyError(null);
          } else {
            setHierarchyError("No hierarchy record was found for this login email.");
            setHierarchy(null);
          }
        } else {
          setHierarchy(resolved);
          setHierarchyError(null);
          writeHierarchySummaryCache(resolved);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Pulse Check hierarchy error", err);
          setHierarchyError("Unable to load hierarchy. Please try again.");
          setHierarchy(null);
        }
      } finally {
        if (!cancelled) setLoadingHierarchy(false);
      }
    };

          async function loadScope() {
          try {
          const mappedAlignment: { shop_number?: number | null; shop_name?: string; fallbackId?: string }[] =
            Array.isArray((selectedScope as any)?.alignment) ? (selectedScope as any).alignment : [];
          const alignmentNumbers = mappedAlignment
              .map((entry) => entry.shop_number)
              .filter((value): value is number => typeof value === "number");

            const resolvedPulseMap = new Map<number, DistrictShop>();
            if (alignmentNumbers.length) {
              const { data: resolvedShops, error: resolvedError } = await pulseSupabase
                .from("shops")
                .select("id,shop_name,shop_number")
                .in("shop_number", alignmentNumbers);

              if (resolvedError && resolvedError.code !== "PGRST116") {
                throw resolvedError;
              }

              (resolvedShops ?? []).forEach((shop) => {
                if (typeof shop.shop_number === "number") {
                  resolvedPulseMap.set(shop.shop_number, {
                    id: shop.id,
                    shop_name: shop.shop_name,
                    shop_number: shop.shop_number,
                  });
                }
              });
            }

            shopsInDistrict = mappedAlignment.map((entry, index) => {
              if (entry.shop_number !== null && resolvedPulseMap.has(entry.shop_number)) {
                const resolved = resolvedPulseMap.get(entry.shop_number)!;
                return {
                  ...resolved,
                  shop_name: entry.shop_name ?? resolved.shop_name,
                };
              }
              return {
                id: entry.fallbackId ?? `alignment-${index + 1}`,
                shop_name: entry.shop_name,
                shop_number: entry.shop_number,
              };
            });

            if (!hierarchyShopCount) {
              hierarchyShopCount = shopsInDistrict.length || null;
            }
          } catch (alignmentErr) {
            console.error("Alignment fallback error", alignmentErr);
          }

        const realShopIds = shopsInDistrict
          .map((shop) => shop.id)
          .filter((id) => typeof id === "string" && !id.startsWith("alignment-"));

        let dailyRows: ShopTotalsRow[] = [];
        let weeklyRows: ShopTotalsRow[] = [];

        if (realShopIds.length) {
          const [dailyResponse, weeklyResponse] = await Promise.all([
            pulseSupabase
              .from("shop_daily_totals")
              .select(
                "shop_id,total_cars,total_sales,total_big4,total_coolants,total_diffs,total_fuel_filters,total_donations,total_mobil1"
              )
              .eq("check_in_date", todayISO())
              .in("shop_id", realShopIds),
            pulseSupabase
              .from("shop_wtd_totals")
              .select(
                "shop_id,total_cars,total_sales,total_big4,total_coolants,total_diffs,total_fuel_filters,total_donations,total_mobil1"
              )
              .eq("week_start", getWeekStartISO())
              .in("shop_id", realShopIds),
          ]);

          if (dailyResponse.error && dailyResponse.error.code !== "PGRST116") {
            throw dailyResponse.error;
          }
          if (weeklyResponse.error && weeklyResponse.error.code !== "PGRST116") {
            throw weeklyResponse.error;
          }

          dailyRows = (dailyResponse.data ?? []) as ShopTotalsRow[];
          weeklyRows = (weeklyResponse.data ?? []) as ShopTotalsRow[];
        }

        let districtDailyRow: TotalsRow | null = null;
        let districtWeeklyRow: TotalsRow | null = null;

        if (districtId) {
          const [districtDailyResponse, districtWeeklyResponse] = await Promise.all([
            pulseSupabase
              .from("district_daily_totals")
              .select(
                "total_cars,total_sales,total_big4,total_coolants,total_diffs,total_fuel_filters,total_donations,total_mobil1,district_name"
              )
              .eq("district_id", districtId)
              .eq("check_in_date", todayISO())
              .maybeSingle(),
            pulseSupabase
              .from("district_wtd_totals")
              .select(
                "total_cars,total_sales,total_big4,total_coolants,total_diffs,total_fuel_filters,total_donations,total_mobil1,district_name"
              )
              .eq("district_id", districtId)
              .eq("week_start", getWeekStartISO())
              .order("current_date", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);

          if (districtDailyResponse.error && districtDailyResponse.error.code !== "PGRST116") {
            throw districtDailyResponse.error;
          }
          if (districtWeeklyResponse.error && districtWeeklyResponse.error.code !== "PGRST116") {
            throw districtWeeklyResponse.error;
          }

          districtDailyRow = (districtDailyResponse.data as TotalsRow | null) ?? null;
          districtWeeklyRow = (districtWeeklyResponse.data as TotalsRow | null) ?? null;
        }

        const dailyMap = new Map(dailyRows.map((row) => [row.shop_id, row]));
        const weeklyMap = new Map(weeklyRows.map((row) => [row.shop_id, row]));

        const nextRows: DistrictGridRow[] = [];
        const districtRowId = districtId
          ? `district-${districtId}`
          : `district-${normalizedAlignmentName || "alignment"}`;
        const districtDaily = districtId
          ? convertTotalsRowToShopRow(districtDailyRow, districtRowId)
          : null;
        const districtWeekly = districtId
          ? convertTotalsRowToShopRow(districtWeeklyRow, districtRowId)
          : null;
        const hasDistrictTotals = Boolean(districtDaily || districtWeekly);
        const fallbackDescriptor = shopsInDistrict.length
          ? normalizedAlignmentName
            ? "Alignment listing (limited KPIs)"
            : "Awaiting KPI submissions"
          : "No shops resolved for this district yet.";

        const districtRow: DistrictGridRow = {
          id: districtRowId,
          label: districtLabel || normalizedAlignmentName || "District rollup",
          descriptor: districtId
            ? hasDistrictTotals
              ? "District total"
              : fallbackDescriptor
            : normalizedAlignmentName
            ? "Alignment listing (link district for KPIs)"
            : fallbackDescriptor,
          kind: "district",
          metrics: districtId && hasDistrictTotals
            ? buildGridMetrics(
                buildShopSliceFromTotals(districtDaily ?? null),
                buildShopSliceFromTotals(districtWeekly ?? null)
              )
            : buildPlaceholderGridMetrics(),
        };

        shopsInDistrict.forEach((shop) => {
          const label = shop.shop_name ?? `Shop #${shop.shop_number ?? "?"}`;
          const descriptor = shop.shop_number ? `Shop #${shop.shop_number}` : shop.shop_name ?? "Live shop";
          const dailyTotals = dailyMap.get(shop.id) ?? null;
          const weeklyTotals = weeklyMap.get(shop.id) ?? null;
          const hasShopTotals = Boolean(dailyTotals || weeklyTotals);
          const isCurrentShop =
            shop.id === shopMeta?.id ||
            (typeof shop.shop_number === "number" && typeof shopMeta?.shop_number === "number"
              ? shop.shop_number === shopMeta.shop_number
              : false);
          nextRows.push({
            id: shop.id,
            label,
            descriptor,
            kind: "shop",
            isCurrentShop,
            metrics: hasShopTotals
              ? buildGridMetrics(
                  buildShopSliceFromTotals(dailyTotals),
                  buildShopSliceFromTotals(weeklyTotals)
                )
              : buildPlaceholderGridMetrics(),
          });
        });

        if (!shopsInDistrict.length) {
          const placeholders = buildPlaceholderShopRows(resolvePlaceholderCount(hierarchyShopCount), {
            descriptor: normalizedAlignmentName ? "Alignment listing" : "Hierarchy listing",
            highlightCurrent: Boolean(shopMeta?.id),
          });
          nextRows.push(...placeholders);
        }

        nextRows.push(districtRow);

        if (!cancelled) {
          setDistrictGridRows(nextRows);
          setDistrictGridError(
            !districtId && normalizedAlignmentName
              ? "Showing alignment roster. Link this district for live KPIs."
              : null,
          );
        }
      
      }

      const runRegionScope = async (regionId: string, regionLabel: string) => {
        const districtIds = regionDistricts.map((district) => district.id).filter((id): id is string => Boolean(id));
        if (!districtIds.length) {
          throw new Error("No districts resolved for this region.");
        }

        const [districtDailyResponse, districtWeeklyResponse, regionDailyResponse, regionWeeklyResponse] = await Promise.all([
          pulseSupabase
            .from("district_daily_totals")
            .select(
              "district_id,total_cars,total_sales,total_big4,total_coolants,total_diffs,total_fuel_filters,total_donations,total_mobil1,district_name"
            )
            .eq("check_in_date", todayISO())
            .in("district_id", districtIds),
          pulseSupabase
            .from("district_wtd_totals")
            .select(
              "district_id,current_date,total_cars,total_sales,total_big4,total_coolants,total_diffs,total_fuel_filters,total_donations,total_mobil1,district_name"
            )
            .eq("week_start", getWeekStartISO())
            .in("district_id", districtIds),
          pulseSupabase
            .from("region_daily_totals")
            .select(
              "total_cars,total_sales,total_big4,total_coolants,total_diffs,total_fuel_filters,total_donations,total_mobil1,region_name"
            )
            .eq("region_id", regionId)
            .eq("check_in_date", todayISO())
            .maybeSingle(),
          pulseSupabase
            .from("region_wtd_totals")
            .select(
              "total_cars,total_sales,total_big4,total_coolants,total_diffs,total_fuel_filters,total_donations,total_mobil1,region_name,current_date"
            )
            .eq("region_id", regionId)
            .eq("week_start", getWeekStartISO())
            .order("current_date", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (districtDailyResponse.error && districtDailyResponse.error.code !== "PGRST116") {
          throw districtDailyResponse.error;
        }
        if (districtWeeklyResponse.error && districtWeeklyResponse.error.code !== "PGRST116") {
          throw districtWeeklyResponse.error;
        }
        if (regionDailyResponse.error && regionDailyResponse.error.code !== "PGRST116") {
          throw regionDailyResponse.error;
        }
        if (regionWeeklyResponse.error && regionWeeklyResponse.error.code !== "PGRST116") {
          throw regionWeeklyResponse.error;
        }

        const dailyMap = new Map<string, TotalsRow>();
        ((districtDailyResponse.data ?? []) as TotalsRow[]).forEach((row) => {
          if (row.district_id) {
            dailyMap.set(row.district_id, row);
          }
        });

        const weeklyMap = new Map<string, TotalsRow>();
        ((districtWeeklyResponse.data ?? []) as TotalsRow[]).forEach((row) => {
          if (!row.district_id) {
            return;
          }
          const existing = weeklyMap.get(row.district_id);
          if (!existing) {
            weeklyMap.set(row.district_id, row);
            return;
          }
          const nextTimestamp = row.current_date ? Date.parse(row.current_date) : 0;
          const existingTimestamp = existing.current_date ? Date.parse(existing.current_date) : 0;
          if (nextTimestamp >= existingTimestamp) {
            weeklyMap.set(row.district_id, row);
          }
        });

        const regionDailyRow = convertTotalsRowToShopRow(regionDailyResponse.data ?? null, `region-${regionId}`);
        const regionWeeklyRow = convertTotalsRowToShopRow(regionWeeklyResponse.data ?? null, `region-${regionId}`);
        const nextRows: DistrictGridRow[] = [];
        const hasRegionTotals = Boolean(regionDailyRow || regionWeeklyRow);
        nextRows.push({
          id: `region-${regionId}`,
          label:
            regionLabel ||
            regionDailyResponse.data?.region_name ||
            regionWeeklyResponse.data?.region_name ||
            "Region overview",
          descriptor: hasRegionTotals ? "Region total" : "Awaiting KPI submissions",
          kind: "region",
          metrics: hasRegionTotals
            ? buildGridMetrics(
                buildShopSliceFromTotals(regionDailyRow ?? null),
                buildShopSliceFromTotals(regionWeeklyRow ?? null)
              )
            : buildPlaceholderGridMetrics(),
        });

        regionDistricts.forEach((district, index) => {
          if (!district.id) {
            return;
          }
          const dailyRow = convertTotalsRowToShopRow(dailyMap.get(district.id) ?? null, `district-${district.id}`);
          const weeklyRow = convertTotalsRowToShopRow(weeklyMap.get(district.id) ?? null, `district-${district.id}`);
          const hasTotals = Boolean(dailyRow || weeklyRow);
          nextRows.push({
            id: `district-${district.id}`,
            label: district.label || `District ${index + 1}`,
            descriptor: hasTotals ? "District total" : "Awaiting KPI submissions",
            kind: "district",
            metrics: hasTotals
              ? buildGridMetrics(
                  buildShopSliceFromTotals(dailyRow ?? null),
                  buildShopSliceFromTotals(weeklyRow ?? null)
                )
              : buildPlaceholderGridMetrics(),
          });
        });

        if (!cancelled) {
          setDistrictGridRows(nextRows);
          setDistrictGridError(null);
        }
      };

      setDistrictGridLoading(true);
      setDistrictGridError(null);

      (async () => {
        try {
          if (selectedScope.type === "region" && selectedScope.regionId) {
            await runRegionScope(selectedScope.regionId, selectedScope.label);
          } else if (selectedScope.type === "district") {
            await runDistrictScope({
              districtId: selectedScope.districtId,
              districtLabel: selectedScope.label,
              alignmentName: selectedScope.alignmentDistrictName ?? hierarchy?.district_name ?? null,
            });
          }
        } catch (err) {
          console.error("district scope load error", err);
          if (!cancelled) {
            setDistrictGridRows([
              {
                id: `${selectedScope.type}-placeholder`,
                label:
                  selectedScope.label ||
                  (selectedScope.type === "region"
                    ? hierarchy?.region_name ?? "Region overview"
                    : hierarchy?.district_name ?? "District overview"),
                descriptor: "Unable to load scope KPIs right now.",
                kind: selectedScope.type === "region" ? "region" : "district",
                metrics: buildPlaceholderGridMetrics(),
              },
            ]);
            setDistrictGridError("Unable to load scope KPIs right now.");
          }
        } finally {
          if (!cancelled) {
            setDistrictGridLoading(false);
          }
        }
      })();

    loadScope();

    return () => {
      cancelled = true;
    };
  }, [
    districtGridVisible,
    hierarchy?.district_name,
    hierarchy?.region_name,
    hierarchy?.shops_in_district,
    regionDistricts,
    scopeOptions,
    selectedScope,
    shopMeta?.district_id,
    shopMeta?.id,
    shopMeta?.region_id,
    shopMeta?.shop_number,
  ]);

  const resolvedShopNumber = useMemo(() => {
    if (typeof shopMeta?.shop_number === "number" && Number.isFinite(shopMeta.shop_number)) {
      return shopMeta.shop_number;
    }
    if (hierarchy?.shop_number) {
      const numeric = Number(hierarchy.shop_number);
      return Number.isFinite(numeric) ? numeric : null;
    }
    return null;
  }, [shopMeta?.shop_number, hierarchy?.shop_number]);
  const submissionCount = useMemo(() => {
    return slotOrder.filter((slot) => slots[slot].status === "submitted").length;
  }, [slots]);
  const totalSlots = slotOrder.length;
  const cadencePercent = totalSlots === 0 ? 0 : Math.round((submissionCount / totalSlots) * 100);
  const shopLocationLabel =
    [hierarchy?.district_name, hierarchy?.region_name].filter(Boolean).join(" • ") || "Update hierarchy mapping";
  const activeShopLabel = shopMeta?.shop_name
    ? `${shopMeta.shop_name} (#${shopMeta.shop_number ?? "?"})`
    : hierarchy?.shop_number
    ? `Shop #${hierarchy.shop_number}`
    : "Resolve shop";
  const homeShopLabel = homeShopMeta?.shop_name
    ? `${homeShopMeta.shop_name} (#${homeShopMeta.shop_number ?? "?"})`
    : homeShopMeta?.shop_number
    ? `Shop #${homeShopMeta.shop_number}`
    : null;
  const proxyActive = Boolean(homeShopMeta?.id && shopMeta?.id && homeShopMeta.id !== shopMeta.id);

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
      const minutes = minutesSinceMidnight(clock);
      return isWithinWindow(minutes, rule.startMinutes, rule.endMinutes);
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
  const viewLabel = eveningOnly ? "5-8 PM submitted slots" : "All-day performance";
  const bannerTitle = shopMeta?.shop_name
    ? resolvedShopNumber
      ? `${shopMeta.shop_name} (#${resolvedShopNumber})`
      : shopMeta.shop_name
    : resolvedShopNumber
    ? `Shop #${resolvedShopNumber}`
    : "";
  const bannerSubtitle = "";
  const bannerError = hierarchyError || undefined;
  const shopIdentifierLocation = shopLocationLabel;
  const formatScopeCount = useCallback((value: number | null | undefined, noun: string) => {
    if (!value || value <= 0) {
      return null;
    }
    const suffix = value === 1 ? noun : `${noun}s`;
    return `${value} ${suffix}`;
  }, []);
  const scopeInventoryLabel = useMemo(() => {
    if (!hierarchy || !scope) {
      return null;
    }
    if (scope === "DISTRICT") {
      return formatScopeCount(hierarchy.shops_in_district, "Shop");
    }
    if (scope === "REGION") {
      return [
        formatScopeCount(hierarchy.districts_in_region, "District"),
        formatScopeCount(hierarchy.shops_in_region, "Shop"),
      ]
        .filter(Boolean)
        .join(" • ");
    }
    if (scope === "DIVISION") {
      return [
        formatScopeCount(hierarchy.regions_in_division, "Region"),
        formatScopeCount(hierarchy.shops_in_division, "Shop"),
      ]
        .filter(Boolean)
        .join(" • ");
    }
    return null;
  }, [formatScopeCount, hierarchy, scope]);
  const trendGridRows = useMemo(() => {
    const now = new Date();
    const scopeWeight = scope ? TREND_SCOPE_WEIGHTS[scope] ?? 1 : 1;

    return Array.from({ length: 13 }).map((_, index) => {
      const weekDate = new Date(now);
      weekDate.setDate(now.getDate() - index * 7);
      const retailLabelRef = buildRetailTimestampLabel(weekDate);
      const descriptor = `Week ending ${weekDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

      const metrics = TREND_KPI_HEADERS.reduce<Record<TrendKpiKey, string>>((acc, header) => {
        const template = TREND_KPI_TEMPLATE[header.key];
        const baseline = template.base * scopeWeight;
        let rawValue = baseline - template.decay * index;
        if (header.format === "percent") {
          rawValue = Math.min(100, rawValue);
        }
        if (template.min !== undefined) {
          rawValue = Math.max(template.min, rawValue);
        }
        acc[header.key] = formatTrendValue(rawValue, header.format);
        return acc;
      }, {} as Record<TrendKpiKey, string>);

      return {
        id: `${retailLabelRef}-${index}`,
        label: retailLabelRef,
        descriptor,
        metrics,
      };
    });
  }, [scope]);
  const visibleTrendRows = useMemo(() => {
    return showAllTrendRows ? trendGridRows : trendGridRows.slice(0, 6);
  }, [showAllTrendRows, trendGridRows]);
  const bannerMetrics = useMemo<BannerMetric[]>(() => {
    const subtitleRange = "Daily / WTD";
    const formatCount = (value: number) => numberFormatter.format(Math.max(0, Math.round(value ?? 0)));
    const formatMoney = (value: number) => currencyFormatter.format(Math.max(0, Math.round(value ?? 0)));
    const formatAroValue = (totals: Totals) => {
      if (!totals || totals.cars <= 0) {
        return "--";
      }
      return `$${formatDecimal(totals.sales / totals.cars)}`;
    };
    const formatMixValue = (totals: Totals, key: keyof Totals) =>
      formatPercent(totals.cars > 0 ? (totals[key] / totals.cars) * 100 : null);

    return [
      {
        label: "Cars",
        subtitle: subtitleRange,
        value: formatCount(resolvedDailyTotals.cars),
        secondaryValue: formatCount(resolvedWeeklyTotals.cars),
      },
      {
        label: "Sales",
        subtitle: subtitleRange,
        value: formatMoney(resolvedDailyTotals.sales),
        secondaryValue: formatMoney(resolvedWeeklyTotals.sales),
      },
      {
        label: "ARO",
        subtitle: subtitleRange,
        value: formatAroValue(resolvedDailyTotals),
        secondaryValue: formatAroValue(resolvedWeeklyTotals),
      },
      {
        label: "Big 4 mix",
        subtitle: subtitleRange,
        value: formatMixValue(resolvedDailyTotals, "big4"),
        secondaryValue: formatMixValue(resolvedWeeklyTotals, "big4"),
      },
      {
        label: "Coolants mix",
        subtitle: subtitleRange,
        value: formatMixValue(resolvedDailyTotals, "coolants"),
        secondaryValue: formatMixValue(resolvedWeeklyTotals, "coolants"),
      },
      {
        label: "Diffs mix",
        subtitle: subtitleRange,
        value: formatMixValue(resolvedDailyTotals, "diffs"),
        secondaryValue: formatMixValue(resolvedWeeklyTotals, "diffs"),
      },
      {
        label: "Fuel Filters",
        subtitle: subtitleRange,
        value: formatCount(resolvedDailyTotals.fuelFilters),
        secondaryValue: formatCount(resolvedWeeklyTotals.fuelFilters),
      },
      {
        label: "Mobil1 (Promo)",
        subtitle: subtitleRange,
        value: formatCount(resolvedDailyTotals.mobil1),
        secondaryValue: formatCount(resolvedWeeklyTotals.mobil1),
      },
      {
        label: "Donations",
        subtitle: subtitleRange,
        value: formatMoney(resolvedDailyTotals.donations),
        secondaryValue: formatMoney(resolvedWeeklyTotals.donations),
      },
      {
        label: "Turned Cars",
        subtitle: "# / $",
        value: "--",
        secondaryValue: "--",
      },
      {
        label: "Zero Shops",
        subtitle: "# / %",
        value: "--",
        secondaryValue: "--",
      },
      {
        label: "Manual Work Orders",
        subtitle: "created today / WTD",
        value: "--",
        secondaryValue: "--",
      },
    ];
  }, [resolvedDailyTotals, resolvedWeeklyTotals]);

  const slotChoices = slotOrder;
  const todayDateISO = useMemo(() => new Date(clock).toISOString().split("T")[0], [clock]);
  const weekDays = useMemo(() => {
    const start = new Date(clock);
    start.setHours(0, 0, 0, 0);
    const dayOfWeek = start.getDay();
    start.setDate(start.getDate() - dayOfWeek);

    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const iso = date.toISOString().split("T")[0];
      return {
        iso,
        label: date.toLocaleDateString("en-US", { weekday: "short" }),
        fullLabel: date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
      };
    });
  }, [clock]);

  useEffect(() => {
    if (!weekDays.some((day) => day.iso === selectedBreakdownDate)) {
      setSelectedBreakdownDate(weekDays[0]?.iso ?? todayDateISO);
    }
  }, [weekDays, selectedBreakdownDate, todayDateISO]);

  const weeklySubmissionMap = useMemo(() => {
    return weekDays.reduce<Record<string, { submitted: number; total: number }>>((acc, day) => {
      acc[day.iso] = {
        submitted: day.iso === todayDateISO ? submissionCount : 0,
        total: totalSlots,
      };
      return acc;
    }, {} as Record<string, { submitted: number; total: number }>);
  }, [weekDays, todayDateISO, submissionCount, totalSlots]);

  const activeBreakdown = weeklySubmissionMap[selectedBreakdownDate] ?? { submitted: 0, total: totalSlots };
  const selectedBreakdownLabel =
    weekDays.find((day) => day.iso === selectedBreakdownDate)?.fullLabel ?? selectedBreakdownDate;
  const districtShopCount = useMemo(
    () => districtGridRows.filter((row) => row.kind === "shop").length,
    [districtGridRows]
  );
  const districtRollupCount = useMemo(
    () => districtGridRows.filter((row) => row.kind === "district").length,
    [districtGridRows]
  );
  const scopeCountLabel = useMemo(() => {
    if (districtGridLoading && !districtGridRows.length) {
      return selectedScope?.type === "region" ? "Syncing districts" : "Syncing shops";
    }
    if (selectedScope?.type === "region") {
      if (!districtRollupCount) {
        return "No districts resolved";
      }
      return `${districtRollupCount} district${districtRollupCount === 1 ? "" : "s"}`;
    }
    if (!districtShopCount) {
      return "No shops resolved";
    }
    return `${districtShopCount} shop${districtShopCount === 1 ? "" : "s"}`;
  }, [districtGridLoading, districtGridRows.length, districtRollupCount, districtShopCount, selectedScope?.type]);
  const scopeTotalsLabel = useMemo(() => {
    if (!hierarchy) {
      return null;
    }

    const parts: string[] = [];
    const districtPart = formatScopeCount(hierarchy.shops_in_district, "Shop");
    if (districtPart) {
      parts.push(`District: ${districtPart}`);
    }

    const regionPart = [
      formatScopeCount(hierarchy.districts_in_region, "District"),
      formatScopeCount(hierarchy.shops_in_region, "Shop"),
    ]
      .filter(Boolean)
      .join(" / ");
    if (regionPart) {
      parts.push(`Region: ${regionPart}`);
    }

    const divisionPart = [
      formatScopeCount(hierarchy.regions_in_division, "Region"),
      formatScopeCount(hierarchy.shops_in_division, "Shop"),
    ]
      .filter(Boolean)
      .join(" / ");
    if (divisionPart) {
      parts.push(`Division: ${divisionPart}`);
    }

    return parts.length ? parts.join(" • ") : null;
  }, [formatScopeCount, hierarchy]);
  const scopeHelperLabel = useMemo(() => {
    return [scopeTotalsLabel, scopeCountLabel].filter(Boolean).join(" • ");
  }, [scopeCountLabel, scopeTotalsLabel]);

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

  const ensureShopForAction = useCallback(async (): Promise<ShopMeta | null> => {
    if (shopMeta?.id) {
      return shopMeta;
    }

    const candidateNumbers = new Set<number>();
    const pushCandidate = (value: unknown) => {
      const numeric = typeof value === "number" ? value : Number(value);
      if (Number.isFinite(numeric)) {
        candidateNumbers.add(Number(numeric));
      }
    };

    pushCandidate(shopMeta?.shop_number);
    pushCandidate(homeShopMeta?.shop_number);
    pushCandidate(hierarchy?.shop_number);

    for (const shopNumber of candidateNumbers) {
      try {
        const resolved = await lookupShopMeta(shopNumber);
        if (resolved) {
          setShopMeta(resolved);
          if (!homeShopMeta) {
            setHomeShopMeta(resolved);
          }
          return resolved;
        }
      } catch (err) {
        console.error("ensureShopForAction lookup error", err);
      }
    }

    // Fallback: try resolving via alignment table using district/name context
    const alignmentDistrict = (selectedScope && (selectedScope.alignmentDistrictName ?? selectedScope.label)) ?? hierarchy?.district_name;
    if (alignmentDistrict) {
      try {
        const pattern = escapeLikePattern(String(alignmentDistrict));
        const { data: alignmentRow, error: alignmentError } = await supabase
          .from("shop_alignment")
          .select("store,shop_name")
          .ilike("district", `${pattern}%`)
          .order("store", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!alignmentError && alignmentRow && alignmentRow.store != null) {
          const storeNum = typeof alignmentRow.store === "number" ? alignmentRow.store : Number(alignmentRow.store);
          if (Number.isFinite(storeNum)) {
            const resolved = await lookupShopMeta(Number(storeNum));
            if (resolved) {
              setShopMeta(resolved);
              if (!homeShopMeta) setHomeShopMeta(resolved);
              return resolved;
            }
          }
        }
      } catch (err) {
        console.error("ensureShopForAction alignment lookup error", err);
      }
    }

    return null;
  }, [shopMeta, homeShopMeta, hierarchy?.shop_number, hierarchy?.district_name, lookupShopMeta, selectedScope]);

  const submitSlot = useCallback(
    async (slotKey: TimeSlotKey, overrideState?: SlotState) => {
      const activeShop = await ensureShopForAction();
      if (!activeShop?.id) {
        setStatusMessage("Resolve your shop before submitting.");
        return false;
      }

      const slotState = overrideState ?? slots[slotKey] ?? createEmptySlotState();
      const definition = SLOT_DEFINITIONS[slotKey];
      const submittedAt = new Date().toISOString();
      const payload = {
        shop_id: activeShop.id,
        check_in_date: todayISO(),
        time_slot: definition.dbSlot,
        cars: toNumberValue(slotState.metrics.cars),
        sales: toNumberValue(slotState.metrics.sales),
        big4: toNumberValue(slotState.metrics.big4),
        coolants: toNumberValue(slotState.metrics.coolants),
        diffs: toNumberValue(slotState.metrics.diffs),
        fuel_filters: toNumberValue(slotState.metrics.fuelFilters),
        donations: toNumberValue(slotState.metrics.donations),
        mobil1: toNumberValue(slotState.metrics.mobil1),
        temperature: slotState.temperature,
        is_submitted: true,
        submitted_at: submittedAt,
      };

      setSubmitting(true);
      setStatusMessage(null);

      try {
        const response = await fetch("/api/pulse-check5/check-ins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload }),
        });

        if (!response.ok) {
          let message = "Unable to submit slot.";
          try {
            const result = await response.json();
            if (result?.error && typeof result.error === "string") {
              message = result.error;
            }
          } catch (jsonErr) {
            console.error("submitSlot response parse error", jsonErr);
          }
          throw new Error(message);
        }

        const submittedState: SlotState = {
          ...slotState,
          status: "submitted",
          submittedAt,
          dirty: false,
        };

        setSlots((prev) => ({
          ...prev,
          [slotKey]: submittedState,
        }));

        setSlotSnapshot((prev) => {
          const base = prev ? { ...prev } : buildInitialSlots();
          base[slotKey] = submittedState;
          return base;
        });

        setStatusMessage(`${definition.label} slot submitted`);
        await loadTotals(activeShop.id);
        return true;
      } catch (err) {
        console.error("submitSlot error", err);
        const message = err instanceof Error ? err.message : "Unable to submit slot right now.";
        setStatusMessage(message);
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [ensureShopForAction, slots, loadTotals]
  );

  const handleSubmit = useCallback(async () => {
    await submitSlot(currentSlotKey);
  }, [currentSlotKey, submitSlot]);

  const handleProxySubmit = useCallback(async () => {
    const trimmed = proxyInput.trim();
    if (!trimmed) {
      setProxyMessageTone("error");
      setProxyMessage("Enter a shop number to proxy.");
      return;
    }

    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) {
      setProxyMessageTone("error");
      setProxyMessage("Shop numbers are numeric.");
      return;
    }

    if (homeShopMeta?.shop_number && numeric === homeShopMeta.shop_number) {
      setProxyMessageTone("info");
      setProxyMessage("That's already your home shop.");
      return;
    }

    setProxyBusy(true);
    setProxyMessage(null);

    try {
      const resolved = await lookupShopMeta(numeric);
      if (resolved) {
        setShopMeta(resolved);
        setProxyMessageTone("success");
        setProxyMessage(
          `Proxying ${resolved.shop_name ? `${resolved.shop_name} (#${resolved.shop_number ?? numeric})` : `shop #${resolved.shop_number ?? numeric}`}`
        );
      } else {
        setProxyMessageTone("error");
        setProxyMessage("No shop matched that number.");
      }
    } catch (err) {
      console.error("Proxy lookup error", err);
      setProxyMessageTone("error");
      setProxyMessage("Unable to resolve that shop right now.");
    } finally {
      setProxyBusy(false);
    }
  }, [homeShopMeta, lookupShopMeta, proxyInput]);

  const handleProxyExit = useCallback(() => {
    if (homeShopMeta) {
      setShopMeta(homeShopMeta);
    }
    setProxyMessageTone("info");
    setProxyMessage("Returned to home shop.");
    setProxyInput("");
  }, [homeShopMeta]);

  const stopSim = useCallback((message?: string) => {
    simControllerRef.current.cancelled = true;
    setSimStatus(message ?? "Cancelling simulation…");
  }, []);

  const runSimTest = useCallback(async () => {
    const controller = { cancelled: false };
    simControllerRef.current = controller;
    setSimBusy(true);
    setSimStatus("Preparing simulation…");
    setSimProgress(0);
    setSimQueueSize(0);

    const activeShop = await ensureShopForAction();
    if (!activeShop?.id) {
      setSimStatus("Resolve your shop before running the sim.");
      setSimBusy(false);
      simControllerRef.current = { cancelled: false };
      return;
    }

    try {
      const response = await fetch(CHECKIN_SIM_TEST_URL);
      if (!response.ok) {
        throw new Error(`Sim workbook request failed (${response.status})`);
      }

      const buffer = await response.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error("Simulation workbook is empty.");
      }

      const allEntries: SimSlotEntry[] = [];
      const allIssues: SimRowIssue[] = [];

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: null });
        const { entries: parsedEntriesForSheet, issues: rowIssuesForSheet } = buildSimEntriesFromRows(
          rows,
          activeShop.shop_number ?? null,
          sheetName,
        );
        allEntries.push(...parsedEntriesForSheet);
        allIssues.push(...rowIssuesForSheet);
      }

      const parsedEntries = allEntries;
      const rowIssues = allIssues;

      if (rowIssues.length) {
        console.warn("Simulation sheet issues", rowIssues);
        const preview = rowIssues
          .slice(0, 3)
          .map((issue) => `Row ${issue.row}: ${issue.message}`)
          .join("; ");
        const suffix = rowIssues.length > 3 ? ` (+${rowIssues.length - 3} more)` : "";
        setSimStatus(`Fix simulation sheet rows before running: ${preview}${suffix}`);
        setSimQueueSize(0);
        return;
      }

      const queue = slotOrder
        .map((slot) => parsedEntries.find((entry) => entry.slot === slot))
        .filter((entry): entry is SimSlotEntry => Boolean(entry));

      if (!queue.length) {
        throw new Error("No matching slots were found for this shop in the sim sheet.");
      }

      setSimQueueSize(queue.length);
      setSimProgress(queue.length ? 0 : 100);

      if (controller.cancelled) {
        setSimStatus("Simulation cancelled");
        return;
      }

      let workingSlots: SlotStateMap = { ...slots };

      for (let index = 0; index < queue.length; index += 1) {
        if (controller.cancelled) {
          break;
        }

        const entry = queue[index];
        const mergedState = mergeSimEntryIntoSlotState(workingSlots[entry.slot], entry);
        workingSlots = { ...workingSlots, [entry.slot]: mergedState };
        setSlots(workingSlots);
        setActiveSlot(entry.slot);
        setSimStatus(`Submitting ${SLOT_DEFINITIONS[entry.slot].label} (${index + 1}/${queue.length})`);
        setSimProgress(Math.round(((index + 1) / queue.length) * 100));

        const success = await submitSlot(entry.slot, mergedState);
        if (!success) {
          setSimStatus("Simulation halted after a submission error.");
          return;
        }

        if (index < queue.length - 1) {
          const delay = 3000 + Math.floor(Math.random() * 4000);
          setSimStatus(`Next slot in ${Math.round(delay / 1000)}s…`);
          await waitWithCancellation(controller, delay);
        }
      }

      setSimStatus(controller.cancelled ? "Simulation cancelled" : "Simulation complete");
      if (!controller.cancelled && queue.length) {
        setSimProgress(100);
      }
    } catch (err) {
      console.error("runSimTest error", err);
      setSimStatus("Simulation failed. Check console for details.");
    } finally {
      setSimBusy(false);
      simControllerRef.current = { cancelled: false };
      if (controller.cancelled) {
        setSimStatus("Simulation cancelled");
      }
    }
  }, [ensureShopForAction, slots, submitSlot]);

  const handleSimToggle = useCallback(() => {
    if (simBusy) {
      stopSim("Cancelling simulation…");
      return;
    }
    void runSimTest();
  }, [runSimTest, simBusy, stopSim]);

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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_290px] lg:items-start">
          <div className="space-y-4 order-1 lg:order-1">
            <header className={panelBaseClasses("aurora")}>
              <div className={panelOverlayClasses("aurora")} />
              <div className="relative space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="text-[9px] tracking-[0.3em] uppercase text-emerald-400">Pulse Check5</p>
                      <h1 className="text-lg font-semibold text-white">Live KPI Board</h1>
                    </div>
                    <RetailPills />
                  </div>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Link
                      href="/"
                      className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-emerald-400"
                    >
                      Home portal
                    </Link>
                    <Link
                      href="/contests"
                      className="inline-flex items-center rounded-full border border-amber-400/60 px-3 py-1 text-[11px] font-semibold text-amber-100 transition hover:bg-amber-400/10"
                    >
                      Contest portal →
                    </Link>
                    <button
                      onClick={refreshAll}
                      disabled={!shopMeta?.id || busy}
                      className="inline-flex items-center justify-center rounded-full border border-emerald-400/70 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
                    >
                      Refresh data
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                  {shopIdentifierLocation && (
                    <span className="text-sm font-semibold text-white">{shopIdentifierLocation}</span>
                  )}
                  {scopeInventoryLabel && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                      {scopeInventoryLabel}
                    </span>
                  )}
                  {activeShopLabel && <span className="text-slate-400">{activeShopLabel}</span>}
                  {!shopIdentifierLocation && !scopeInventoryLabel && !activeShopLabel && bannerTitle && (
                    <span className="text-sm font-semibold text-white">{bannerTitle}</span>
                  )}
                </div>
              </div>
            </header>

            <ShopPulseBanner
              title={bannerTitle}
              subtitle={bannerSubtitle}
              metrics={bannerMetrics}
              loading={rollupLoading}
              error={bannerError}
              cadence={{
                submitted: submissionCount,
                total: totalSlots,
                percent: cadencePercent,
                loading: loadingSlots,
              }}
              viewToggle={{
                label: viewLabel,
                checked: eveningOnly,
                onChange: setEveningOnly,
              }}
              scopeToggle={{
                value: kpiScope,
                onChange: (value) => setKpiScope(value),
              }}
            />
          </div>

          <div className="space-y-4 order-2 lg:order-3 lg:col-span-2">
            {districtGridVisible && (
              <section className={panelBaseClasses("aurora", "p-4")} aria-label="District shop KPI grid">
                <div className={panelOverlayClasses("aurora")} />
                <div className="relative space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300">Alignment Summary</p>
                      <h3 className="text-lg font-semibold text-white">
                        {selectedScope?.label ?? hierarchy?.district_name ?? "District overview"}
                      </h3>
                      {selectedScope?.helper && (
                        <p className="text-[11px] text-slate-400">{selectedScope.helper}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right">
                      <label className="text-[9px] uppercase tracking-[0.35em] text-slate-500">Scope view</label>
                      <select
                        aria-label="Select scope"
                        value={selectedScopeKey ?? ""}
                        disabled={scopeOptions.length === 0}
                        onChange={(event) => setSelectedScopeKey(event.target.value || null)}
                        className="min-w-[11rem] rounded-xl border border-white/15 bg-slate-950/60 px-2.5 py-1 text-[11px] font-semibold text-white shadow-inner focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {scopeOptions.map((option) => (
                          <option key={option.key} value={option.key} className="text-slate-900">
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-400">{scopeHelperLabel}</p>
                    </div>
                  </div>
                  {districtGridError && <p className="text-sm text-amber-200">{districtGridError}</p>}
                  <div className="overflow-hidden rounded-3xl border border-white/5 bg-[#030b18]/60 shadow-[0_20px_50px_rgba(1,6,20,0.6)]">
                    {districtGridLoading && !districtGridRows.length ? (
                      <div className="px-4 py-6 text-center text-sm text-slate-400">Loading district shops…</div>
                    ) : districtGridRows.length ? (
                      <div className="overflow-x-auto">
                        <div className="min-w-[1040px]">
                          <div
                            className="grid bg-slate-900/60 text-[10px] uppercase tracking-[0.3em] text-slate-300"
                            style={{ gridTemplateColumns: DISTRICT_GRID_TEMPLATE }}
                          >
                            <div className="px-3 py-2 text-left">Shop</div>
                            {TREND_KPI_HEADERS.map((header) => (
                              <div key={`district-header-${header.key}`} className="px-3 py-2 text-center">
                                {header.label}
                              </div>
                            ))}
                          </div>
                          <div className="divide-y divide-white/5">
                            {districtGridRows.map((row, index) => {
                              const zebra = index % 2 ? "bg-slate-950/30" : "bg-slate-950/60";
                              const highlightClass =
                                row.kind === "district" || row.kind === "region"
                                  ? "bg-emerald-500/10"
                                  : row.isCurrentShop
                                  ? "bg-sky-500/10"
                                  : zebra;
                              return (
                                <div
                                  key={row.id}
                                  className={`grid px-3 py-2 text-sm transition ${highlightClass}`}
                                  style={{ gridTemplateColumns: DISTRICT_GRID_TEMPLATE }}
                                >
                                  <div>
                                    <p className="text-sm font-semibold text-white">{row.label}</p>
                                    <p className="text-[11px] text-slate-400">{row.descriptor}</p>
                                  </div>
                                  {TREND_KPI_HEADERS.map((header) => (
                                    <div
                                      key={`${row.id}-${header.key}`}
                                      className="px-3 py-2 text-center text-[11px] font-semibold text-slate-100"
                                    >
                                      {row.metrics[header.key]}
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 py-6 text-center text-sm text-slate-400">No shops resolved for this district yet.</div>
                    )}
                  </div>
                </div>
              </section>
            )}

            <section className={panelBaseClasses("cobalt", "p-4")}>
              <div className={panelOverlayClasses("cobalt")} />
              <div className="relative space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300">Weekly breakdown</p>
                    <h3 className="text-lg font-semibold text-white">Daily submissions overview</h3>
                  </div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Resets Sunday • 9:00 AM</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                  {weekDays.map((day) => {
                    const entry = weeklySubmissionMap[day.iso];
                    const active = day.iso === selectedBreakdownDate;
                    return (
                      <button
                        key={day.iso}
                        type="button"
                        onClick={() => setSelectedBreakdownDate(day.iso)}
                        className={`rounded-2xl border px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 ${
                          active
                            ? "border-emerald-400/70 bg-emerald-500/10 shadow-[0_12px_25px_rgba(16,185,129,0.25)]"
                            : "border-white/10 bg-[#030a16]/70 hover:border-emerald-400/50"
                        }`}
                      >
                        <p className="text-[9px] uppercase tracking-[0.35em] text-slate-400">{day.label}</p>
                        <p className="text-base font-semibold text-white">
                          {entry.submitted} / {entry.total}
                        </p>
                        <p className="text-[10px] text-slate-500">{day.fullLabel}</p>
                      </button>
                    );
                  })}
                </div>
                <div className="rounded-[22px] border border-white/10 bg-[#030b18]/70 p-4 text-sm text-slate-200">
                  <p className="text-[9px] uppercase tracking-[0.35em] text-slate-500">Selected day</p>
                  <p className="text-lg font-semibold text-white">{selectedBreakdownLabel}</p>
                  <p className="mt-1 text-slate-200">
                    Submissions:
                    <span className="ml-1 font-semibold text-white">
                      {activeBreakdown.submitted} / {activeBreakdown.total}
                    </span>
                  </p>
                  <p className="text-[10px] text-slate-400">Tap a weekday panel to focus its check-ins.</p>
                </div>
              </div>
            </section>
          </div>

          <aside className="w-full max-w-[18rem] justify-self-center lg:justify-self-end lg:self-stretch order-3 lg:order-2">
            <div className={`${panelBaseClasses("violet", "p-5")} h-full`}>
              <div className={panelOverlayClasses("violet")} />
              <div className="relative space-y-2.5">
                {needsLogin ? (
                  <LoginPrompt />
                ) : (
                  <div className="space-y-2.5">
                    <div className="space-y-1.5">
                      <p className="text-center text-[9px] uppercase tracking-[0.3em] text-slate-400">Check-ins</p>
                      <div className="grid grid-cols-2 gap-1">
                        {slotChoices.map((slotKey) => {
                          const unlocked = slotUnlockedMap[slotKey];
                          const isActive = currentSlotKey === slotKey;
                          return (
                            <Chip
                              key={slotKey}
                              onClick={() => {
                                if (unlocked) {
                                  setActiveSlot(slotKey);
                                }
                              }}
                              label={SLOT_DEFINITIONS[slotKey].label}
                              active={isActive}
                              tintColor={isActive ? "#10b981" : undefined}
                              disabled={loadingSlots || !unlocked}
                              className={isActive ? "text-white" : unlocked ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "bg-slate-900/60 text-slate-500"}
                              title={unlocked ? undefined : `Locked until ${SLOT_UNLOCK_RULES[slotKey]?.label ?? "unlock"}`}
                            />
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

                    {hierarchyError && (
                      <div className="rounded-xl border border-rose-500/50 bg-rose-900/40 px-3 py-2 text-xs text-rose-100">
                        {hierarchyError}
                      </div>
                    )}
                    {renderStatusBanner()}

                    {canProxy && (
                      <div className="rounded-2xl border border-white/5 bg-[#040c1c]/70 p-3 text-[10px] text-slate-300">
                        <div className="flex flex-wrap items-center gap-2 text-slate-400">
                          <span className="rounded-full border border-emerald-400/50 px-2 py-0.5 text-[9px] uppercase tracking-[0.35em] text-emerald-300">
                            {scope ?? "Scope"}
                          </span>
                          {proxyActive && (
                            <span className="rounded-full border border-amber-400/40 px-2 py-0.5 text-[9px] uppercase tracking-wide text-amber-200">
                              Proxying
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setProxyPanelOpen((open) => !open)}
                            className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold text-slate-200 transition hover:border-emerald-400"
                          >
                            {proxyPanelOpen
                              ? "Hide proxy tools"
                              : proxyActive
                              ? "Change proxy shop"
                              : "Enter proxy mode"}
                          </button>
                          {proxyActive && (
                            <button
                              type="button"
                              onClick={handleProxyExit}
                              className="rounded-full border border-emerald-400/60 px-3 py-1 text-[10px] font-semibold text-emerald-300 transition hover:bg-emerald-500/10"
                            >
                              Return to {homeShopLabel ?? "home shop"}
                            </button>
                          )}
                        </div>
                        {proxyPanelOpen && (
                          <div className="mt-2">
                            <ProxyModePanel
                              value={proxyInput}
                              onChange={setProxyInput}
                              onSubmit={handleProxySubmit}
                              busy={proxyBusy}
                              message={proxyMessage}
                              tone={proxyMessageTone}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-1">
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
                      <button
                        type="button"
                        onClick={handleSimToggle}
                        className="mt-1 inline-flex items-center justify-center rounded-full border border-cyan-400/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-100 transition hover:bg-cyan-500/10 disabled:opacity-40"
                        disabled={busy && !simBusy}
                      >
                        {simBusy ? "Stop sim" : "Run sim test"}
                      </button>
                      <a
                        href={CHECKIN_SIM_TEST_URL}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center justify-center rounded-full border border-slate-600 px-3 py-1 text-[10px] font-semibold text-slate-200 transition hover:border-slate-400"
                      >
                        Download sheet
                      </a>
                      {(simBusy || simStatus) && (
                        <div className="mt-2 w-full rounded-xl border border-cyan-400/30 bg-cyan-500/5 px-3 py-2 text-[11px] text-cyan-100" aria-live="polite">
                          <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.4em] text-cyan-200">
                            <span>Sim status</span>
                            {simQueueSize > 0 && <span>{simProgress}%</span>}
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-slate-800">
                            <div
                              className={`h-full rounded-full ${simBusy ? "bg-cyan-300" : "bg-emerald-300"}`}
                              style={{ width: `${simQueueSize > 0 ? simProgress : simBusy ? 15 : 0}%` }}
                            />
                          </div>
                          <p className="mt-1 text-[11px] text-cyan-100/90">
                            {simStatus ?? (simBusy ? "Simulation running" : "Ready")}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>

          <div className="lg:col-span-2 order-4 lg:order-4">
            <div className={`${panelBaseClasses("cobalt", "p-4 sm:p-5")} mt-4 lg:mt-0`}>
              <div className={panelOverlayClasses("cobalt")} />
              <div className="relative space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300">Retail time calendar</p>
                  <h3 className="text-xl font-semibold text-white">13-week scope trends</h3>
                </div>
                <div className="overflow-hidden rounded-3xl border border-white/5 bg-[#030b18]/60 shadow-[0_25px_65px_rgba(1,6,20,0.7)]">
                  <div className="overflow-x-auto">
                    <div className="min-w-[1040px]">
                      <div
                        className="grid bg-slate-900/60 text-[10px] uppercase tracking-[0.3em] text-slate-300"
                        style={{ gridTemplateColumns: TREND_GRID_TEMPLATE }}
                      >
                        <div className="px-3 py-2 text-center">Week</div>
                        {TREND_KPI_HEADERS.map((header) => (
                          <div key={header.key} className="px-3 py-2 text-center">
                            {header.label}
                          </div>
                        ))}
                      </div>
                      <div className="divide-y divide-white/5">
                        {visibleTrendRows.map((row, index) => {
                          const highlight = index === 0;
                          return (
                            <div
                              key={row.id}
                              className={`grid px-3 py-2 text-sm transition ${
                                highlight ? "bg-emerald-500/5" : index % 2 ? "bg-slate-950/30" : "bg-slate-950/60"
                              }`}
                              style={{ gridTemplateColumns: TREND_GRID_TEMPLATE }}
                            >
                              <div className="flex flex-col items-center text-center">
                                <p className="text-[13px] font-semibold text-white">{row.label}</p>
                              </div>
                              {TREND_KPI_HEADERS.map((header) => (
                                <div
                                  key={`${row.id}-${header.key}`}
                                  className="px-3 py-2 text-center text-[11px] font-semibold text-slate-100"
                                >
                                  {row.metrics[header.key]}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-end gap-2 border-t border-white/5 bg-slate-950/40 px-3 py-2 text-[11px] text-slate-300">
                        <span>{showAllTrendRows ? "Showing 13 weeks" : "Showing latest 6 weeks"}</span>
                        <button
                          type="button"
                          onClick={() => setShowAllTrendRows((prev) => !prev)}
                          className="rounded-full border border-emerald-400/50 px-3 py-1 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/10"
                        >
                          {showAllTrendRows ? "Collapse to 6" : "Expand to 13"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function ProxyModePanel({
  value,
  onChange,
  onSubmit,
  busy,
  message,
  tone,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  busy: boolean;
  message: string | null;
  tone: "info" | "error" | "success";
}) {
  const messageClass =
    tone === "success" ? "text-emerald-300" : tone === "error" ? "text-rose-300" : "text-slate-400";

  return (
    <div className="rounded-2xl border border-white/5 bg-[#040c1c]/80 p-3 text-[10px] text-slate-300">
      <p className="text-[10px] text-slate-400">Proxy lets DM, RD, or VP submit on behalf of another shop.</p>
      <div className="mt-2 flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="min-w-[7rem] flex-1 rounded-2xl border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-xs font-semibold text-white outline-none focus:border-emerald-400"
            placeholder="Enter shop #"
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            className="rounded-2xl border border-emerald-400/60 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/10 disabled:opacity-50"
          >
            {busy ? "Resolving…" : "Proxy to shop"}
          </button>
        </div>
        {message && <p className={messageClass}>{message}</p>}
      </div>
    </div>
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
  const unlockLabel = SLOT_UNLOCK_RULES[slotKey]?.label ?? definition.label;
  const temperatureText = compact ? "text-[10px]" : "text-[11px]";
  const inputText = compact ? "text-[13px]" : "text-base";
  const spacing = compact ? "space-y-1.5 p-2" : "space-y-4 p-4";
  const gridGap = compact ? "gap-2" : "gap-3";
  const inputGridCols = compact ? "grid-cols-2" : "grid-cols-4";
  const labelTextClass = compact ? "text-[10px]" : "text-xs";
  const labelPadding = compact ? "p-1.5" : "p-2.5";
  const labelTracking = compact ? "tracking-[0.3em]" : "tracking-[0.28em]";

  return (
    <div className={`${spacing} w-full rounded-2xl border border-white/5 bg-gradient-to-br from-[#0f203f]/80 via-[#07142d]/80 to-[#020915]/95 shadow-[0_15px_35px_rgba(1,6,20,0.65)]`}>
      {locked && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-200">
          Slot locked until {unlockLabel}. Check back later.
        </div>
      )}
      <div className={`flex flex-wrap items-center justify-between gap-2 ${temperatureText}`}>
        <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-400">
          Current floor temp.
        </span>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {temperatureChips.map((chip) => (
            <Chip
              key={chip.value}
              label={chip.label}
              onClick={() => onTemperatureChange(slotKey, chip.value)}
              tintColor={chip.colorHex ?? undefined}
              active={slotState.temperature === chip.value}
              disabled={loading || locked}
            />
          ))}
        </div>
      </div>
      <div className={`grid w-full ${gridGap} ${inputGridCols}`}>
        {METRIC_FIELDS.map((field) => {
          const isCurrency = field.format === "currency";
          return (
            <label
              key={field.key}
              className={`flex w-full min-w-0 flex-col rounded-xl border border-slate-800 bg-slate-900/60 ${labelPadding} ${labelTextClass} font-semibold uppercase ${labelTracking} text-slate-300`}
            >
              {field.label}
              <div className={`mt-0.5 w-full ${isCurrency ? "flex items-center gap-0.5" : ""}`}>
                {isCurrency && <span className="text-[12px] font-semibold text-slate-500">$</span>}
                <input
                  type="number"
                  inputMode={isCurrency ? "decimal" : "numeric"}
                  step={isCurrency ? "0.01" : undefined}
                  value={slotState.metrics[field.key]}
                  onChange={(event) => onMetricChange(slotKey, field.key, event.target.value)}
                  className={`w-full rounded-lg border border-slate-700 bg-slate-950/60 px-2.5 py-1 ${inputText} font-semibold text-white outline-none focus:border-emerald-400 ${
                    isCurrency ? "text-right" : ""
                  }`}
                  placeholder={isCurrency ? "0.00" : "0"}
                  disabled={loading || locked}
                />
              </div>
            </label>
          );
        })}
      </div>
    </div>
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
