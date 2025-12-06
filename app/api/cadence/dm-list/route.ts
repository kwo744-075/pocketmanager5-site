import { NextResponse } from "next/server";

type DmListPayload = {
  shopId: string;
  shopName?: string;
  message: string;
  category: "Ops" | "People" | "Inventory" | "HR" | "Other";
  priority: "Low" | "Normal" | "High";
};

const MOCK = [
  { shopId: "101", shopName: "Northside Grill", message: "Need fryer filters", category: "Ops", priority: "Normal" },
];

export async function GET() {
  return NextResponse.json({ data: MOCK });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body?.shopId || !body?.message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: body }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
