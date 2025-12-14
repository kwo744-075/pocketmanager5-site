import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import * as XLSX from "xlsx";

type WorkbookRow = Record<string, string | number | null | undefined>;
type ParsedFields = Record<string, string | string[] | undefined>;
type ParsedFile = {
  filepath?: string;
  originalFilename?: string | null;
  mimetype?: string | null;
  size?: number;
};
type ParsedFiles = Record<string, ParsedFile | ParsedFile[]>;

export const config = {
  api: {
    bodyParser: false,
  },
};

function parseForm(req: NextApiRequest): Promise<{ fields: ParsedFields; files: ParsedFiles }> {
  const form = formidable({ multiples: false });
  return new Promise((resolve, reject) => {
    form.parse(req, (err: unknown, fields: ParsedFields, files: ParsedFiles) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

const normalizeValue = (value: string | number | null | undefined) => {
  if (typeof value === "string") return value.trim().toLowerCase();
  if (typeof value === "number" && Number.isFinite(value)) return value.toString().trim().toLowerCase();
  return "";
};

const pickCell = (row: WorkbookRow, keys: string[]): string | number | null | undefined => {
  for (const key of keys) {
    if (key in row && row[key] !== undefined) {
      return row[key];
    }
  }
  return undefined;
};

const toNumeric = (value: string | number | null | undefined): number | "" => {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : "";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { files } = await parseForm(req);
    const uploaded = files.file;
    const file: ParsedFile | undefined = Array.isArray(uploaded) ? uploaded[0] : uploaded;

    if (!file || !file.filepath) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const workbook = XLSX.readFile(file.filepath);
    const financialSheetName = workbook.SheetNames[0];
    const kpiSheetName = workbook.SheetNames[1] || financialSheetName;

    const financialSheet = workbook.Sheets[financialSheetName];
    const kpiSheet = workbook.Sheets[kpiSheetName];

    const financialJson = XLSX.utils.sheet_to_json<WorkbookRow>(financialSheet, { defval: null });
    const kpiJson = XLSX.utils.sheet_to_json<WorkbookRow>(kpiSheet, { defval: null });

    const mappedFinancials = ["Sales", "Cars", "Labor %", "Profit"].map((label) => {
      const row = financialJson.find((candidate) => {
        const value = pickCell(candidate, ["Metric", "metric", "Name", "name"]);
        return normalizeValue(value).trim() === label.toLowerCase();
      });
      return {
        id: label.toLowerCase().replace(/[^a-z0-9]/g, ""),
        label,
        budget: row ? toNumeric(pickCell(row, ["Budget", "budget"])) : "",
        actual: row ? toNumeric(pickCell(row, ["Actual", "actual"])) : "",
      };
    });

    const mappedKpis = ["Big 4 %", "ARO $", "Mobil 1 %", "Coolants %", "Diffs %"].map((label) => {
      const row = kpiJson.find((candidate) => {
        const value = pickCell(candidate, ["KPI", "kpi", "Name", "name"]);
        return normalizeValue(value).trim() === label.toLowerCase();
      });
      return {
        id: label.toLowerCase().replace(/[^a-z0-9]/g, ""),
        label,
        target: row ? toNumeric(pickCell(row, ["Target", "target"])) : "",
        actual: row ? toNumeric(pickCell(row, ["Actual", "actual"])) : "",
      };
    });

    return res.status(200).json({
      ok: true,
      financials: mappedFinancials,
      kpis: mappedKpis,
    });
  } catch (err) {
    console.error("upload-excel error:", err);
    return res.status(500).json({ error: "Failed to parse Excel file" });
  }
}
