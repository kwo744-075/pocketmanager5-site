import "server-only";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { LaborComplianceRow, LaborScope, LaborScopeRow } from "@/lib/laborTypes";

const DEFAULT_LIMIT = 50;

export type LaborRollupRequest = {
  scope?: LaborScope;
  region?: string | null;
  district?: string | null;
  search?: string | null;
  limit?: number;
  offset?: number;
};

export type LaborRollupResponse = {
  scope: LaborScope;
  limit: number;
  offset: number;
  rows: LaborScopeRow[];
};

export async function laborScopeRollup(params: LaborRollupRequest = {}): Promise<LaborRollupResponse> {
  const {
    scope = "district",
    region = null,
    district = null,
    search = null,
    limit = DEFAULT_LIMIT,
    offset = 0,
  } = params;

  const admin = getSupabaseAdmin();
  const payload = {
    p_scope: scope,
    p_region: region,
    p_district: district,
    p_search: search,
    p_limit: clampLimit(limit),
    p_offset: clampOffset(offset),
  } as Record<string, string | number | null>;

  const { data, error } = await admin.rpc("labor_scope_rollup", payload);
  if (error) {
    console.error("labor_scope_rollup RPC failed", error);
    throw error;
  }

  return {
    scope,
    limit: clampLimit(limit),
    offset: clampOffset(offset),
    rows: (data ?? []).map(mapLaborScopeRow),
  };
}

export async function laborDistrictCompliance(region: string | null = null, weekStart?: string | null): Promise<LaborComplianceRow[]> {
  const admin = getSupabaseAdmin();
  const payload: Record<string, string | null> = {
    p_region: region,
    p_week_start: weekStart ?? null,
  };
  const { data, error } = await admin.rpc("labor_district_compliance", payload);
  if (error) {
    console.error("labor_district_compliance RPC failed", error);
    throw error;
  }
  return (data ?? []).map(mapLaborComplianceRow);
}

function mapLaborScopeRow(row: Record<string, unknown>): LaborScopeRow {
  return {
    scope: normalizeScope(row.scope as string | null | undefined),
    scopeKey: (row.scope_key as string | null | undefined) ?? null,
    scopeName: (row.scope_name as string | null | undefined) ?? null,
    districtName: (row.district_name as string | null | undefined) ?? null,
    regionName: (row.region_name as string | null | undefined) ?? null,
    shopNumber: (row.shop_number as string | null | undefined) ?? null,
    totalEntries: Number(row.total_entries ?? 0),
    allowedHours: Number(row.allowed_hours ?? 0),
    actualHours: Number(row.actual_hours ?? 0),
    varianceHours: Number(row.variance_hours ?? 0),
    avgExpectedPct: Number(row.avg_expected_pct ?? 0),
    avgActualPct: Number(row.avg_actual_pct ?? 0),
    latestEntry: (row.latest_entry as string | null | undefined) ?? null,
  };
}

function mapLaborComplianceRow(row: Record<string, unknown>): LaborComplianceRow {
  return {
    districtName: (row.district_name as string | null | undefined) ?? "",
    regionName: (row.region_name as string | null | undefined) ?? "",
    weekStart: (row.week_start as string | null | undefined) ?? null,
    weekEnd: (row.week_end as string | null | undefined) ?? null,
    entriesThisWeek: Number(row.entries_this_week ?? 0),
    allowedHours: Number(row.allowed_hours ?? 0),
    totalHours: Number(row.total_hours ?? 0),
    overtimeHours: Number(row.overtime_hours ?? 0),
    latestEntry: (row.latest_entry as string | null | undefined) ?? null,
  };
}

function clampLimit(value: number | undefined) {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(value!), 1), 500);
}

function clampOffset(value: number | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(Math.trunc(value!), 0);
}

function normalizeScope(value: string | null | undefined): LaborScope {
  switch ((value ?? "district").toLowerCase()) {
    case "region":
      return "region";
    case "shop":
      return "shop";
    default:
      return "district";
  }
}
