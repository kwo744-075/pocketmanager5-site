import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "@/lib/auth/session";
import { hasShopAccess } from "@/lib/auth/alignment";

type LaborEntryPayload = {
  date: string;
  shopId: string;
  expectedLaborPct?: number | null;
  actualLaborPct?: number | null;
  notes?: string | null;
};

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const body = await request.json();
    if (!Array.isArray(body?.entries) || body.entries.length === 0) {
      return NextResponse.json({ error: "Missing entries array" }, { status: 400 });
    }

    const entries: LaborEntryPayload[] = body.entries;

    // Validate shops access
    for (const e of entries) {
      if (!e?.date || !e?.shopId) {
        return NextResponse.json({ error: "Each entry requires date and shopId" }, { status: 400 });
      }
      if (!hasShopAccess(session.alignment, e.shopId)) {
        return NextResponse.json({ error: "Forbidden for one or more shops" }, { status: 403 });
      }
    }

    const admin = getSupabaseAdmin();
    const userId = session.user.id;
    const payloads = entries.map((e) => ({
      date: e.date,
      shop_id: String(e.shopId),
      expected_labor_pct: e.expectedLaborPct == null ? null : Number(e.expectedLaborPct),
      actual_labor_pct: e.actualLaborPct == null ? null : Number(e.actualLaborPct),
      notes: e.notes ?? null,
      created_by: userId,
      alignment_id: session.alignment?.activeAlignmentId ?? null,
    }));

    const { data, error } = await admin.from("labor_entries").insert(payloads).select();
    if (error) {
      console.error("labor_entries bulk insert failed", error);
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error("labor bulk POST error", err);
    return NextResponse.json({ error: "Invalid JSON or server error" }, { status: 400 });
  }
}
