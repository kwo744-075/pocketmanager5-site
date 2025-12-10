import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const which = url.searchParams.get("which");
    if (!which) return new Response(JSON.stringify({ error: "missing which param" }), { status: 400 });

    const mapping: Record<string, string> = {
      employee: "EPR sample file.xlsx",
      power: "Power Ranker - Shop - December 4, 2025.xlsx",
      period: "Period Winner by shop sample.xlsx",
    };

    const fileName = mapping[which];
    if (!fileName) return new Response(JSON.stringify({ error: "unknown which" }), { status: 400 });

    const samplesDir = path.join(process.cwd(), "PocketManager5_sitetmpupload_samples");
    const filePath = path.join(samplesDir, fileName);
    if (!fs.existsSync(filePath)) return new Response(JSON.stringify({ error: "file not found on server" }), { status: 404 });

    const buffer = await fs.promises.readFile(filePath);
    // Parse workbook
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const result: Record<string, unknown> = {};
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
      result[sheetName] = rows;
    });

    return new Response(JSON.stringify({ fileName, sheets: result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error(err);
    return new Response(JSON.stringify({ error: String((err as Error)?.message ?? err) }), { status: 500 });
  }
}
