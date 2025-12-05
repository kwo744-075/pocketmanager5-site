import {
  type RecognitionAwardConfig,
  type RecognitionMetricDefinition,
  type RecognitionUploadHint,
} from "./types";

export const RECOGNITION_METRICS: RecognitionMetricDefinition[] = [
  {
    key: "carCount",
    label: "Car Count",
    description: "Total serviced cars for the period.",
    format: "integer",
    higherIsBetter: true,
  },
  {
    key: "carGrowth",
    label: "Car Growth",
    description: "Period car count variance vs. the same period last year.",
    format: "percent",
    precision: 1,
    higherIsBetter: true,
  },
  {
    key: "sales",
    label: "Total Sales",
    description: "Gross sales captured in the KPI table.",
    format: "currency",
    higherIsBetter: true,
  },
  {
    key: "ticket",
    label: "Avg. Ticket",
    description: "Average ticket size for the period.",
    format: "currency",
    precision: 0,
    higherIsBetter: true,
  },
  {
    key: "csi",
    label: "CSI",
    description: "Customer satisfaction index.",
    format: "percent",
    precision: 1,
    higherIsBetter: true,
  },
  {
    key: "retention",
    label: "Retention",
    description: "Return customer capture rate.",
    format: "percent",
    precision: 1,
    higherIsBetter: true,
  },
  {
    key: "safetyScore",
    label: "Safety",
    description: "Safety + compliance composite score.",
    format: "percent",
    precision: 0,
    higherIsBetter: true,
  },
];

export const RECOGNITION_AWARD_CONFIG: RecognitionAwardConfig[] = [
  {
    id: "district-mvp",
    label: "District MVP",
    description: "Balanced growth award that blends cars, ticket, and CSI stability.",
    narrative: "Captures consistent execution across volume and guest experience.",
    colorToken: "from-emerald-500/60 via-emerald-500/10 to-slate-950/70",
    icon: "crown",
    rule: {
      id: "district-mvp",
      metricKey: "carGrowth",
      direction: "desc",
      topN: 3,
      minValue: 0,
      qualifiers: [
        { metricKey: "carCount", comparison: "gte", value: 800, label: "800+ cars" },
        { metricKey: "csi", comparison: "gte", value: 88, label: "88 CSI" },
      ],
      deltaMetricKey: "ticket",
    },
  },
  {
    id: "car-count-crusher",
    label: "Car Count Crusher",
    description: "Highlights pure volume hitters with double digit growth.",
    narrative: "Volume captains who outrun plan without tanking margin.",
    colorToken: "from-sky-500/60 via-sky-500/10 to-slate-950/70",
    icon: "package",
    rule: {
      id: "car-count-crusher",
      metricKey: "carCount",
      direction: "desc",
      topN: 5,
      qualifiers: [{ metricKey: "carGrowth", comparison: "gte", value: 8, label: "+8% growth" }],
      deltaMetricKey: "carGrowth",
    },
  },
  {
    id: "ticket-hawk",
    label: "Ticket Hawk",
    description: "Recognizes shops protecting margin and attachment.",
    narrative: "Showcases attachment discipline without sacrificing CSI.",
    colorToken: "from-amber-500/60 via-amber-500/10 to-slate-950/70",
    icon: "chart",
    rule: {
      id: "ticket-hawk",
      metricKey: "ticket",
      direction: "desc",
      topN: 3,
      qualifiers: [
        { metricKey: "carCount", comparison: "gte", value: 600, label: "600+ cars" },
        { metricKey: "csi", comparison: "gte", value: 90, label: "90 CSI" },
      ],
    },
  },
  {
    id: "csi-guardian",
    label: "CSI Guardian",
    description: "Crowns the highest guest experience operators.",
    narrative: "Keeps the frontline rallying around wow moments.",
    colorToken: "from-violet-500/60 via-violet-500/10 to-slate-950/70",
    icon: "sparkles",
    rule: {
      id: "csi-guardian",
      metricKey: "csi",
      direction: "desc",
      topN: 3,
      qualifiers: [{ metricKey: "carCount", comparison: "gte", value: 500, label: "500 cars" }],
      tieBreakerMetric: "retention",
    },
  },
];

export const RECOGNITION_UPLOAD_HINTS: RecognitionUploadHint[] = [
  {
    title: "Drop in KPI exports",
    description: "Upload the KPI workbook or CSV exported from Pocket Pulse or Cognos. Tabs named KPI, Summary, or DM Snapshot all work.",
  },
  {
    title: "One period at a time",
    description: "Recognition Captain expects a single period or fiscal month per upload so deltas stay accurate.",
  },
  {
    title: "Keep headers intact",
    description: "Column names (shop, SM, cars, growth, ticket, CSI) drive the auto-mapper so avoid renaming them when possible.",
  },
];

export const RECOGNITION_METRIC_LOOKUP = Object.fromEntries(RECOGNITION_METRICS.map((metric) => [metric.key, metric]));

export function formatRecognitionMetricValue(metricKey: string, value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  const definition = RECOGNITION_METRIC_LOOKUP[metricKey];
  if (!definition) {
    return typeof value === "number" ? value.toFixed(1) : "—";
  }

  switch (definition.format) {
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: definition.precision ?? 0,
        maximumFractionDigits: definition.precision ?? 0,
      }).format(value);
    case "integer":
      return Math.round(value).toLocaleString("en-US");
    case "percent":
      return new Intl.NumberFormat("en-US", {
        style: "percent",
        minimumFractionDigits: definition.precision ?? 1,
        maximumFractionDigits: definition.precision ?? 1,
      }).format(value / 100);
    case "decimal":
    default:
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: definition.precision ?? 1,
        maximumFractionDigits: definition.precision ?? 1,
      }).format(value);
  }
}
