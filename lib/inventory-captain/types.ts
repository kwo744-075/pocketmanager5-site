export type InventoryCategory =
  | "lubesOil"
  | "oilFilters"
  | "airFilters"
  | "wipers"
  | "cabins";

export type InventoryLogRow = {
  entryLogId: number;
  storeNumber: number;
  region: string;
  district: string;
  date: string;
  logType: string;
  productCode: string;
  partNumber: string;
  partDescription: string;
  quantityChange: number;
  cost: number;
};

export type CategoryVariance = {
  qty: number;
  value: number;
};

export type ShopDayInventoryStatus = {
  storeNumber: number;
  storeName?: string;
  region: string;
  district: string;
  date: string;
  categories: Record<InventoryCategory, CategoryVariance>;
  adjustmentVarianceValue: number;
  didCount: boolean;
};

export type DistrictInventorySummary = {
  district: string;
  region: string;
  lubesOil: CategoryVariance;
  oilFilters: CategoryVariance;
  airFilters: CategoryVariance;
  wipers: CategoryVariance;
  cabins: CategoryVariance;
  adjustmentVarianceValue: number;
  onTimeCounts: number;
  totalCountTarget: number;
  countCompliance: number;
};

export type InventoryThresholdConfig = {
  countsPerShopPerWeek: number;
  greenCompliance: number;
  yellowCompliance: number;
};

export type InventoryUploaderContext = {
  userId?: string | null;
  email?: string | null;
  alignmentId?: string | null;
};

export type InventoryProcessResponse = {
  runId?: string;
  uploader?: InventoryUploaderContext | null;
  thresholds?: (InventoryThresholdConfig & { source?: string }) | null;
  shopStatuses: ShopDayInventoryStatus[];
  districtSummaries: DistrictInventorySummary[];
};

export type InventoryExportJob = {
  exportId: string;
  type: "summary" | "shops";
  status: "queued" | "processing" | "ready" | "failed" | "expired";
  requestedAt: string;
  readyAt?: string | null;
  downloadUrl?: string | null;
};
