import fs from "fs";
import path from "path";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const name = url.searchParams.get("name");
    if (!name) return new Response("Missing name", { status: 400 });

    const samplesDir = path.join(process.cwd(), "PocketManager5_sitetmpupload_samples");
    const slidesFolder = "period 11 12.1.25 GC DM Monthly Biz Review - NEW TEMPLATE - May 2025 1";
    const filePath = path.join(samplesDir, slidesFolder, name);

    if (!fs.existsSync(filePath)) return new Response("Not found", { status: 404 });

    const data = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "application/octet-stream";

    return new Response(data, { status: 200, headers: { "Content-Type": mime } });
  } catch (err) {
    console.error(err);
    return new Response("Server error", { status: 500 });
  }
}
