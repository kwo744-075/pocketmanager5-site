import { NextResponse } from "next/server";

type DmReviewMode = "daily" | "weekly" | "monthly";

type ImportResponse = {
  message: string;
  draft: DmReviewDraft;
  meta: {
    mode: string;
    fileName: string;
    fileSize: number;
    parsedAt: string;
  };
};

type ImportError = { error: string };

type DmReviewDraft = {
  districtName?: string;
  dmName?: string;
  period?: string;
  dayOrWeekLabel?: string;
  year?: string;
  salesBudget?: string;
  salesActual?: string;
  carsBudget?: string;
  carsActual?: string;
  laborBudget?: string;
  laborActual?: string;
  profitBudget?: string;
  profitActual?: string;
  big4Target?: string;
  big4Actual?: string;
  aroTarget?: string;
  aroActual?: string;
  mobilTarget?: string;
  mobilActual?: string;
  coolantsTarget?: string;
  coolantsActual?: string;
  diffsTarget?: string;
  diffsActual?: string;
  turnoverNotes?: string;
  staffingNotes?: string;
  talentNotes?: string;
  regionNotes?: string;
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const modeValue = formData.get("mode");

    if (!(file instanceof File)) {
      return NextResponse.json<ImportError>({ error: "An Excel or CSV upload is required." }, { status: 400 });
    }

    const mode = isDmReviewMode(modeValue) ? modeValue : "daily";
    const { label, period } = resolveModeCopy(mode);

    const mockDraft: DmReviewDraft = {
      districtName: "Demo District",
      dmName: "Sample DM",
      period,
      dayOrWeekLabel: label,
      year: new Date().getFullYear().toString(),
      salesBudget: "$420K",
      salesActual: "$415K",
      carsBudget: "2,600",
      carsActual: "2,540",
      laborBudget: "21.0%",
      laborActual: "21.8%",
      profitBudget: "$92K",
      profitActual: "$88K",
      big4Target: "87%",
      big4Actual: "84%",
      aroTarget: "$160",
      aroActual: "$152",
      mobilTarget: "39%",
      mobilActual: "37%",
      coolantsTarget: "28%",
      coolantsActual: "30%",
      diffsTarget: "19%",
      diffsActual: "18%",
      turnoverNotes: `Loaded from ${file.name}.`,
      staffingNotes: "Need two flex techs at Store 142.",
      talentNotes: "A. Ramirez ready for MIT interview.",
      regionNotes: "Focus week on labor glidepath.",
    };

    return NextResponse.json<ImportResponse>({
      message: `Imported ${file.name} (${formatBytes(file.size)}) for ${mode} mode — sample data applied.`,
      draft: mockDraft,
      meta: {
        mode,
        fileName: file.name,
        fileSize: file.size,
        parsedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("DM review import stub failed", error);
    return NextResponse.json<ImportError>({ error: "Unable to process import right now." }, { status: 500 });
  }
}

function isDmReviewMode(value: unknown): value is DmReviewMode {
  return value === "daily" || value === "weekly" || value === "monthly";
}

function resolveModeCopy(mode: DmReviewMode) {
  if (mode === "daily") {
    return { label: "As of", period: "Today" };
  }
  if (mode === "weekly") {
    return { label: "Week ending", period: "Week 28" };
  }
  return { label: "Period", period: "Period 8" };
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
