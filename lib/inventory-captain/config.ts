import type { InventoryCategory, InventoryThresholdConfig, InventoryLogRow } from "./types";

export type InventoryCategoryRule = {
  category: InventoryCategory;
  match?: {
    includes?: string[];
    startsWith?: string[];
    equals?: string[];
  };
};

const normalize = (value?: string | null) => value?.toUpperCase().trim() ?? "";

export const INVENTORY_CATEGORY_RULES: InventoryCategoryRule[] = [
  {
    category: "oilFilters",
    match: {
      includes: ["OIL FILTER"],
    },
  },
  {
    category: "airFilters",
    match: {
      includes: ["AIR FILTER"],
    },
  },
  {
    category: "cabins",
    match: {
      includes: ["CABIN FILTER"],
    },
  },
  {
    category: "wipers",
    match: {
      includes: ["WIPER"],
    },
  },
  {
    category: "lubesOil",
    match: {
      includes: ["LUBE", "LUBRICANT", "BULK OIL", "OIL"],
    },
  },
];

export const INVENTORY_CATEGORY_LABELS: Record<InventoryCategory, string> = {
  lubesOil: "Lubricants / Oil",
  oilFilters: "Oil Filters",
  airFilters: "Air Filters",
  wipers: "Wipers",
  cabins: "Cabin Filters",
};

export const DEFAULT_INVENTORY_THRESHOLD_CONFIG: InventoryThresholdConfig = {
  countsPerShopPerWeek: 5,
  greenCompliance: 0.95,
  yellowCompliance: 0.85,
};

export const resolveInventoryCategory = (row: Pick<InventoryLogRow, "productCode" | "partDescription">): InventoryCategory => {
  const haystacks = [normalize(row.productCode), normalize(row.partDescription)];
  for (const rule of INVENTORY_CATEGORY_RULES) {
    const target = rule.match;
    if (!target) {
      return rule.category;
    }
    const matchesIncludes = target.includes?.some((needle) => haystacks.some((value) => value.includes(needle)));
    const matchesStartsWith = target.startsWith?.some((needle) => haystacks.some((value) => value.startsWith(needle)));
    const matchesEquals = target.equals?.some((needle) => haystacks.some((value) => value === needle));
    if (matchesIncludes || matchesStartsWith || matchesEquals) {
      return rule.category;
    }
  }
  return "lubesOil";
};
