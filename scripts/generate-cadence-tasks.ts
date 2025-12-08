#!/usr/bin/env tsx
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

type WorksheetSummary = {
  name: string;
  headers: string[];
  rowCount: number;
};

type LocalWorkbookSummary = {
  file: string;
  sheets: WorksheetSummary[];
};

async function fetchParseEndpoint(): Promise<unknown | null> {
  try {
    const res = await fetch("http://127.0.0.1:3000/api/samples/parse-labor", { cache: "no-store" });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const payload = (await res.json()) as unknown;
    return payload;
  } catch (err) {
    void err;
    return null;
  }
}

async function parseLocalWorkbook(): Promise<LocalWorkbookSummary> {
  const fileName = "GC Region Labor 12.06.25.xlsx";
  const samplesDir = path.join(process.cwd(), "PocketManager5_sitetmpupload_samples");
  const filePath = path.join(samplesDir, fileName);
  if (!fs.existsSync(filePath)) throw new Error("Workbook not found: " + filePath);
  const buffer = await fs.promises.readFile(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheets: WorksheetSummary[] = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    const rows = Array.isArray(rawRows) ? rawRows : [];
    const headerRow = rows[0];
    const headers = Array.isArray(headerRow) ? headerRow.map((value) => String(value ?? "").trim()) : [];
    sheets.push({ name, headers, rowCount: rows.length });
  }
  return { file: fileName, sheets };
}

async function main() {
  console.log("Trying to fetch parse endpoint at http://127.0.0.1:3000/api/samples/parse-labor...");
  const remote = await fetchParseEndpoint();
  const result = remote ?? await parseLocalWorkbook();
  const outPath = path.join(process.cwd(), "scripts", "generated-cadence-tasks.json");
  await fs.promises.writeFile(outPath, JSON.stringify(result, null, 2), "utf-8");
  console.log("Wrote:", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
