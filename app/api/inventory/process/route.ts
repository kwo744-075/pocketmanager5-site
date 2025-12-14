import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { resolveInventoryCategory } from "@/lib/inventory-captain/config";
import { getServerSession } from "@/lib/auth/session";
import { buildShopDirectoryMap, loadInventoryShopDirectory, loadInventoryThresholdConfig, saveInventoryRun } from "@/lib/inventoryCaptainServer";
import type {
  CategoryVariance,
  DistrictInventorySummary,
  InventoryCategory,
  InventoryLogRow,
  InventoryProcessResponse,
  ShopDayInventoryStatus,
} from "@/lib/inventory-captain/types";

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const CATEGORY_KEYS: InventoryCategory[] = ["lubesOil", "oilFilters", "airFilters", "wipers", "cabins"];
const COLUMN_ALIASES: Record<keyof InventoryLogRow, string[]> = {
  entryLogId: ["ENTRY LOG ID", "ENTRY ID", "LOG ID"],
  storeNumber: ["STORE NUMBER", "STORE", "SHOP #", "SHOP", "SHOP NUMBER"],
  region: ["REGION"],
  district: ["DISTRICT"],
  date: ["DATE", "ENTRY DATE"],
  logType: ["LOG TYPE", "TYPE"],
  productCode: ["PRODUCT CODE", "CODE"],
  partNumber: ["PART NUMBER", "SKU", "ITEM NUMBER"],
  partDescription: ["PART DESCRIPTION", "DESCRIPTION", "ITEM NAME"],
  quantityChange: ["QUANTITY CHANGE", "QTY", "NET QTY"],
  cost: ["COST", "UNIT COST", "EXTENDED COST"],
};

const normalizeHeader = (value: string) => value.trim().toUpperCase();
const numberFrom = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return parsed;
};

const toIsoDate = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = Math.round(value * 24 * 60 * 60 * 1000);
    return new Date(EXCEL_EPOCH + milliseconds).toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
};

const getFieldValue = (row: Record<string, unknown>, aliases: string[]) => {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const match = keys.find((key) => normalizeHeader(key) === alias);
    if (match) {
      return row[match];
    }
  }
  return undefined;
};

const parseWorkbook = (buffer: ArrayBuffer): InventoryLogRow[] => {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheet];
  if (!sheet) {
    return [];
  }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  return rows
    .map((record) => {
      const entry: Partial<InventoryLogRow> = {};
      (Object.keys(COLUMN_ALIASES) as Array<keyof InventoryLogRow>).forEach((field) => {
        const rawValue = getFieldValue(record, COLUMN_ALIASES[field]);
        switch (field) {
          case "entryLogId":
            entry[field] = numberFrom(rawValue);
            break;
          case "storeNumber":
            entry[field] = numberFrom(rawValue);
            break;
          case "quantityChange":
            entry[field] = numberFrom(rawValue);
            break;
          case "cost":
            entry[field] = numberFrom(rawValue);
            break;
          case "date":
            entry[field] = toIsoDate(rawValue) ?? undefined;
            break;
          default: {
            const normalized = typeof rawValue === "string"
              ? rawValue.trim()
              : rawValue != null
                ? String(rawValue).trim()
                : undefined;
            entry[field] = normalized ? normalized : undefined;
            break;
          }
        }
      });
      if (!entry.storeNumber || !entry.date) {
        return null;
      }
      return entry as InventoryLogRow;
    })
    .filter((row): row is InventoryLogRow => Boolean(row));
};

const passesFilters = (
  row: InventoryLogRow,
  filters: { startDate?: string | null; endDate?: string | null; region?: string | null; district?: string | null },
) => {
  if (filters.startDate && row.date < filters.startDate) {
    return false;
  }
  if (filters.endDate && row.date > filters.endDate) {
    return false;
  }
  if (filters.region && row.region?.toLowerCase() !== filters.region.toLowerCase()) {
    return false;
  }
  if (filters.district && row.district?.toLowerCase() !== filters.district.toLowerCase()) {
    return false;
  }
  return true;
};

const blankCategoryRecord = (): Record<InventoryCategory, CategoryVariance> => ({
  lubesOil: { qty: 0, value: 0 },
  oilFilters: { qty: 0, value: 0 },
  airFilters: { qty: 0, value: 0 },
  wipers: { qty: 0, value: 0 },
  cabins: { qty: 0, value: 0 },
});

const ensureShopDayEntry = (
  map: Map<string, ShopDayInventoryStatus>,
  row: Pick<InventoryLogRow, "storeNumber" | "region" | "district" | "date">,
) => {
  const key = `${row.storeNumber}-${row.date}`;
  if (!map.has(key)) {
    map.set(key, {
      storeNumber: row.storeNumber,
      region: row.region,
      district: row.district,
      date: row.date,
      categories: blankCategoryRecord(),
      adjustmentVarianceValue: 0,
      didCount: false,
    });
  }
  return map.get(key)!;
};

const weeksInRange = (start?: string | null, end?: string | null) => {
  if (!start || !end) {
    return 1;
  }
  const rangeMs = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(rangeMs) || rangeMs <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(rangeMs / (7 * 24 * 60 * 60 * 1000)));
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const rawFile = formData.get("rawFile");
    if (!(rawFile instanceof File)) {
      return NextResponse.json({ error: "rawFile is required" }, { status: 400 });
    }

    const adjustFile = formData.get("adjustFile");
    const startDate = (formData.get("startDate") as string | null) || null;
    const endDate = (formData.get("endDate") as string | null) || null;
    const region = (formData.get("region") as string | null) || null;
    const district = (formData.get("district") as string | null) || null;

    const filters = { startDate, endDate, region, district };

    const session = await getServerSession();
    const alignmentId = session.alignment?.activeAlignmentId ?? null;
    const uploaderUserId = session.user?.id ?? null;
    const uploaderEmail = session.user?.email ?? null;
    const processedBy = uploaderEmail ?? "inventory@take5.local";

    const [thresholdConfig, shopDirectoryEntries, rawBuffer, adjustBuffer] = await Promise.all([
      loadInventoryThresholdConfig(alignmentId),
      loadInventoryShopDirectory(),
      rawFile.arrayBuffer(),
      adjustFile instanceof File ? adjustFile.arrayBuffer() : Promise.resolve(null),
    ]);
    const directoryMap = buildShopDirectoryMap(shopDirectoryEntries);

    const rawRows = parseWorkbook(rawBuffer).filter((row) => passesFilters(row, filters));
    if (!rawRows.length) {
      return NextResponse.json({ shopStatuses: [], districtSummaries: [] } satisfies InventoryProcessResponse);
    }

    const adjustmentRows = (adjustBuffer ? parseWorkbook(adjustBuffer) : rawRows.filter((row) => row.logType?.toLowerCase() === "adjust")).filter((row) => passesFilters(row, filters));

    const shopMap = new Map<string, ShopDayInventoryStatus>();

    rawRows.forEach((row) => {
      ensureShopDayEntry(shopMap, row);
    });

    adjustmentRows.forEach((row) => {
      const entry = ensureShopDayEntry(shopMap, row);
      const category = resolveInventoryCategory(row);
      const qty = row.quantityChange ?? 0;
      const value = qty * (row.cost ?? 0);
      entry.categories[category].qty += qty;
      entry.categories[category].value += value;
      entry.adjustmentVarianceValue += value;
      entry.didCount = entry.didCount || Math.abs(qty) > 0 || Boolean(row.logType);
    });

    const shopStatuses = Array.from(shopMap.values()).sort((a, b) => {
      if (a.storeNumber === b.storeNumber) {
        return a.date.localeCompare(b.date);
      }
      return a.storeNumber - b.storeNumber;
    });

    shopStatuses.forEach((status) => {
      const metadata = directoryMap.get(status.storeNumber);
      if (!metadata) {
        return;
      }
      status.storeName = metadata.shopName ?? status.storeName;
      status.region = metadata.regionName ?? status.region;
      status.district = metadata.districtName ?? status.district;
    });

    const summaries = new Map<string, DistrictInventorySummary>();
    const shopsPerDistrict = new Map<string, Set<number>>();

    shopStatuses.forEach((status) => {
      const key = `${status.region || ""}|${status.district || ""}`;
      if (!summaries.has(key)) {
        summaries.set(key, {
          district: status.district,
          region: status.region,
          lubesOil: { qty: 0, value: 0 },
          oilFilters: { qty: 0, value: 0 },
          airFilters: { qty: 0, value: 0 },
          wipers: { qty: 0, value: 0 },
          cabins: { qty: 0, value: 0 },
          adjustmentVarianceValue: 0,
          onTimeCounts: 0,
          totalCountTarget: 0,
          countCompliance: 0,
        });
      }
      const summary = summaries.get(key)!;
      CATEGORY_KEYS.forEach((category) => {
        summary[category].qty += status.categories[category].qty;
        summary[category].value += status.categories[category].value;
      });
      summary.adjustmentVarianceValue += status.adjustmentVarianceValue;
      if (status.didCount) {
        summary.onTimeCounts += 1;
      }
      if (!shopsPerDistrict.has(key)) {
        shopsPerDistrict.set(key, new Set<number>());
      }
      shopsPerDistrict.get(key)!.add(status.storeNumber);
    });

    const coveredStart = startDate ?? shopStatuses[0]?.date ?? null;
    const coveredEnd = endDate ?? shopStatuses[shopStatuses.length - 1]?.date ?? null;
    const totalWeeks = weeksInRange(coveredStart, coveredEnd);
    const cfg = thresholdConfig;

    summaries.forEach((summary, key) => {
      const shopCount = shopsPerDistrict.get(key)?.size ?? 0;
      summary.totalCountTarget = Math.max(1, shopCount) * totalWeeks * cfg.countsPerShopPerWeek;
      summary.countCompliance = summary.totalCountTarget ? summary.onTimeCounts / summary.totalCountTarget : 0;
    });

    const districtSummaries = Array.from(summaries.values()).sort((a, b) => (a.region || "").localeCompare(b.region || "") || (a.district || "").localeCompare(b.district || ""));

    const runId = await saveInventoryRun({
      filters,
      thresholdConfig,
      shopStatuses,
      districtSummaries,
      dataSource: rawFile.name || "Inventory Upload",
      fileName: rawFile.name ?? null,
      adjustFileName: adjustFile instanceof File ? adjustFile.name ?? null : null,
      processedBy,
      uploaderUserId,
      uploaderAlignmentId: alignmentId,
    });

    const uploaderContext = {
      userId: uploaderUserId,
      email: uploaderEmail,
      alignmentId,
    } as const;

    return NextResponse.json({
      runId,
      uploader: uploaderContext,
      thresholds: thresholdConfig,
      shopStatuses,
      districtSummaries,
    } satisfies InventoryProcessResponse & {
      runId: string;
      uploader: typeof uploaderContext;
      thresholds: typeof thresholdConfig;
    });
  } catch (error) {
    console.error("[InventoryCaptain] process route failed", error);
    return NextResponse.json({ error: "Unable to process inventory data" }, { status: 500 });
  }
}
