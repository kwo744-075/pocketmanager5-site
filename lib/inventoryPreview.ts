import { supabaseServer } from "./supabaseServer";

const DEFAULT_CATEGORIES = [
  { name: "Oils", color: "#FF6B6B" },
  { name: "Oil Filters", color: "#4ECDC4" },
  { name: "Air Filters", color: "#45B7D1" },
  { name: "Wipers", color: "#96CEB4" },
  { name: "Cabin Filters", color: "#FFEAA7" },
  { name: "Miscellaneous", color: "#DFE6E9" },
];
const DEFAULT_CATEGORY_SET = new Set(DEFAULT_CATEGORIES.map((c) => c.name));

const CATEGORY_MAPPING: Record<string, string> = {
  // Oils
  "5W30": "Oils",
  "5W30 BULK": "Oils",
  "0W20": "Oils",
  "0W20 BULK": "Oils",
  "0W16": "Oils",
  "0W16 BULK": "Oils",
  "5W20": "Oils",
  "5W20 BULK": "Oils",

  // Filters
  "Oil Filters": "Oil Filters",
  "Air Filters": "Air Filters",
  "Cabin Filters": "Cabin Filters",

  // Wipers
  "Wipers": "Wipers",
};

const mapToSimplifiedCategory = (original: string | null): string => {
  if (!original) return "Miscellaneous";
  if (CATEGORY_MAPPING[original]) return CATEGORY_MAPPING[original];
  if (original.includes("BEAM ") || original.includes("CONVENTIONAL ") || original.includes("WINTER ") || original.includes("REAR ") || original.includes("EXACT FIT") || original.includes("WIPER") || original.includes("Wiper")) {
    return "Wipers";
  }
  if (original.includes("OIL FILTER") || original.includes("Oil Filter") || original.includes("SYNTHETIC OIL FILTER") || original.includes("SYNTHETIC+ OIL FILTER")) {
    return "Oil Filters";
  }
  if (original.includes("AIR FILTER") || original.includes("Air Filter")) {
    return "Air Filters";
  }
  if (original.includes("CABIN") && original.includes("FILTER")) {
    return "Cabin Filters";
  }
  return "Miscellaneous";
};

export type InventoryPreview = {
  shopNumber: string | null;
  lastSync: string;
  totals: {
    skuCount: number;
    storageUnits: number;
    oilUnits: number;
    variance: number;
    onHold: number;
  };
  alerts: string[];
  categories: {
    name: string;
    color: string;
    skuCount: number;
    variance: number;
  }[];
};

export type InventoryCategoryItem = {
  item: string;
  category: string;
  floor: number;
  storage: number;
  total: number;
  lastChanged: string | null;
};

type InventoryCountRow = {
  itemnumber?: string | null;
  item_number?: string | null;
  floor_count?: number | null;
  floorcount?: number | null;
  storage_count?: number | null;
  storagecount?: number | null;
  last_changed_at?: string | null;
  updated_at?: string | null;
};

type CatalogRow = {
  itemnumber?: string | null;
  item_number?: string | null;
  category?: string | null;
  is_active?: boolean | null;
};

type MasterRow = {
  itemnumber?: string | null;
  item_number?: string | null;
  category?: string | null;
};

const normalizeItem = (row: { itemnumber?: string | null; item_number?: string | null }) => row.itemnumber ?? row.item_number ?? "";

const pickNumber = (value?: number | null) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

export async function fetchInventoryPreview(shopNumber: string | null): Promise<InventoryPreview> {
  const shopId = shopNumber ?? null;

  const [catalogRes, masterRes, countsRes] = await Promise.all([
    shopId
      ? supabaseServer
          .from("shop_catalog")
          .select("itemnumber, item_number, category, is_active")
          .eq("shop_id", shopId)
          .eq("is_active", true)
      : null,
    supabaseServer.from("inventory_items").select("itemnumber, item_number, category"),
    shopId
      ? supabaseServer.from("inventory_counts_v2").select("itemnumber, item_number, floor_count, floorcount, storage_count, storagecount, last_changed_at, updated_at").eq("shop_id", shopId)
      : supabaseServer.from("inventory_counts_v2").select("itemnumber, item_number, floor_count, floorcount, storage_count, storagecount, last_changed_at, updated_at").limit(0),
  ]);

  const masterRows = (masterRes.data as MasterRow[] | null) ?? [];
  const catalogRows = (catalogRes?.data as CatalogRow[] | null) ?? [];
  const countRows = (countsRes.data as InventoryCountRow[] | null) ?? [];

  const sourceRows = catalogRows.length > 0 ? catalogRows : masterRows;

  const categoryMap = new Map<string, number>();
  const itemCategory = new Map<string, string>();

  sourceRows.forEach((row) => {
    const item = normalizeItem(row);
    if (!item) return;
    const mappedCategory = mapToSimplifiedCategory(row.category ?? "");
    itemCategory.set(item, mappedCategory);
    categoryMap.set(mappedCategory, (categoryMap.get(mappedCategory) ?? 0) + 1);
  });

  const categoryCounts = new Map<string, { floor: number; storage: number }>();
  let latestTimestamp: string | null = null;

  countRows.forEach((row) => {
    const item = normalizeItem(row);
    if (!item) return;
    const category = itemCategory.get(item) ?? "Miscellaneous";
    const floor = pickNumber(row.floor_count ?? row.floorcount);
    const storage = pickNumber(row.storage_count ?? row.storagecount);
    const entry = categoryCounts.get(category) ?? { floor: 0, storage: 0 };
    entry.floor += floor;
    entry.storage += storage;
    categoryCounts.set(category, entry);

    const ts = row.last_changed_at ?? row.updated_at;
    if (ts && (!latestTimestamp || ts > latestTimestamp)) {
      latestTimestamp = ts;
    }
  });

  const categories = DEFAULT_CATEGORIES.map((cat) => {
    const counts = categoryCounts.get(cat.name) ?? { floor: 0, storage: 0 };
    return {
      name: cat.name,
      color: cat.color,
      skuCount: categoryMap.get(cat.name) ?? 0,
      variance: counts.floor + counts.storage,
    };
  });

  // Preserve defaults while allowing additional categories to appear after them
  const extraCategories = Array.from(categoryMap.keys())
    .filter((name) => !DEFAULT_CATEGORY_SET.has(name))
    .map((name) => {
      const counts = categoryCounts.get(name) ?? { floor: 0, storage: 0 };
      return {
        name,
        color: "#CBD5E1",
        skuCount: categoryMap.get(name) ?? 0,
        variance: counts.floor + counts.storage,
      };
    });

  const mergedCategories = [...categories, ...extraCategories];

  const totals = mergedCategories.reduce(
    (acc, cat) => {
      acc.skuCount += cat.skuCount;
      if (cat.name === "Oils") {
        acc.oilUnits += cat.variance;
      } else {
        acc.storageUnits += cat.variance;
      }
      acc.variance += cat.variance;
      return acc;
    },
    { skuCount: 0, storageUnits: 0, oilUnits: 0, variance: 0, onHold: 0 }
  );

  const lastSync = latestTimestamp ? new Date(latestTimestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "No counts yet";

  return {
    shopNumber,
    lastSync,
    totals,
    alerts: [],
    categories: mergedCategories,
  };
}

export async function fetchInventoryCategoryItems(shopNumber: string | null, categoryInput: string): Promise<{ items: InventoryCategoryItem[]; lastSync: string }>
{
  const shopId = shopNumber ?? null;
  const targetCategory = mapToSimplifiedCategory(categoryInput);

  const [countsRes, masterRes] = await Promise.all([
    shopId
      ? supabaseServer
          .from("inventory_counts_v2")
          .select("itemnumber, item_number, floor_count, floorcount, storage_count, storagecount, last_changed_at, updated_at")
          .eq("shop_id", shopId)
      : supabaseServer
          .from("inventory_counts_v2")
          .select("itemnumber, item_number, floor_count, floorcount, storage_count, storagecount, last_changed_at, updated_at")
          .limit(0),
    supabaseServer.from("inventory_items").select("itemnumber, item_number, category"),
  ]);

  const masterByItem = new Map<string, string>();
  (masterRes.data as MasterRow[] | null)?.forEach((row) => {
    const key = normalizeItem(row);
    if (!key) return;
    masterByItem.set(key, mapToSimplifiedCategory(row.category ?? ""));
  });

  const items: InventoryCategoryItem[] = [];
  let latestTimestamp: string | null = null;

  (countsRes.data as InventoryCountRow[] | null)?.forEach((row) => {
    const key = normalizeItem(row);
    if (!key) return;
    const mappedCategory = masterByItem.get(key) ?? "Miscellaneous";
    if (mappedCategory !== targetCategory) return;
    const floor = pickNumber(row.floor_count ?? row.floorcount);
    const storage = pickNumber(row.storage_count ?? row.storagecount);
    const total = floor + storage;
    const lastChanged = row.last_changed_at ?? row.updated_at ?? null;
    if (lastChanged && (!latestTimestamp || lastChanged > latestTimestamp)) {
      latestTimestamp = lastChanged;
    }
    items.push({ item: key, category: mappedCategory, floor, storage, total, lastChanged });
  });

  items.sort((a, b) => a.item.localeCompare(b.item));

  const lastSync = latestTimestamp
    ? new Date(latestTimestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "No counts yet";

  return { items, lastSync };
}
