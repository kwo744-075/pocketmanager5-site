import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { createInventoryExportJob } from "@/lib/inventoryCaptainServer";
import type { InventoryExportJobStatus } from "@/lib/inventoryCaptainServer";
import { InventoryRunNotFoundError, loadInventoryRun } from "../run-utils";
import type { DistrictInventorySummary } from "@/lib/inventory-captain/types";

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

const buildSummaryCsv = (rows: DistrictInventorySummary[]) => {
  const header = [
    "District",
    "Region",
    "Lubricants/Oil Qty",
    "Lubricants/Oil $",
    "Oil Filters Qty",
    "Oil Filters $",
    "Air Filters Qty",
    "Air Filters $",
    "Wipers Qty",
    "Wipers $",
    "Cabin Filters Qty",
    "Cabin Filters $",
    "Adjustment Variance",
    "On Time Counts",
    "Total Count Target",
    "Count Compliance",
  ];
  const lines = rows.map((row) =>
    [
      row.district ?? "",
      row.region ?? "",
      row.lubesOil.qty,
      row.lubesOil.value,
      row.oilFilters.qty,
      row.oilFilters.value,
      row.airFilters.qty,
      row.airFilters.value,
      row.wipers.qty,
      row.wipers.value,
      row.cabins.qty,
      row.cabins.value,
      row.adjustmentVarianceValue,
      row.onTimeCounts,
      row.totalCountTarget,
      row.countCompliance,
    ]
      .map(toCsvValue)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
};

type SummaryExportRequest = {
  runId?: string | null;
  districtSummaries?: DistrictInventorySummary[];
};

export async function POST(request: Request) {
  try {
    let body: SummaryExportRequest = {};
    try {
      body = (await request.json()) as SummaryExportRequest;
    } catch {
      body = {};
    }

    const runId = typeof body.runId === "string" && body.runId.trim() ? body.runId : null;
    let rows: DistrictInventorySummary[] = [];
    if (runId) {
      const run = await loadInventoryRun(runId);
      rows = run.districtSummaries;
    } else if (Array.isArray(body.districtSummaries)) {
      rows = body.districtSummaries;
    }

    if (!rows.length) {
      return NextResponse.json({ error: "No district summaries available for export." }, { status: 400 });
    }

    const csv = buildSummaryCsv(rows);
    const downloadUrl = `data:text/csv;base64,${Buffer.from(csv, "utf8").toString("base64")}`;

    let jobId = `summary-${Date.now()}`;
    let status: InventoryExportJobStatus = "ready";
    let readyAt = new Date().toISOString();

    if (runId) {
      const session = await getServerSession();
      const job = await createInventoryExportJob({
        runId,
        jobType: "summary_csv",
        status: "ready",
        downloadUrl,
        requestedBy: session?.user?.id ?? null,
        requestedEmail: session?.user?.email ?? null,
        payload: { districtCount: rows.length },
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
    console.error("[InventoryCaptain] export-summary failed", error);
    return NextResponse.json({ error: "Unable to build export" }, { status: 500 });
  }
}
