const path = require('path');
const XLSX = require('xlsx');
const fs = require('fs');

// Sample file paths (update if necessary)
const samples = [
  'PocketManager5_sitetmpupload_samples/EPR sample file.xlsx',
  'PocketManager5_sitetmpupload_samples/NPS sample.xlsx',
  'PocketManager5_sitetmpupload_samples/Power Ranker - Shop - December 4, 2025.xlsx',
  'PocketManager5_sitetmpupload_samples/Collected per Store - December 9, 2025.xlsx',
  'PocketManager5_sitetmpupload_samples/shop period KPIs.xlsx',
].map((p) => path.resolve(__dirname, '..', p));

function readAllSheets(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const out = {};
  for (const name of wb.SheetNames) {
    try {
      const json = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
      out[name] = json;
    } catch (e) {
      console.warn('Failed to parse sheet', name, e);
      out[name] = [];
    }
  }
  return out;
}

async function main() {
  console.log('Reading sample files...');
  const combined = {};
  for (const file of samples) {
    console.log(' ->', file);
    const sheets = readAllSheets(file);
    for (const [name, rows] of Object.entries(sheets)) {
      // Avoid name collisions by prefixing with filename base
      const base = path.basename(file, path.extname(file)).replace(/[\s:/\\]/g, '_');
      const key = `${base}__${name}`;
      combined[key] = rows;
    }
  }

  // Build normalized employee/shop sheets containing ONE_PAGER_KPI_KEYS
  const ONE_PAGER_KPI_KEYS = [
    'overAll','powerRanker1','powerRanker2','powerRanker3','carsVsBudget','carsVsComp','salesVsBudget','salesVsComp',
    'nps','emailCollection','pmix','big4','fuelFilters','netAro','coolants','discounts','differentials','donations'
  ];

  // Try to find the EPR data from the samples by heuristics
  let empRows = [];
  for (const rows of Object.values(combined)) {
    if (!Array.isArray(rows) || !rows.length) continue;
    const keys = Object.keys(rows[0]).map((k) => String(k).toLowerCase());
    if (keys.includes('manager') || keys.includes('employee') || keys.includes('managername')) {
      empRows = rows;
      break;
    }
  }

  const normalizedEmp = empRows.map((r) => {
    const out = { shopNumber: Number(r['shop'] ?? r['Shop'] ?? r['Shop #'] ?? r['Shop#'] ?? r['store'] ?? r['Store'] ?? 0), managerName: r['manager'] ?? r['Manager'] ?? r['employee'] ?? r['Employee'] ?? '' };
    for (const k of ONE_PAGER_KPI_KEYS) out[k] = Number(r[k] ?? 0) || 0;
    return out;
  });

  const outWb = XLSX.utils.book_new();
  // append original sheets for debugging
  for (const [name, rows] of Object.entries(combined)) {
    const ws = XLSX.utils.json_to_sheet(rows || []);
    XLSX.utils.book_append_sheet(outWb, ws, name.substring(0, 30));
  }

  // append normalized sheets
  if (normalizedEmp.length) {
    XLSX.utils.book_append_sheet(outWb, XLSX.utils.json_to_sheet(normalizedEmp), 'employee_normalized');
  }

  const outPath = path.resolve(__dirname, '..', 'combined_dataset_from_samples.xlsx');
  XLSX.writeFile(outWb, outPath);
  console.log('Wrote:', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
