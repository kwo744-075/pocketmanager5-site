import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { formatRecognitionMetricValue } from "@/lib/recognition-captain/config";
import type { ConfirmationRow, ManualAwardEntry } from "@/lib/recognition-captain/types";
import { loadRecognitionRun, RecognitionRunNotFoundError, type RecognitionRunRecord } from "../run-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PptxExportRequest = {
  runId?: string | null;
  manualAwards?: ManualAwardEntry[];
  confirmations?: ConfirmationRow[];
};

type TableCell = string | number | { text: string; options?: Record<string, unknown> };
type TableRow = TableCell[];

type Slide = {
  background?: { fill: string };
  addText: (text: string, options: Record<string, unknown>) => void;
  addTable: (rows: TableRow[], options: Record<string, unknown>) => void;
};

type Presentation = {
  author: string;
  company: string;
  subject: string;
  title: string;
  addSlide: () => Slide;
  write: (outputType: "nodebuffer") => Promise<Buffer>;
};

type PresentationConstructor = new () => Presentation;

export async function POST(request: Request) {
  try {
    const body = await readRequestBody<PptxExportRequest>(request);
    const run = await loadRecognitionRun(body.runId);
    const manualAwards = body.manualAwards ?? run.manualAwards ?? [];
    const confirmations = body.confirmations ?? run.confirmations ?? [];
    const buffer = await buildRecognitionDeck(run, manualAwards, confirmations);
    const downloadUrl = `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${buffer.toString("base64")}`;

    return NextResponse.json({
      exportId: `${run.id}-pptx`,
      status: "ready",
      readyAt: new Date().toISOString(),
      downloadUrl,
    });
  } catch (error) {
    if (error instanceof RecognitionRunNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Recognition pptx export error", error);
    return NextResponse.json({ error: "Unable to queue PPTX export" }, { status: 500 });
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

async function buildRecognitionDeck(
  run: RecognitionRunRecord,
  manualAwards: ManualAwardEntry[],
  confirmations: ConfirmationRow[],
): Promise<Buffer> {
  const PptxGenJS = (await import("pptxgenjs")).default as unknown as PresentationConstructor;
  const pptx = new PptxGenJS();

  pptx.author = "Pocket Manager 5";
  pptx.company = "Take 5 Oil Change";
  pptx.subject = "Recognition Captain Export";
  pptx.title = `Recognition Captains – ${run.reportingPeriod}`;

  buildTitleSlide(pptx.addSlide(), run);
  buildSummarySlide(pptx.addSlide(), run);
  if (manualAwards.length) {
    buildManualAwardsSlide(pptx.addSlide(), manualAwards);
  }
  if (confirmations.length) {
    buildConfirmationSlide(pptx.addSlide(), confirmations);
  }
  run.awards.forEach((award) => buildAwardSlide(pptx.addSlide(), award.awardLabel, award.description, award.winners));

  return pptx.write("nodebuffer");
}

function buildTitleSlide(slide: Slide, run: RecognitionRunRecord) {
  slide.background = { fill: "0F172A" };
  slide.addText("Recognition Captain", {
    x: 0.6,
    y: 0.8,
    fontSize: 34,
    bold: true,
    color: "FFFFFF",
  });
  slide.addText(`Reporting Period: ${run.reportingPeriod}`, {
    x: 0.6,
    y: 1.8,
    fontSize: 20,
    color: "FACC15",
  });
  slide.addText(`Processed ${new Date(run.summary.processedAt).toLocaleString()} by ${run.summary.processedBy || "Recognition Captain"}`, {
    x: 0.6,
    y: 2.4,
    fontSize: 14,
    color: "C7D2FE",
  });
  slide.addText(`Source: ${run.dataSource}`, {
    x: 0.6,
    y: 3.0,
    fontSize: 14,
    color: "C7D2FE",
  });
}

function buildSummarySlide(slide: Slide, run: RecognitionRunRecord) {
  slide.addText("Processing Summary", {
    x: 0.5,
    y: 0.4,
    fontSize: 24,
    bold: true,
    color: "0F172A",
  });

  const rows: TableRow[] = [
    ["Metric", "Value"],
    ["Row Count", run.summary.rowCount],
    ["Median Car Count", run.summary.medianCarCount],
    ["Average Ticket", run.summary.averageTicket],
  ];

  slide.addTable(rows, {
    x: 0.5,
    y: 1.1,
    w: 4.8,
    colW: [2.4, 2.4],
    fontSize: 14,
    border: { type: "solid", color: "CBD5F5", pt: 1.2 },
    fill: { color: "FFFFFF" },
  });

  const notes = run.submissionNotes.length ? run.submissionNotes : ["No parser notes recorded."];
  slide.addText("Submission Notes", {
    x: 5.6,
    y: 0.4,
    fontSize: 18,
    bold: true,
    color: "0F172A",
  });
  slide.addText(
    notes.map((note, index) => `${index + 1}. ${note}`).join("\n"),
    {
      x: 5.6,
      y: 1.0,
      w: 4.0,
      h: 4.0,
      fontSize: 14,
      color: "1E293B",
      wrap: true,
    },
  );
}

function buildManualAwardsSlide(slide: Slide, manualAwards: ManualAwardEntry[]) {
  slide.addText("Manual Awards", {
    x: 0.5,
    y: 0.4,
    fontSize: 24,
    bold: true,
    color: "0F172A",
  });

  const rows: TableRow[] = [["Level", "Award", "Winner", "Shop", "Rationale"]];
  manualAwards.forEach((entry) => {
    rows.push([
      entry.level,
      entry.title,
      entry.winnerName,
      entry.winnerShop ? `#${entry.winnerShop}` : "—",
      entry.rationale || "—",
    ]);
  });

  slide.addTable(rows, {
    x: 0.5,
    y: 1.0,
    w: 9.0,
    fontSize: 12,
    border: { type: "solid", color: "E2E8F0", pt: 1 },
    fill: { color: "FFFFFF" },
    autoPage: true,
    autoPageRepeatHeader: true,
  });
}

function buildConfirmationSlide(slide: Slide, confirmations: ConfirmationRow[]) {
  slide.addText("Confirmation Notes", {
    x: 0.5,
    y: 0.4,
    fontSize: 24,
    bold: true,
    color: "0F172A",
  });

  const rows: TableRow[] = [["Award", "Winner", "DM Note", "RD Note"]];
  confirmations
    .filter((row) => (row.dmNote?.trim() ?? "") || (row.rdNote?.trim() ?? ""))
    .forEach((row) => {
      rows.push([
        row.awardLabel,
        `${row.winnerName}${row.shopLabel ? ` (${row.shopLabel})` : ""}`,
        row.dmNote ?? "",
        row.rdNote ?? "",
      ]);
    });

  slide.addTable(rows, {
    x: 0.5,
    y: 1.0,
    w: 9.0,
    fontSize: 12,
    border: { type: "solid", color: "E2E8F0", pt: 1 },
    fill: { color: "FFFFFF" },
    autoPage: true,
    autoPageRepeatHeader: true,
  });
}

function buildAwardSlide(slide: Slide, title: string, description: string, winners: RecognitionRunRecord["awards"][number]["winners"]) {
  slide.addText(title, {
    x: 0.5,
    y: 0.4,
    fontSize: 24,
    bold: true,
    color: "0F172A",
  });
  slide.addText(description, {
    x: 0.5,
    y: 1.0,
    fontSize: 14,
    color: "475569",
    wrap: true,
    w: 8.0,
  });

  const rows: TableRow[] = [
    ["Rank", "Shop", "Manager", "Metric", "Value", "Δ"],
  ];

  if (!winners.length) {
    rows.push(["—", "No qualifying shops", "", "", "", ""]);
  } else {
    winners.forEach((winner) => {
      rows.push([
        winner.rank,
        `${winner.shopNumber} · ${winner.shopName}`,
        winner.managerName,
        winner.metricKey,
        formatRecognitionMetricValue(winner.metricKey, winner.metricValue),
        winner.deltaMetricKey
          ? formatRecognitionMetricValue(winner.deltaMetricKey, winner.deltaMetricValue ?? null)
          : "",
      ]);
    });
  }

  slide.addTable(rows, {
    x: 0.5,
    y: 1.7,
    w: 9.0,
    colW: [0.8, 2.8, 2.2, 1.5, 1.4, 1.3],
    fontSize: 12,
    border: { type: "solid", color: "E2E8F0", pt: 1 },
    fill: { color: "FFFFFF" },
    autoPage: true,
    autoPageRepeatHeader: true,
  });
}
