export type LaborScope = "region" | "district" | "shop";

export type LaborScopeRow = {
  scope: LaborScope;
  scopeKey: string | null;
  scopeName: string | null;
  districtName: string | null;
  regionName: string | null;
  shopNumber: string | null;
  totalEntries: number;
  allowedHours: number;
  actualHours: number;
  varianceHours: number;
  avgExpectedPct: number;
  avgActualPct: number;
  latestEntry: string | null;
};

export type LaborComplianceRow = {
  districtName: string;
  regionName: string;
  weekStart: string | null;
  weekEnd: string | null;
  entriesThisWeek: number;
  allowedHours: number;
  totalHours: number;
  overtimeHours: number;
  latestEntry: string | null;
};
