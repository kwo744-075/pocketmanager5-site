import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // Minimal stub: implement PPTX export server-side using pptxgenjs in follow-up.
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ error: "Not implemented: export-pptx" }, { status: 501 });
}

export const GET = async () => {
  return NextResponse.json({ error: "Use POST to export PPTX" }, { status: 405 });
};
