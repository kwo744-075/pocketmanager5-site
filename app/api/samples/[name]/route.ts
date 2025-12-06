import fs from "fs";
import path from "path";

export async function GET(_req: Request, context: any) {
  try {
    // context.params may be a Promise in some Next.js type flows; resolve defensively
    const params = await Promise.resolve(context?.params);
    const rawName = params?.name;
    // basic sanitization: disallow path traversal
    if (!rawName || rawName.includes("..") || rawName.includes("/") || rawName.includes("\\")) {
      return new Response("Invalid file name", { status: 400 });
    }

    const samplesDir = path.join(process.cwd(), "PocketManager5_sitetmpupload_samples");
    const filePath = path.join(samplesDir, rawName);

    if (!fs.existsSync(filePath)) {
      return new Response("Not found", { status: 404 });
    }

    const data = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".pdf": "application/pdf",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".xls": "application/vnd.ms-excel",
      ".png": "image/png",
      ".pptm": "application/vnd.ms-powerpoint",
      ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    };

    const contentType = mimeMap[ext] ?? "application/octet-stream";

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${rawName}"`,
      },
    });
  } catch (err: any) {
    console.error(err);
    return new Response("Server error", { status: 500 });
  }
}
