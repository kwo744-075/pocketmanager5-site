import { Buffer } from "node:buffer";
import * as XLSX from "xlsx";
import { RECOGNITION_METRICS } from "./config";
import type { RecognitionDatasetRow } from "./types";

const BASE_HEADER_SYNONYMS: Record<string, string[]> = {
  shopNumber: [
    "shop",
    "shop number",
    "shop #",
    "store",
    "store number",
    "store #",
    "location",
    "site",
    "site #",
    "location #",
  ],
  shopName: ["shop name", "store name", "location name", "site name"],
  managerName: [
    "manager",
    "manager name",
    "store manager",
    "shop manager",
    "general manager",
    "gm",
    "sm",
    "tech",
    "tech name",
    "technician",
    "technician name",
    "employee",
    "employee name",
    "associate",
    "team member",
    "crew member",
    "advisor",
  ],
  districtName: ["district", "district name", "dm district"],
  regionName: ["region", "market", "area"],
  reportingPeriod: ["period", "fiscal period", "reporting period", "fiscal month", "month", "fp"],
  hireDate: [
    "hire date",
    "start date",
    "employment date",
    "anniversary",
    "anniversary date",
    "date hired",
    "hire",
  ],
};

const METRIC_HEADER_SYNONYMS: Record<string, string[]> = {
  carCount: [
    "car count",
    "cars",
    "total cars",
    "volume",
    "units",
    "car total",
    "oil change",
    "oil changes",
    "oil change count",
    "oil change #",
  ],
  carGrowth: ["car growth", "growth", "growth %", "cars growth", "car yoy", "cars yoy", "car delta"],
  sales: ["sales", "total sales", "revenue", "gross sales", "sales $"],
  ticket: ["ticket", "avg ticket", "average ticket", "ticket avg", "ticket $"],
  csi: ["csi", "guest", "guest score", "guest experience", "nps", "csat"],
  retention: ["retention", "loyalty", "return rate", "repeat %", "crm retention"],
  safetyScore: ["safety", "safety score", "compliance", "safety index"],
};

const REQUIRED_HEADER_KEYS = ["shopNumber", "carCount"] as const;
const HEADER_SCAN_LIMIT = 200;

const PERCENT_METRIC_KEYS = new Set(
  RECOGNITION_METRICS.filter((metric) => metric.format === "percent").map((metric) => metric.key),
);

const normalizedBaseSynonyms = buildSynonymMap(BASE_HEADER_SYNONYMS);
const normalizedMetricSynonyms = buildSynonymMap(METRIC_HEADER_SYNONYMS);

const DEFAULT_MANAGER = "Unassigned Manager";
const DEFAULT_DISTRICT = "Unassigned District";
const DEFAULT_REGION = "Unassigned Region";

export class RecognitionUploadError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "RecognitionUploadError";
    this.status = status;
  }
}

export type ParsedRecognitionUpload = {
  rows: RecognitionDatasetRow[];
  reportingPeriod?: string;
  dataSource?: string;
  submissionNotes: string[];
};

export async function parseRecognitionUpload(file: File): Promise<ParsedRecognitionUpload> {
  const buffer = Buffer.from(await file.arrayBuffer());
  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    throw new RecognitionUploadError("Unable to read workbook. Upload CSV or XLSX exports only.", 400);
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      continue;
    }

    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null }) as unknown[][];
    const headerInfo = findHeaderInfo(matrix);
    if (!headerInfo) {
      continue;
    }

    const { headerIndex, columnMap } = headerInfo;
    const rows = matrix.slice(headerIndex + 1);
    const parsed = buildDatasetFromSheet(rows, columnMap);

    if (!parsed.dataset.length) {
      continue;
    }

    const inferredPeriod = parsed.reportingPeriod ?? inferPeriodFromFileName(file.name);
    const notes: string[] = [`${parsed.dataset.length} KPI rows ingested from "${sheetName}".`];

    if (parsed.notes.length) {
      notes.push(...parsed.notes);
    }

    if (!parsed.reportingPeriod && inferredPeriod) {
      notes.push(`Reporting period inferred from ${file.name}.`);
    }

    return {
      rows: parsed.dataset,
      reportingPeriod: inferredPeriod,
      dataSource: sheetName ? `${file.name} › ${sheetName}` : file.name,
      submissionNotes: notes,
    };
  }

  throw new RecognitionUploadError(
    "Unable to locate KPI headers. Ensure the sheet includes Shop, Manager, and Car Count columns.",
    422,
  );
}

type ColumnMap = Partial<Record<string, number>>;

type SheetParseResult = {
  dataset: RecognitionDatasetRow[];
  notes: string[];
  reportingPeriod?: string;
};

function buildDatasetFromSheet(rows: unknown[][], columnMap: ColumnMap): SheetParseResult {
  const dataset: RecognitionDatasetRow[] = [];
  const notes: string[] = [];

  if (columnMap.managerName === undefined) {
    notes.push("Manager column missing; defaulting to placeholder names.");
  }
  if (columnMap.districtName === undefined) {
    notes.push("District column missing; defaulting to 'Unassigned District'.");
  }
  if (columnMap.regionName === undefined) {
    notes.push("Region column missing; defaulting to 'Unassigned Region'.");
  }

  const missingMetrics = RECOGNITION_METRICS.filter((metric) => columnMap[metric.key] === undefined).map(
    (metric) => metric.label,
  );
  if (missingMetrics.length) {
    notes.push(`Missing metrics detected: ${missingMetrics.join(", ")}.`);
  }

  const reportingPeriod = normalizeReportingPeriod(extractTextValue(rows, columnMap.reportingPeriod) ?? undefined);

  for (const row of rows) {
    if (!Array.isArray(row) || row.every(isBlankCell)) {
      continue;
    }

    const shopNumberIndex = columnMap.shopNumber;
    if (shopNumberIndex === undefined) {
      break;
    }

    const shopNumber = parseShopNumber(row[shopNumberIndex]);
    if (shopNumber === null) {
      continue;
    }

    const shopName = coerceText(row[columnMap.shopName ?? -1]) || `Shop ${shopNumber}`;
    const managerName = coerceText(row[columnMap.managerName ?? -1]) || DEFAULT_MANAGER;
    const districtName = coerceText(row[columnMap.districtName ?? -1]) || DEFAULT_DISTRICT;
    const regionName = coerceText(row[columnMap.regionName ?? -1]) || DEFAULT_REGION;

    const metrics: RecognitionDatasetRow["metrics"] = {};

    for (const metric of RECOGNITION_METRICS) {
      const columnIndex = columnMap[metric.key];
      const value = columnIndex !== undefined ? sanitizeMetricValue(metric.key, row[columnIndex]) : null;
      metrics[metric.key] = value;
    }

    if (metrics.carCount === null) {
      continue;
    }

    dataset.push({
      shopNumber,
      shopName,
      managerName,
      districtName,
      regionName,
      metrics,
      hireDate: parseHireDate(row[columnMap.hireDate ?? -1]),
    });
  }

  return { dataset, notes, reportingPeriod };
}

function findHeaderInfo(matrix: unknown[][]): { headerIndex: number; columnMap: ColumnMap } | null {
  const searchDepth = Math.min(matrix.length, HEADER_SCAN_LIMIT);
  for (let index = 0; index < searchDepth; index += 1) {
    const row = matrix[index];
    if (!Array.isArray(row)) {
      continue;
    }
    const columnMap = buildColumnMap(row);
    const hasRequiredHeaders = REQUIRED_HEADER_KEYS.every((key) => columnMap[key] !== undefined);
    if (hasRequiredHeaders) {
      return { headerIndex: index, columnMap };
    }
  }
  return null;
}

function buildColumnMap(row: unknown[]): ColumnMap {
  const map: ColumnMap = {};
  row.forEach((cell, index) => {
    const normalized = normalizeHeaderValue(cell);
    if (!normalized) {
      return;
    }
    const rawText = typeof cell === "string" ? cell.trim().toLowerCase() : "";

    for (const [key, values] of Object.entries(normalizedBaseSynonyms)) {
      if (values.has(normalized) && map[key] === undefined) {
        map[key] = index;
        return;
      }
    }

    for (const [key, values] of Object.entries(normalizedMetricSynonyms)) {
      if (values.has(normalized) && map[key] === undefined) {
        map[key] = index;
        return;
      }
    }

    if (map.shopNumber === undefined && rawText) {
      const mentionsStore = rawText.includes("store");
      const referencesNumber = /#|number|no\b/.test(rawText);
      const isExplicitStoreColumn = mentionsStore && (referencesNumber || rawText === "store");
      const looksLikeName = rawText.includes("name");
      if (isExplicitStoreColumn && !looksLikeName) {
        map.shopNumber = index;
        return;
      }
    }
  });
  return map;
}

function normalizeHeaderValue(value: unknown): string {
  if (typeof value === "string") {
    return value
      .trim()
      .toLowerCase()
      .replace(/[-_/]+/g, " ")
      .replace(/[^a-z0-9% ]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }
  return "";
}

function buildSynonymMap(values: Record<string, string[]>): Record<string, Set<string>> {
  return Object.fromEntries(
    Object.entries(values).map(([key, options]) => {
      const normalizedOptions = new Set<string>();
      options.forEach((entry) => normalizedOptions.add(normalizeHeaderValue(entry)));
      normalizedOptions.add(normalizeHeaderValue(key));
      return [key, normalizedOptions];
    }),
  );
}

function parseShopNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string") {
    const digits = value.replace(/[^0-9]/g, "");
    if (!digits) {
      return null;
    }
    const parsed = Number(digits);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseHireDate(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const serialDate = parseExcelSerialDate(value);
    if (serialDate) {
      return serialDate.toISOString();
    }
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "-") {
      return null;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return null;
}

function parseExcelSerialDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) {
    return null;
  }
  const milliseconds = (serial - 25569) * 86400000;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date;
}

function coerceText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

type ParsedNumber = {
  value: number | null;
  percentLike: boolean;
};

function coerceNumber(value: unknown): ParsedNumber {
  if (typeof value === "number") {
    return Number.isFinite(value) ? { value, percentLike: false } : { value: null, percentLike: false };
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return { value: null, percentLike: false };
    }
    let normalized = trimmed;
    let negative = false;
    if (/^\(.*\)$/.test(normalized)) {
      negative = true;
      normalized = normalized.slice(1, -1);
    }
    const percentLike = /%/.test(normalized);
    normalized = normalized.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
    if (!normalized) {
      return { value: null, percentLike };
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      return { value: null, percentLike };
    }
    return { value: negative ? -parsed : parsed, percentLike };
  }
  return { value: null, percentLike: false };
}

function sanitizeMetricValue(metricKey: string, rawValue: unknown): number | null {
  const { value, percentLike } = coerceNumber(rawValue);
  if (value === null) {
    return null;
  }

  if (metricKey === "carCount") {
    return Math.round(value);
  }

  if (PERCENT_METRIC_KEYS.has(metricKey)) {
    if (percentLike) {
      return Number(value.toFixed(2));
    }
    if (Math.abs(value) <= 1) {
      return Number((value * 100).toFixed(2));
    }
    return Number(value.toFixed(2));
  }

  return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
}

function isBlankCell(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  return false;
}

function extractTextValue(rows: unknown[][], columnIndex: number | undefined): string | null {
  if (columnIndex === undefined) {
    return null;
  }
  for (const row of rows) {
    if (!Array.isArray(row)) {
      continue;
    }
    const value = coerceText(row[columnIndex]);
    if (value) {
      return value;
    }
  }
  return null;
}

function normalizeReportingPeriod(input?: string | null): string | undefined {
  if (!input) {
    return undefined;
  }
  const prepared = input.trim();
  if (!prepared) {
    return undefined;
  }

  const periodMatch = prepared.match(/p\s*0*(\d{1,2})\s*(?:fy)?\s*(\d{2,4})/i);
  if (periodMatch) {
    const period = periodMatch[1].padStart(2, "0");
    let year = periodMatch[2];
    if (year.length === 2) {
      year = `20${year}`;
    }
    return `P${period} ${year}`;
  }

  const monthMatch = prepared.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s/-]*(20\d{2}|\d{2})/i);
  if (monthMatch) {
    const monthToken = monthMatch[1];
    let year = monthMatch[2];
    if (year.length === 2) {
      year = `20${year}`;
    }
    const month = monthToken.charAt(0).toUpperCase() + monthToken.slice(1, 3).toLowerCase();
    return `${month} ${year}`;
  }

  return undefined;
}

function inferPeriodFromFileName(fileName?: string): string | undefined {
  if (!fileName) {
    return undefined;
  }
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
  return normalizeReportingPeriod(base);
}
