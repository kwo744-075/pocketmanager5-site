import type { InventoryThresholdRecord } from "./metadata";
import type { DistrictInventorySummary, ShopDayInventoryStatus } from "./types";

export type InventoryRunFilters = {
  startDate?: string | null;
  endDate?: string | null;
  region?: string | null;
  district?: string | null;
};

export type InventoryRunRecord = {
  id: string;
  createdAt: string;
  reportingStart: string | null;
  reportingEnd: string | null;
  dataSource: string;
  fileName: string | null;
  adjustFileName: string | null;
  processedBy: string | null;
  uploaderUserId: string | null;
  uploaderAlignmentId: string | null;
  rowCount: number;
  totalVariance: number;
  thresholdConfig: InventoryThresholdRecord;
  filters: InventoryRunFilters;
  shopStatuses: ShopDayInventoryStatus[];
  districtSummaries: DistrictInventorySummary[];
};
