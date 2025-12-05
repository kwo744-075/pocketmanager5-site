import { supabaseServer } from "@/lib/supabaseServer";
import { DEFAULT_INVENTORY_THRESHOLD_CONFIG } from "@/lib/inventory-captain/config";
import type { InventoryShopDirectoryEntry, InventoryThresholdRecord } from "@/lib/inventory-captain/metadata";
import type { InventoryRunFilters } from "@/lib/inventory-captain/runTypes";
import type { DistrictInventorySummary, ShopDayInventoryStatus } from "@/lib/inventory-captain/types";

type ThresholdRow = {
  alignment_id: string | null;
  counts_per_shop_per_week: number | null;
  green_compliance: number | null;
  yellow_compliance: number | null;
};

type ShopDirectoryRow = {
  shop_id: string | null;
  shop_number: number | null;
  shop_name: string | null;
  district_id: string | null;
  district_name: string | null;
  region_id: string | null;
  region_name: string | null;
};
export type InventoryExportJobType = "summary_csv" | "shops_csv" | "pptx";
export type InventoryExportJobStatus = "queued" | "processing" | "ready" | "failed" | "expired";

export type InventoryExportJobRecord = {
  id: string;
  runId: string;
  jobType: InventoryExportJobType;
  status: InventoryExportJobStatus;
  downloadUrl: string | null;
  readyAt: string | null;
  createdAt: string;
};

const numericOrNull = (value: number | null | undefined): number | null => {
  if (typeof value !== "number") {
    return null;
  }
  if (!Number.isFinite(value)) {
    return null;
  }
  return value;
};

export type InventoryRunInsertPayload = {
  filters: InventoryRunFilters;
  thresholdConfig: InventoryThresholdRecord;
  shopStatuses: ShopDayInventoryStatus[];
  districtSummaries: DistrictInventorySummary[];
  dataSource: string;
  fileName?: string | null;
  adjustFileName?: string | null;
  processedBy?: string | null;
  uploaderUserId?: string | null;
  uploaderAlignmentId?: string | null;
};
export type InventoryExportJobInsertPayload = {
  runId: string;
  jobType: InventoryExportJobType;
  status?: InventoryExportJobStatus;
  downloadUrl?: string | null;
  requestedBy?: string | null;
  requestedEmail?: string | null;
  payload?: Record<string, unknown> | null;
  errorMessage?: string | null;
  readyAt?: string | null;
};

export async function loadInventoryThresholdConfig(alignmentId?: string | null): Promise<InventoryThresholdRecord> {
  try {
    let query = supabaseServer
      .from("inventory_threshold_configs")
      .select("alignment_id, counts_per_shop_per_week, green_compliance, yellow_compliance")
      .order("updated_at", { ascending: false });

    if (alignmentId) {
      query = query.or(`alignment_id.eq.${alignmentId},alignment_id.is.null`).limit(2);
    } else {
      query = query.is("alignment_id", null).limit(1);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const rows = (data as ThresholdRow[] | null) ?? [];
    const alignmentRow = rows.find((row) => alignmentId && row.alignment_id === alignmentId);
    const globalRow = rows.find((row) => !row.alignment_id);
    const resolved = alignmentRow ?? globalRow;

    if (resolved) {
      return {
        countsPerShopPerWeek: numericOrNull(resolved.counts_per_shop_per_week) ?? DEFAULT_INVENTORY_THRESHOLD_CONFIG.countsPerShopPerWeek,
        greenCompliance: numericOrNull(resolved.green_compliance) ?? DEFAULT_INVENTORY_THRESHOLD_CONFIG.greenCompliance,
        yellowCompliance: numericOrNull(resolved.yellow_compliance) ?? DEFAULT_INVENTORY_THRESHOLD_CONFIG.yellowCompliance,
        source: alignmentRow ? "alignment" : "global",
      } satisfies InventoryThresholdRecord;
    }
  } catch (error) {
    console.warn("[InventoryCaptain] threshold config fallback", error);
  }

  return {
    ...DEFAULT_INVENTORY_THRESHOLD_CONFIG,
    source: "fallback",
  } satisfies InventoryThresholdRecord;
}

export async function loadInventoryShopDirectory(): Promise<InventoryShopDirectoryEntry[]> {
  try {
    const { data, error } = await supabaseServer
      .from("inventory_shop_directory_vw")
      .select("shop_id, shop_number, shop_name, district_id, district_name, region_id, region_name")
      .order("shop_number", { ascending: true });

    if (error) {
      throw error;
    }

    return ((data as ShopDirectoryRow[] | null) ?? [])
      .filter((row) => typeof row.shop_number === "number" && Number.isFinite(row.shop_number))
      .map((row) => ({
        shopId: row.shop_id,
        shopNumber: row.shop_number as number,
        shopName: row.shop_name,
        districtId: row.district_id,
        districtName: row.district_name,
        regionId: row.region_id,
        regionName: row.region_name,
      }));
  } catch (error) {
    console.warn("[InventoryCaptain] shop directory fallback", error);
    return [];
  }
}

export function buildShopDirectoryMap(entries: InventoryShopDirectoryEntry[]): Map<number, InventoryShopDirectoryEntry> {
  return entries.reduce((map, entry) => {
    map.set(entry.shopNumber, entry);
    return map;
  }, new Map<number, InventoryShopDirectoryEntry>());
}

export async function saveInventoryRun(payload: InventoryRunInsertPayload): Promise<string> {
  const totalVariance = payload.shopStatuses.reduce((sum, status) => sum + (status.adjustmentVarianceValue ?? 0), 0);
  const { data, error } = await supabaseServer
    .from("inventory_runs")
    .insert({
      reporting_start: payload.filters.startDate ?? null,
      reporting_end: payload.filters.endDate ?? null,
      data_source: payload.dataSource,
      file_name: payload.fileName ?? null,
      adjust_file_name: payload.adjustFileName ?? null,
      processed_by: payload.processedBy ?? null,
      uploader_user_id: payload.uploaderUserId ?? null,
      uploader_alignment_id: payload.uploaderAlignmentId ?? null,
      row_count: payload.shopStatuses.length,
      total_variance: totalVariance,
      threshold_config: payload.thresholdConfig,
      filters_json: payload.filters,
      shop_statuses_json: payload.shopStatuses,
      district_summaries_json: payload.districtSummaries,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    console.error("[InventoryCaptain] run insert failed", error);
    throw new Error("Unable to persist inventory run");
  }

  return data.id as string;
}

export async function createInventoryExportJob(payload: InventoryExportJobInsertPayload): Promise<InventoryExportJobRecord> {
  const status: InventoryExportJobStatus = payload.status ?? (payload.downloadUrl ? "ready" : "queued");
  const readyAt = payload.readyAt ?? (payload.downloadUrl ? new Date().toISOString() : null);

  const { data, error } = await supabaseServer
    .from("inventory_export_jobs")
    .insert({
      run_id: payload.runId,
      job_type: payload.jobType,
      status,
      requested_by: payload.requestedBy ?? null,
      requested_email: payload.requestedEmail ?? null,
      download_url: payload.downloadUrl ?? null,
      payload_json: payload.payload ?? null,
      error_message: payload.errorMessage ?? null,
      ready_at: readyAt,
    })
    .select("id, run_id, job_type, status, download_url, ready_at, created_at")
    .single();

  if (error || !data?.id) {
    console.error("[InventoryCaptain] export job insert failed", error);
    throw new Error("Unable to queue inventory export");
  }

  return {
    id: data.id as string,
    runId: data.run_id as string,
    jobType: data.job_type as InventoryExportJobType,
    status: data.status as InventoryExportJobStatus,
    downloadUrl: (data.download_url as string | null) ?? null,
    readyAt: (data.ready_at as string | null) ?? readyAt,
    createdAt: data.created_at as string,
  } satisfies InventoryExportJobRecord;
}
