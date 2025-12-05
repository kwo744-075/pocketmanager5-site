// pages/api/presenter/generate.ts
import type { NextApiRequest, NextApiResponse } from "next";

type TableCell = string | number | { text: string; options?: Record<string, unknown> };
type TableRow = TableCell[];

type PresentationSlide = {
  background?: { fill: string };
  addText: (text: string, options: Record<string, unknown>) => void;
  addTable: (rows: TableRow[], options: Record<string, unknown>) => void;
};

type Presentation = {
  author: string;
  company: string;
  subject: string;
  title: string;
  addSlide: () => PresentationSlide;
  write: (outputType: "nodebuffer") => Promise<Buffer>;
};

type PresentationConstructor = new () => Presentation;

type FinancialRow = {
  id: string;
  label: string;
  budget: number | "";
  actual: number | "";
};

type KpiRow = {
  id: string;
  label: string;
  target: number | "";
  actual: number | "";
};

type PresenterFormData = {
  districtName: string;
  dmName: string;
  period: string;
  year: string;
  financials: FinancialRow[];
  kpis: KpiRow[];
  turnoverNotes: string;
  staffingNotes: string;
  talentSnapshot: string;
  regionNotes: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 👇 dynamic import so it only loads on the server at runtime
    const PptxGenJS = (await import("pptxgenjs")).default as unknown as PresentationConstructor;

    const data = req.body as PresenterFormData;

    const pptx = new PptxGenJS();
    pptx.author = "Pocket Manager 5";
    pptx.company = "Take 5 Oil Change";
    pptx.subject = "DM Monthly Business Review";
    pptx.title = `DM Monthly Biz Review - ${data.districtName || "District"}`;

    const titleText = `District: ${data.districtName || "District"}`;
    const subText = `DM: ${data.dmName || "Name"} • Period ${
      data.period || "?"
    } ${data.year || ""}`;

    // Slide 1: Title
    {
      const slide = pptx.addSlide();
      slide.background = { fill: "1F2937" };

      slide.addText("DM Monthly Business Review", {
        x: 0.5,
        y: 0.7,
        w: 9,
        h: 0.8,
        fontSize: 30,
        bold: true,
        color: "FFFFFF",
      });

      slide.addText(titleText, {
        x: 0.5,
        y: 1.7,
        fontSize: 20,
        color: "F97316",
        bold: true,
      });

      slide.addText(subText, {
        x: 0.5,
        y: 2.2,
        fontSize: 14,
        color: "E5E7EB",
      });

      slide.addText("Powered by Pocket Manager 5", {
        x: 0.5,
        y: 6.5,
        fontSize: 10,
        color: "9CA3AF",
      });
    }

    // Slide 2: Financials
    {
      const slide = pptx.addSlide();
      slide.addText("Financial Results (Budget vs Actual)", {
        x: 0.5,
        y: 0.3,
        fontSize: 20,
        bold: true,
        color: "111827",
      });

      const rows: TableRow[] = [
        [
          { text: "Metric", options: { bold: true } },
          { text: "Budget", options: { bold: true } },
          { text: "Actual", options: { bold: true } },
          { text: "Variance", options: { bold: true } },
        ],
        ...data.financials.map((row) => {
          const budget = row.budget === "" ? "" : Number(row.budget);
          const actual = row.actual === "" ? "" : Number(row.actual);
          const variance =
            budget !== "" && actual !== ""
              ? (actual as number) - (budget as number)
              : "";

          return [
            row.label,
            budget !== "" ? budget.toString() : "",
            actual !== "" ? actual.toString() : "",
            variance !== ""
              ? `${variance >= 0 ? "+" : ""}${variance}`
              : "",
          ];
        }),
      ];

      slide.addTable(rows, {
        x: 0.5,
        y: 1.0,
        w: 9.0,
        colW: [3.2, 1.8, 1.8, 2.2],
        border: { type: "solid", color: "D1D5DB", pt: 1 },
        fontSize: 12,
        color: "111827",
        fill: { color: "FFFFFF" },
        valign: "middle",
        rowH: 0.35,
        autoPage: true,
        autoPageRepeatHeader: true,
      });
    }

    // Slide 3: KPI Breakdown
    {
      const slide = pptx.addSlide();
      slide.addText("KPI Breakdown", {
        x: 0.5,
        y: 0.3,
        fontSize: 20,
        bold: true,
        color: "111827",
      });

      const rows: TableRow[] = [
        [
          { text: "KPI", options: { bold: true } },
          { text: "Target", options: { bold: true } },
          { text: "Actual", options: { bold: true } },
          { text: "+/-", options: { bold: true } },
        ],
        ...data.kpis.map((row) => {
          const target = row.target === "" ? "" : Number(row.target);
          const actual = row.actual === "" ? "" : Number(row.actual);
          const diff =
            target !== "" && actual !== ""
              ? (actual as number) - (target as number)
              : "";

          return [
            row.label,
            target !== "" ? target.toString() : "",
            actual !== "" ? actual.toString() : "",
            diff !== "" ? `${diff >= 0 ? "+" : ""}${diff}` : "",
          ];
        }),
      ];

      slide.addTable(rows, {
        x: 0.5,
        y: 1.0,
        w: 9.0,
        colW: [3.0, 2.0, 2.0, 2.0],
        border: { type: "solid", color: "D1D5DB", pt: 1 },
        fontSize: 12,
        fill: { color: "FFFFFF" },
        color: "111827",
        rowH: 0.35,
      });
    }

    // Slide 4: People & Staffing
    {
      const slide = pptx.addSlide();
      slide.addText("People & Staffing", {
        x: 0.5,
        y: 0.3,
        fontSize: 20,
        bold: true,
        color: "111827",
      });

      slide.addText("Turnover / Retention", {
        x: 0.5,
        y: 1.0,
        fontSize: 14,
        bold: true,
        color: "B91C1C",
      });
      slide.addText(data.turnoverNotes || "No notes provided.", {
        x: 0.5,
        y: 1.4,
        w: 9.0,
        h: 1.5,
        fontSize: 12,
        color: "111827",
        wrap: true,
      });

      slide.addText("Staffing & Bench", {
        x: 0.5,
        y: 3.1,
        fontSize: 14,
        bold: true,
        color: "B91C1C",
      });
      slide.addText(data.staffingNotes || "No notes provided.", {
        x: 0.5,
        y: 3.5,
        w: 9.0,
        h: 1.5,
        fontSize: 12,
        color: "111827",
        wrap: true,
      });

      slide.addText("Talent Snapshot / Top Performers", {
        x: 0.5,
        y: 5.2,
        fontSize: 14,
        bold: true,
        color: "B91C1C",
      });
      slide.addText(data.talentSnapshot || "No notes provided.", {
        x: 0.5,
        y: 5.6,
        w: 9.0,
        h: 1.5,
        fontSize: 12,
        color: "111827",
        wrap: true,
      });
    }

    // Slide 5: Region Notes
    {
      const slide = pptx.addSlide();
      slide.addText("Regional Notes / Key Callouts", {
        x: 0.5,
        y: 0.3,
        fontSize: 20,
        bold: true,
        color: "111827",
      });

      slide.addText(data.regionNotes || "No additional notes.", {
        x: 0.5,
        y: 1.0,
        w: 9.0,
        h: 5.0,
        fontSize: 12,
        color: "111827",
        wrap: true,
      });
    }

    const buffer = await pptx.write("nodebuffer");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="DM_Monthly_Biz_Review_${
        data.districtName || "District"
      }_P${data.period || "?"}_${data.year}.pptx"`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
    return res.status(200).send(buffer);
  } catch (err) {
    console.error("generate presenter error:", err);
    return res.status(500).json({ error: "Failed to generate presenter" });
  }
}
