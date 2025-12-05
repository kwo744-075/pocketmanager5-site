import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { createInventoryExportJob } from "@/lib/inventoryCaptainServer";
import type { InventoryExportJobStatus } from "@/lib/inventoryCaptainServer";
import { InventoryRunNotFoundError, loadInventoryRun } from "../run-utils";
import type { ShopDayInventoryStatus } from "@/lib/inventory-captain/types";

const toCsvValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const buildShopCsv = (rows: ShopDayInventoryStatus[]) => {
  const header = [
    "Store Number",
    "Region",
    "District",
    "Date",
    "Did Count",
    "Lubes/Oil Qty",
    "Lubes/Oil $",
    "Oil Filters Qty",
    "Oil Filters $",
    "Air Filters Qty",
    "Air Filters $",
    "Wipers Qty",
    "Wipers $",
    "Cabins Qty",
    "Cabins $",
    "Adjustment Variance",
  ];
  const lines = rows.map((row) =>
    [
      row.storeNumber,
      row.region ?? "",
      row.district ?? "",
      row.date,
      row.didCount ? "Yes" : "No",
      row.categories.lubesOil.qty,
      row.categories.lubesOil.value,
      row.categories.oilFilters.qty,
      row.categories.oilFilters.value,
      row.categories.airFilters.qty,
      row.categories.airFilters.value,
      row.categories.wipers.qty,
      row.categories.wipers.value,
      row.categories.cabins.qty,
      row.categories.cabins.value,
      row.adjustmentVarianceValue,
    ]
      .map(toCsvValue)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
};

type ShopExportRequest = {
  runId?: string | null;
  shopStatuses?: ShopDayInventoryStatus[];
};

export async function POST(request: Request) {
  try {
    let body: ShopExportRequest = {};
    try {
      body = (await request.json()) as ShopExportRequest;
    } catch {
      body = {};
    }

    const runId = typeof body.runId === "string" && body.runId.trim() ? body.runId : null;
    let rows: ShopDayInventoryStatus[] = [];
    if (runId) {
      const run = await loadInventoryRun(runId);
      rows = run.shopStatuses;
    } else if (Array.isArray(body.shopStatuses)) {
      rows = body.shopStatuses;
    }

    if (!rows.length) {
      return NextResponse.json({ error: "No shop statuses available for export." }, { status: 400 });
    }

    const csv = buildShopCsv(rows);
    const downloadUrl = `data:text/csv;base64,${Buffer.from(csv, "utf8").toString("base64")}`;

    let jobId = `shops-${Date.now()}`;
    let status: InventoryExportJobStatus = "ready";
    let readyAt = new Date().toISOString();

    if (runId) {
      const session = await getServerSession();
      const job = await createInventoryExportJob({
        runId,
        jobType: "shops_csv",
        status: "ready",
        downloadUrl,
        requestedBy: session?.user?.id ?? null,
        requestedEmail: session?.user?.email ?? null,
        payload: { shopCount: rows.length },
      });
      jobId = job.id;
      status = job.status;
      readyAt = job.readyAt ?? readyAt;
    }

    return NextResponse.json({
      exportId: jobId,
      status,
      readyAt,
      downloadUrl,
    });
  } catch (error) {
    if (error instanceof InventoryRunNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[InventoryCaptain] export-shops failed", error);
    return NextResponse.json({ error: "Unable to build export" }, { status: 500 });
  }
}
