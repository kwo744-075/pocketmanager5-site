import type { InventoryThresholdConfig } from "./types";

export type InventoryThresholdRecord = InventoryThresholdConfig & {
  source: "alignment" | "global" | "fallback";
};

export type InventoryShopDirectoryEntry = {
  shopId: string | null;
  shopNumber: number;
  shopName: string | null;
  districtId: string | null;
  districtName: string | null;
  regionId: string | null;
  regionName: string | null;
};
