#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

// Converts the updated CSV sim sheet into XLSX for Pulse Check imports.
const workspaceRoot = path.resolve(__dirname, "..", "..");
const csvName = "Checkins Test Sheet Master..csv";
const xlsxName = "Checkins Test Sheet Master..xlsx";
const csvPath = path.join(workspaceRoot, csvName);
const xlsxPath = path.join(workspaceRoot, xlsxName);

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
