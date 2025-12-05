import { supabaseServer } from "@/lib/supabaseServer";
import { DEFAULT_INVENTORY_THRESHOLD_CONFIG } from "@shared/features/inventory-captain/config";
import type { InventoryRunRecord } from "@shared/features/inventory-captain/runTypes";

export class InventoryRunNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryRunNotFoundError";
  }
}

type InventoryRunRow = {
  id: string;
  created_at: string;
  reporting_start: string | null;
  reporting_end: string | null;
  data_source: string;
  file_name: string | null;
  adjust_file_name: string | null;
  processed_by: string | null;
  uploader_user_id: string | null;
  uploader_alignment_id: string | null;
  row_count: number;
  total_variance: number;
  threshold_config: unknown;
  filters_json: unknown;
  shop_statuses_json: unknown;
  district_summaries_json: unknown;
};

export async function loadInventoryRun(runId?: string | null): Promise<InventoryRunRecord> {
  if (!runId) {
    throw new InventoryRunNotFoundError("Inventory run ID is required.");
  }

  const { data, error } = await supabaseServer
    .from("inventory_runs")
    .select(
      "id, created_at, reporting_start, reporting_end, data_source, file_name, adjust_file_name, processed_by, uploader_user_id, uploader_alignment_id, row_count, total_variance, threshold_config, filters_json, shop_statuses_json, district_summaries_json"
    )
    .eq("id", runId)
    .maybeSingle();

  if (error || !data) {
    throw new InventoryRunNotFoundError("Inventory run not found.");
  }

  const row = data as InventoryRunRow;

  return {
    id: row.id,
    createdAt: row.created_at,
    reportingStart: row.reporting_start,
    reportingEnd: row.reporting_end,
    dataSource: row.data_source,
    fileName: row.file_name,
    adjustFileName: row.adjust_file_name,
    processedBy: row.processed_by,
    uploaderUserId: row.uploader_user_id,
    uploaderAlignmentId: row.uploader_alignment_id,
    rowCount: row.row_count,
    totalVariance: row.total_variance,
    thresholdConfig:
      (row.threshold_config as InventoryRunRecord["thresholdConfig"]) ?? {
        ...DEFAULT_INVENTORY_THRESHOLD_CONFIG,
        source: "fallback",
      },
    filters: (row.filters_json as InventoryRunRecord["filters"]) ?? {},
    shopStatuses: (row.shop_statuses_json as InventoryRunRecord["shopStatuses"]) ?? [],
    districtSummaries: (row.district_summaries_json as InventoryRunRecord["districtSummaries"]) ?? [],
  } satisfies InventoryRunRecord;
}
