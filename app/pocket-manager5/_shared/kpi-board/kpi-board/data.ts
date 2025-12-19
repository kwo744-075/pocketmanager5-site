import { CANONICAL_KPIS, type CanonicalKpiKey, type GoalMap, type NormalizedRow, type PresetKind, type TrainingTip, type UploadSectionKind } from "./types";

export const PRESET_OPTIONS: Array<{ value: PresetKind; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "period", label: "Period" },
];

export const SECTION_OPTIONS: Array<{ value: UploadSectionKind; label: string; helper: string }> = [
  { value: "daily", label: "Daily", helper: "Single-day pull" },
  { value: "weekly", label: "Weekly", helper: "Week ending snapshot" },
  { value: "ptd", label: "Period-to-date", helper: "Period-to-date block" },
  { value: "qtd", label: "QTR-to-date", helper: "Quarter-to-date block" },
];

export const TRAINING_TIPS: Record<CanonicalKpiKey, TrainingTip> = {
  cars: {
    whereFrom: "Pulled from POS visit counts or lane check-in feed.",
    howToImprove: "Tighten greeting cadence, reduce wait time, and keep bays open.",
    commonMistakes: "Counting estimates as cars or missing after-hours entries.",
  },
  sales: {
    whereFrom: "Net sales export from POS or finance pack.",
    howToImprove: "Focus on repair authorizations and premium oil mix.",
    commonMistakes: "Mixing gross and net or excluding taxes inconsistently.",
  },
  aro: {
    whereFrom: "Calculated: net sales divided by cars.",
    howToImprove: "Quote the full package and narrate the inspection.",
    commonMistakes: "Using gross sales or dividing by tickets instead of cars.",
  },
  big4: {
    whereFrom: "KPI export / Big 4 section.",
    howToImprove: "Rehearse pitch, set daily targets, and audit attachment scripts.",
    commonMistakes: "Including non-Big4 add-ons or pulling a weekly percent into a daily cell.",
  },
  premiumOil: {
    whereFrom: "PMIX or SKU-level mix report.",
    howToImprove: "Lead with premium options and anchor benefits early.",
    commonMistakes: "Counting promo codes as premium or omitting package changes.",
  },
  coolants: {
    whereFrom: "Service mix / cooling system exports.",
    howToImprove: "Pre-stage estimates and show interval due dates.",
    commonMistakes: "Using unit counts instead of % of cars.",
  },
  diff: {
    whereFrom: "Service mix report.",
    howToImprove: "Plan capacity by bay and preset quotes during wait.",
    commonMistakes: "Mixing front/rear together or missing AWD splits.",
  },
  wipers: {
    whereFrom: "Accessory mix report.",
    howToImprove: "Demo wipes on arrival and bundle pairs.",
    commonMistakes: "Logging unit volume instead of % of cars.",
  },
  air: {
    whereFrom: "Filter mix report.",
    howToImprove: "Open hood on greet and show filter condition.",
    commonMistakes: "Combining air and cabin or using units instead of cars.",
  },
  cabin: {
    whereFrom: "Filter mix report (cabin).",
    howToImprove: "Walk the guest through cabin filter benefits.",
    commonMistakes: "Using revenue instead of mix percent.",
  },
  nps: {
    whereFrom: "CX or survey export (NPS).",
    howToImprove: "Close strong, verify resolution, and capture contact method.",
    commonMistakes: "Using CSAT in place of NPS or lagged reporting windows.",
  },
  discounts: {
    whereFrom: "POS discount/markdown export.",
    howToImprove: "Guardrails on coupons and manager approvals.",
    commonMistakes: "Forgetting to back out refunds or tax, mixing comps with markdowns.",
  },
};

export const DEFAULT_SELECTED_KPIS: CanonicalKpiKey[] = [
  "cars",
  "sales",
  "aro",
  "big4",
  "premiumOil",
  "coolants",
  "diff",
  "wipers",
  "air",
  "cabin",
  "nps",
  "discounts",
];

export const DEFAULT_GOALS: GoalMap = {
  cars: { goal: 120, direction: "higher" },
  sales: { goal: 18000, direction: "higher" },
  aro: { goal: 150, direction: "higher" },
  big4: { goal: 0.4, direction: "higher" },
  premiumOil: { goal: 0.2, direction: "higher" },
  coolants: { goal: 0.08, direction: "higher" },
  diff: { goal: 0.1, direction: "higher" },
  wipers: { goal: 0.25, direction: "higher" },
  air: { goal: 0.25, direction: "higher" },
  cabin: { goal: 0.18, direction: "higher" },
  nps: { goal: 75, direction: "higher" },
  discounts: { goal: 0.05, direction: "lower" },
};

const sampleBaseValues: Partial<Record<CanonicalKpiKey, number>> = {
  cars: 132,
  sales: 19400,
  aro: 147,
  big4: 0.41,
  premiumOil: 0.19,
  coolants: 0.09,
  diff: 0.08,
  wipers: 0.27,
  air: 0.24,
  cabin: 0.19,
  nps: 77,
  discounts: 0.04,
};

export const SAMPLE_ROWS: NormalizedRow[] = [
  {
    shopNumber: "105",
    districtName: "Baton Rouge North",
    sectionKind: "daily",
    dateLabel: "Today",
    values: sampleBaseValues,
  },
  {
    shopNumber: "221",
    districtName: "Baton Rouge North",
    sectionKind: "daily",
    dateLabel: "Today",
    values: { ...sampleBaseValues, cars: 118, sales: 18110, premiumOil: 0.23, wipers: 0.3, nps: 80 },
  },
  {
    shopNumber: "304",
    districtName: "Gulf Coast",
    sectionKind: "daily",
    dateLabel: "Today",
    values: { ...sampleBaseValues, cars: 140, sales: 20550, aro: 156, big4: 0.44, discounts: 0.03 },
  },
  {
    shopNumber: "412",
    districtName: "Gulf Coast",
    sectionKind: "weekly",
    dateLabel: "WTD",
    values: { ...sampleBaseValues, cars: 865, sales: 121330, aro: 140, premiumOil: 0.21, nps: 73 },
  },
];

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const currencyTerseFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0, notation: "compact" });
const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export const formatKpiValue = (key: CanonicalKpiKey, raw: number | null | undefined): string => {
  if (raw == null || Number.isNaN(raw)) return "--";
  const meta = CANONICAL_KPIS.find((item) => item.key === key);
  if (!meta) return String(raw);
  if (meta.format === "currency") {
    return raw > 100000 ? currencyTerseFormatter.format(raw) : currencyFormatter.format(raw);
  }
  if (meta.format === "percent") {
    return `${decimalFormatter.format(raw * 100)}%`;
  }
  return numberFormatter.format(raw);
};

export const normalizeNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[%,$]/g, "").trim();
    if (!cleaned) return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const deriveDistricts = (rows: NormalizedRow[]): string[] => {
  const districtSet = new Set<string>();
  rows.forEach((row) => {
    if (row.districtName) {
      districtSet.add(row.districtName);
    }
  });
  return Array.from(districtSet);
};
