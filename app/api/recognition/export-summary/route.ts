import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { formatRecognitionMetricValue, RECOGNITION_METRICS } from "@/lib/recognition-captain/config";
import type { CelebrationEntry, ConfirmationRow, ManualAwardEntry } from "@/lib/recognition-captain/types";
import { loadRecognitionRun, RecognitionRunNotFoundError, type RecognitionRunRecord } from "../run-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SummaryExportRequest = {
  runId?: string | null;
  manualAwards?: ManualAwardEntry[];
  confirmations?: ConfirmationRow[];
  birthdays?: CelebrationEntry[];
};

export async function POST(request: Request) {
  try {
    const body = await readRequestBody<SummaryExportRequest>(request);
    const run = await loadRecognitionRun(body.runId);
    const manualAwards = body.manualAwards ?? run.manualAwards ?? [];
    const confirmations = body.confirmations ?? run.confirmations ?? [];
    const birthdays = body.birthdays ?? run.birthdays ?? [];
    const csv = buildSummaryCsv(run, manualAwards, confirmations, birthdays);
    const downloadUrl = `data:text/csv;base64,${Buffer.from(csv, "utf8").toString("base64")}`;

    return NextResponse.json({
      exportId: `${run.id}-summary`,
      status: "ready",
      readyAt: new Date().toISOString(),
      downloadUrl,
    });
  } catch (error) {
    if (error instanceof RecognitionRunNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Recognition summary export error", error);
    return NextResponse.json({ error: "Unable to queue summary export" }, { status: 500 });
  }
}

async function readRequestBody<T>(request: Request): Promise<T> {
  try {
    const text = await request.text();
    if (!text) {
      return {} as T;
    }
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

function buildSummaryCsv(
  run: RecognitionRunRecord,
  manualAwards: ManualAwardEntry[],
  confirmations: ConfirmationRow[],
  birthdays: CelebrationEntry[],
): string {
  const rows: (string | number)[][] = [];

  rows.push(["Recognition Run ID", run.id]);
  rows.push(["Reporting Period", run.reportingPeriod]);
  rows.push(["Processed By", run.summary.processedBy || "—"]);
  rows.push(["Processed At", new Date(run.summary.processedAt).toLocaleString()]);
  rows.push(["Data Source", run.dataSource]);
  rows.push(["Row Count", run.summary.rowCount]);
  rows.push(["Median Car Count", run.summary.medianCarCount]);
  rows.push(["Average Ticket", run.summary.averageTicket]);

  if (run.submissionNotes.length) {
    rows.push([]);
    run.submissionNotes.forEach((note, index) => rows.push([`Submission Note ${index + 1}`, note]));
  }

  rows.push([]);
  rows.push(["Award Winners"]);
  rows.push(["Award", "Rank", "Shop #", "Shop Name", "Manager", "Metric", "Value", "Δ Metric", "Δ Value", "District", "Region"]);

  if (run.awards.length === 0) {
    rows.push(["No awards available", "", "", "", "", "", "", "", "", "", ""]);
  } else {
    run.awards.forEach((award) => {
      if (!award.winners.length) {
        rows.push([award.awardLabel, "—", "—", "No qualifying shops", "", award.awardLabel, "", "", "", "", ""]);
        return;
      }

      award.winners.forEach((winner) => {
        rows.push([
          award.awardLabel,
          winner.rank,
          winner.shopNumber,
          winner.shopName,
          winner.managerName,
          winner.metricKey,
          formatRecognitionMetricValue(winner.metricKey, winner.metricValue),
          winner.deltaMetricKey ?? "",
          winner.deltaMetricKey ? formatRecognitionMetricValue(winner.deltaMetricKey, winner.deltaMetricValue ?? null) : "",
          winner.districtName ?? "",
          winner.regionName ?? "",
        ]);
      });
    });
  }

  rows.push([]);
  rows.push(["Dataset"]);
  const metricHeaders = RECOGNITION_METRICS.map((metric) => metric.label);
  rows.push(["Shop #", "Shop Name", "Manager", "District", "Region", ...metricHeaders]);

  run.dataset.forEach((row) => {
    const metricValues = RECOGNITION_METRICS.map((metric) => formatRecognitionMetricValue(metric.key, row.metrics[metric.key]));
    rows.push([
      row.shopNumber,
      row.shopName,
      row.managerName,
      row.districtName,
      row.regionName,
      ...metricValues,
    ]);
  });

  if (manualAwards.length) {
    rows.push([]);
    rows.push(["Manual Awards"]);
    rows.push(["Level", "Award", "Winner", "Shop", "Rationale", "Captured By"]);
    manualAwards.forEach((entry) => {
      rows.push([
        entry.level,
        entry.title,
        entry.winnerName,
        entry.winnerShop ? `#${entry.winnerShop}` : "—",
        entry.rationale || "—",
        entry.createdBy ?? "—",
      ]);
    });
  }

  const notedConfirmations = confirmations.filter((row) => {
    const dm = row.dmNote?.trim();
    const rd = row.rdNote?.trim();
    return Boolean(dm || rd);
  });

  if (notedConfirmations.length) {
    rows.push([]);
    rows.push(["Confirmation Notes"]);
    rows.push(["Award", "Winner", "Shop", "DM Note", "RD Note"]);
    notedConfirmations.forEach((row) => {
      rows.push([
        row.awardLabel,
        row.winnerName,
        row.shopLabel ?? (row.shopNumber ? `#${row.shopNumber}` : "—"),
        row.dmNote ?? "",
        row.rdNote ?? "",
      ]);
    });
  }

  if (birthdays.length) {
    rows.push([]);
    rows.push(["Upcoming Birthdays"]);
    rows.push(["Name", "Shop", "Date", "Days Until", "Favorite Treat", "Celebration Notes"]);
    birthdays.forEach((entry) => {
      rows.push([
        entry.name,
        entry.shopNumber,
        entry.dateLabel,
        entry.daysUntil,
        entry.favoriteTreat ?? "",
        entry.celebrationNotes ?? entry.note ?? "",
      ]);
    });
  }

  return rows.map((cells) => cells.map(csvEscape).join(",")).join("\n");
}

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const stringValue = typeof value === "string" ? value : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}
