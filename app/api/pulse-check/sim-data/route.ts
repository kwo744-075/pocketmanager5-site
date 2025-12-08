import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { promises as fs } from "node:fs";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

const SIM_CSV_PATH = path.join(process.cwd(), "PocketManager5_sitetmpupload_samples", "supabase_checkins_unified.csv");

const parseNumericCell = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "").trim();
    if (!cleaned) {
      return null;
    }
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseShopNumber = (value: unknown): number | null => {
  const numeric = parseNumericCell(value);
  if (numeric === null) {
    return null;
  }
  const rounded = Math.round(numeric);
  return Number.isFinite(rounded) ? rounded : null;
};

export async function GET(request: NextRequest) {
  try {
    const csvBuffer = await fs.readFile(SIM_CSV_PATH);
    const url = new URL(request.url);
    const format = (url.searchParams.get("format") ?? "").toLowerCase();

    if (format === "csv") {
      return new NextResponse(csvBuffer, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=\"supabase_checkins_unified.csv\"",
        },
      });
    }

    const workbook = XLSX.read(csvBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ rows: [], totalRows: 0, filteredRows: 0, shopNumber: null });
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

    const targetShop = parseShopNumber(url.searchParams.get("shopNumber"));
    const filteredRows =
      targetShop === null
        ? rows
        : rows.filter((row) => {
            const storeValue = row.store ?? row["shop"] ?? row["store #"] ?? row["shop #"] ?? null;
            const parsedStore = parseShopNumber(storeValue);
            return parsedStore === targetShop;
          });

    return NextResponse.json({
      rows: filteredRows,
      totalRows: rows.length,
      filteredRows: filteredRows.length,
      shopNumber: targetShop,
    });
  } catch (error) {
    console.error("Sim data route error", error);
    return NextResponse.json({ error: "Unable to load simulation dataset." }, { status: 500 });
  }
}
