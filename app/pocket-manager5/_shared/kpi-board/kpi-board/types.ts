export type CanonicalKpiKey =
  | "cars"
  | "sales"
  | "aro"
  | "big4"
  | "premiumOil"
  | "coolants"
  | "diff"
  | "wipers"
  | "air"
  | "cabin"
  | "nps"
  | "discounts";

export type PresetKind = "daily" | "weekly" | "monthly" | "period";
export type UploadSectionKind = "daily" | "weekly" | "ptd" | "qtd";

export type GoalDirection = "higher" | "lower";

export type GoalConfig = {
  goal: number | null;
  direction: GoalDirection;
};

export type GoalMap = Partial<Record<CanonicalKpiKey, GoalConfig>>;

export type KpiColumnMapping = {
  shopNumber?: string;
  districtName?: string;
  date?: string;
} & Partial<Record<CanonicalKpiKey, string>>;

export type TrainingTip = {
  whereFrom: string;
  howToImprove: string;
  commonMistakes: string;
};

export type NormalizedRow = {
  shopNumber: string;
  districtName: string | null;
  sectionKind: UploadSectionKind;
  dateLabel: string | null;
  values: Partial<Record<CanonicalKpiKey, number | null>>;
};

export type UploadParseResult = {
  rows: Record<string, unknown>[];
  columns: string[];
  fileName: string;
  sheetName: string;
  headerRow: number;
  sectionKind: UploadSectionKind;
};

export type KpiBoardPreset = {
  id: string;
  preset_kind: PresetKind;
  district_name: string | null;
  title: string;
  mapping: Record<string, string>;
  goals: GoalMap;
  selected_kpis: CanonicalKpiKey[];
  created_at?: string;
  created_by?: string;
};

export type KpiBoardUpload = {
  id: string;
  preset_id: string | null;
  created_at?: string;
  created_by?: string;
  source_filename?: string | null;
  sheet_name?: string | null;
  section_kind: UploadSectionKind;
  normalized_rows: NormalizedRow[];
  district_name?: string | null;
};

export type KpiBoardState = {
  step: number;
  trainingMode: boolean;
  presetKind: PresetKind;
  sectionKind: UploadSectionKind;
  mapping: KpiColumnMapping;
  selectedKpis: CanonicalKpiKey[];
  goals: GoalMap;
  rows: NormalizedRow[];
  activeDistrict?: string | null;
};

export type CanonicalKpi = {
  key: CanonicalKpiKey;
  label: string;
  format: "number" | "currency" | "percent";
  group: "traffic" | "controllables" | "addOns" | "experience" | "discounts";
  defaultDirection: GoalDirection;
  description?: string;
};

export const CANONICAL_KPIS: CanonicalKpi[] = [
  { key: "cars", label: "Cars", format: "number", group: "traffic", defaultDirection: "higher" },
  { key: "sales", label: "Sales / Net Sales", format: "currency", group: "traffic", defaultDirection: "higher" },
  { key: "aro", label: "ARO", format: "currency", group: "traffic", defaultDirection: "higher" },
  { key: "big4", label: "Big 4 %", format: "percent", group: "controllables", defaultDirection: "higher" },
  { key: "premiumOil", label: "Premium Oil", format: "percent", group: "controllables", defaultDirection: "higher", description: "PMIX premium share" },
  { key: "coolants", label: "Coolants %", format: "percent", group: "controllables", defaultDirection: "higher" },
  { key: "diff", label: "Diff %", format: "percent", group: "controllables", defaultDirection: "higher" },
  { key: "wipers", label: "Wipers %", format: "percent", group: "addOns", defaultDirection: "higher" },
  { key: "air", label: "Air %", format: "percent", group: "addOns", defaultDirection: "higher" },
  { key: "cabin", label: "Cabin %", format: "percent", group: "addOns", defaultDirection: "higher" },
  { key: "nps", label: "NPS", format: "number", group: "experience", defaultDirection: "higher" },
  { key: "discounts", label: "Discounts %", format: "percent", group: "discounts", defaultDirection: "lower" },
];
