import { NextResponse } from "next/server";

type DepositEntryPayload = {
  date: string;
  shopId: string;
  bankVisitVerified: boolean;
  depositAmount: number;
  expectedAmount: number;
  cashOverShort: number;
  notes?: string;
};

const MOCK = [
  { date: new Date().toISOString().split("T")[0], shopId: "101", bankVisitVerified: true, depositAmount: 1200, expectedAmount: 1188, cashOverShort: 12, notes: "mock" },
];

export async function GET() {
  return NextResponse.json({ data: MOCK });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body?.date || !body?.shopId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: body }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
