import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

async function main() {
  const repo = process.cwd();
  const samplesDir = path.join(repo, 'PocketManager5_sitetmpupload_samples');
  const excelName = 'Sample Weekly review.xlsx';
  const excelPath = path.join(samplesDir, excelName);
  const slidesFolder = 'period 11 12.1.25 GC DM Monthly Biz Review - NEW TEMPLATE - May 2025 1';
  const slidesPath = path.join(samplesDir, slidesFolder);

  if (!fs.existsSync(excelPath)) {
    console.error('Excel not found at', excelPath);
    process.exit(2);
  }

  const buffer = await fs.promises.readFile(excelPath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  const headers = rows.length ? Object.keys(rows[0]) : [];

  const slides = fs.existsSync(slidesPath) ? (await fs.promises.readdir(slidesPath)).filter(f => /\.(png|jpg|jpeg)$/i.test(f)) : [];

  const out = { excelName, sheetName, headers, sampleRow: rows[0] ?? null, slideFolder: slidesFolder, slides };
  const outPath = path.join(repo, 'tmp', 'dm-weekly-sample.json');
  await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
  await fs.promises.writeFile(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log('Wrote', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
