import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const SAMPLE_DIR = path.resolve("PocketManager5_sitetmpupload_samples");

const samples = [
  { label: "Power Ranker", file: "Power Ranker - Shop - December 4, 2025.xlsx" },
  { label: "Period Winner", file: "Period Winner by shop sample.xlsx" },
  { label: "EPR", file: "EPR sample file.xlsx" },
  { label: "P10 Inventory", file: "P10 Inventory Region (1).xlsx" },
];

function inspectWorkbook(sample) {
  const filePath = path.join(SAMPLE_DIR, sample.file);
  if (!fs.existsSync(filePath)) {
    console.warn(`[warn] Missing sample: ${sample.file}`);
    return null;
  }

  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const summary = {
    label: sample.label,
    file: sample.file,
    sheetCount: workbook.SheetNames.length,
    sheets: [],
  };

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null });
    const header = rows[0];
    const preview = rows.slice(1, 6);
    summary.sheets.push({
      name: sheetName,
      columnCount: header?.length ?? 0,
      headers: header,
      sampleRows: preview,
      totalRows: rows.length - 1,
    });
  });

  return summary;
}

const report = samples
  .map((sample) => inspectWorkbook(sample))
  .filter(Boolean);

console.dir(report, { depth: null });
