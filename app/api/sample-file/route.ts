import fs from "fs";
import path from "path";

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
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName.replace(/\"/g, "")}"`,
      },
    });
  } catch (err: unknown) {
    console.error(err);
    return new Response(JSON.stringify({ error: String((err as Error)?.message ?? err) }), { status: 500 });
  }
}
