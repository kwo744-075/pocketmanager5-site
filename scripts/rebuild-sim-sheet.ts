#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appsRoot = path.resolve(__dirname, "..", "..");
const csvName = "Checkins Test Sheet Master..csv";
const xlsxName = "Checkins Test Sheet Master..xlsx";
const csvPath = path.join(appsRoot, csvName);
const xlsxPath = path.join(appsRoot, xlsxName);

if (!fs.existsSync(csvPath)) {
  console.error(`CSV source not found at ${csvPath}`);
  process.exit(1);
}

try {
  const csvData = fs.readFileSync(csvPath, "utf8");
  const workbook = XLSX.read(csvData, { type: "string" });
  XLSX.writeFile(workbook, xlsxPath, { bookType: "xlsx" });
  console.log(`Sim sheet rebuilt: ${xlsxPath}`);
} catch (error) {
  console.error("Failed to rebuild sim sheet:", error);
  process.exit(1);
}
