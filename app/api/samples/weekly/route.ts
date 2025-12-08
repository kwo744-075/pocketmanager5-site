import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

export async function GET() {
  try {
    const samplesDir = path.join(process.cwd(), "PocketManager5_sitetmpupload_samples");
    const slidesFolder = "period 11 12.1.25 GC DM Monthly Biz Review - NEW TEMPLATE - May 2025 1";
    const slidesPath = path.join(samplesDir, slidesFolder);

    const slideFiles = fs.existsSync(slidesPath)
      ? (await fs.promises.readdir(slidesPath)).filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
      : [];

    const excelName = "Sample Weekly review.xlsx";
    const excelPath = path.join(samplesDir, excelName);
    let excelParse: { headers: string[]; rows: Record<string, unknown>[] } | null = null;

    if (fs.existsSync(excelPath)) {
      const buffer = await fs.promises.readFile(excelPath);
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
      const headers = rows.length ? Object.keys(rows[0]) : [];
      excelParse = { headers, rows };
    }

    return new Response(
      JSON.stringify({ slides: slideFiles, slideFolder: slidesFolder, excel: excelParse, excelName }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
