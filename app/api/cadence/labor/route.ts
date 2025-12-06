import { NextResponse } from "next/server";

type LaborEntryPayload = {
  date: string;
  shopId: string;
  expectedLaborPct: number;
  actualLaborPct: number;
  notes?: string;
};

const MOCK: LaborEntryPayload[] = [
  { date: new Date().toISOString().split("T")[0], shopId: "101", expectedLaborPct: 18, actualLaborPct: 17.5, notes: "mock" },
];

export async function GET() {
  return NextResponse.json({ data: MOCK });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Basic validation
    if (!body?.date || !body?.shopId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    // Echo back for now
    return NextResponse.json({ success: true, data: body }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
