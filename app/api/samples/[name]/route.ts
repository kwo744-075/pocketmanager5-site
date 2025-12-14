import fs from "fs";
import path from "path";

// Use a permissive context type to satisfy varying Next.js handler shapes
// and avoid strict mismatches in the generated validator types.
async function resolveParams(context: any) {
  if (!context) return undefined;
  // Some Next.js internal type flows may wrap params in a Promise; resolve defensively.
  const resolved = await Promise.resolve(context);
  return resolved?.params;
}

export async function GET(_req: Request, context?: any) {
  try {
    // context.params may be a Promise in some Next.js type flows; resolve defensively
    const params = await resolveParams(context);
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
  } catch (err) {
    console.error(err);
    return new Response("Server error", { status: 500 });
  }
}
