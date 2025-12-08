import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { promises as fs } from "node:fs";
import * as XLSX from "xlsx";
import type { NextRequest } from "next/server";

const SIM_CSV_PATH = path.join(process.cwd(), "PocketManager5_sitetmpupload_samples", "supabase_checkins_unified.csv");
const DEFAULT_DATE = "2025-01-15";
const DEFAULT_SUBMITTED_AT = `${DEFAULT_DATE}T12:00:00.000Z`;

const parseNumeric = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "").trim();
    if (!cleaned) {
      return 0;
    }
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const parseStoreNumber = (value: unknown): string => {
  const numeric = Math.round(parseNumeric(value));
  return Number.isFinite(numeric) && numeric > 0 ? String(numeric) : "unknown";
};

const buildPayloadFromRow = (row: Record<string, unknown>) => {
  const shopNumber = parseStoreNumber(row["store"]);
  const timeSlotValue = row["__time_slot"];
  const timeSlot = typeof timeSlotValue === "string" && timeSlotValue.trim().length > 0 ? timeSlotValue : "12pm";

  return {
    shop_id: `sim-shop-${shopNumber}`,
    check_in_date: DEFAULT_DATE,
    time_slot: timeSlot,
    cars: parseNumeric(row["cars"]),
    sales: parseNumeric(row["sales"]),
    big4: parseNumeric(row["big4"]),
    coolants: parseNumeric(row["coolants"]),
    diffs: parseNumeric(row["diffs"]),
    fuel_filters: parseNumeric(row["Fuel Filters"]),
    donations: parseNumeric(row["donations"]),
    mobil1: parseNumeric(row["mobil1"]),
    temperature: "green",
    is_submitted: true,
    submitted_at: DEFAULT_SUBMITTED_AT,
  } satisfies CheckInPayload;
};

const loadSimRows = async () => {
  const buffer = await fs.readFile(SIM_CSV_PATH);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return [] as Record<string, unknown>[];
  }
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
};

type CheckInPayload = {
  shop_id: string;
  check_in_date: string;
  time_slot: string;
  cars: number;
  sales: number;
  big4: number;
  coolants: number;
  diffs: number;
  fuel_filters: number;
  donations: number;
  mobil1: number;
  temperature: string | null;
  is_submitted: boolean;
  submitted_at: string;
};

test("pulse-check check-ins POST consumes sim CSV rows", async () => {
  const rows = await loadSimRows();
  assert.ok(rows.length > 0, "simulation CSV should have rows");
  const sampleRows = rows.slice(0, 15);

  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role";
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.test";

  const { getSupabaseAdmin } = await import("@/lib/supabaseAdmin");
  const supabaseAdmin = getSupabaseAdmin();
  const originalFrom = supabaseAdmin.from;
  const insertPayloads: CheckInPayload[] = [];

  (supabaseAdmin as unknown as { from: (table: string) => unknown }).from = (table: string) => {
    if (table !== "check_ins") {
      throw new Error(`Unexpected table: ${table}`);
    }

    const selectBuilder = {
      eq: () => selectBuilder,
      maybeSingle: async () => ({ data: null, error: null as null }),
    };

    return {
      select: () => selectBuilder,
      upsert: (rowsToInsert: CheckInPayload[]) => {
        insertPayloads.push(rowsToInsert[0]);
        return {
          select: async () => ({ data: rowsToInsert.map((row) => ({ time_slot: row.time_slot })), error: null }),
        };
      },
    };
  };

  try {
    const { POST } = await import("../app/api/pulse-check5/check-ins/route");

    for (const row of sampleRows) {
      const payload = buildPayloadFromRow(row);
      const response = await POST({ json: async () => ({ payload }) } as NextRequest);
      assert.equal(response.status, 200, "route should succeed");
      const result = await response.json();
      assert.equal(result.success, true);
    }

    assert.equal(insertPayloads.length, sampleRows.length, "should upsert one row per check-in");

    sampleRows.forEach((row, index) => {
      const inserted = insertPayloads[index];
      const expectedFuelFilters = parseNumeric(row["Fuel Filters"]);
      assert.equal(inserted.fuel_filters, expectedFuelFilters);
      assert.equal(inserted.cars, parseNumeric(row["cars"]));
      assert.equal(inserted.sales, parseNumeric(row["sales"]));
      assert.equal(inserted.shop_id, `sim-shop-${parseStoreNumber(row["store"])}`);
    });
  } finally {
    (supabaseAdmin as unknown as { from: typeof originalFrom }).from = originalFrom;
  }
});
