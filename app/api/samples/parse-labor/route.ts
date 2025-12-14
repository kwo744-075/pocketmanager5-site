import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

export async function GET() {
  try {
    const fileName = "GC Region Labor 12.06.25.xlsx";
    const samplesDir = path.join(process.cwd(), "PocketManager5_sitetmpupload_samples");
    const filePath = path.join(samplesDir, fileName);

    if (!fs.existsSync(filePath)) {
      return new Response(JSON.stringify({ error: "File not found", file: fileName }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    const buffer = await fs.promises.readFile(filePath);
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const sheets: Array<{ name: string; headers: string[]; rowCount: number }> = [];
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
      const normalizedRows = Array.isArray(rows) ? rows : [];
      const headerRow = Array.isArray(normalizedRows[0]) ? normalizedRows[0] : [];
      const headers = headerRow.map((headerCell) => String(headerCell ?? "").trim());
      sheets.push({ name, headers, rowCount: normalizedRows.length });
    }

    return new Response(JSON.stringify({ file: fileName, sheets }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Failed to parse workbook" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
