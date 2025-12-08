import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "@/lib/auth/session";
import { hasShopAccess } from "@/lib/auth/alignment";

type LaborEntryPayload = {
  date: string;
  shopId: string;
  expectedLaborPct?: number | string | null;
  actualLaborPct?: number | string | null;
  notes?: string | null;
};

type LaborEntryInsert = {
  date: string;
  shop_id: string;
  expected_labor_pct: number | null;
  actual_labor_pct: number | null;
  notes: string | null;
  created_by: string;
  alignment_id: string | null;
};

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const url = new URL(request.url);
    const shopId = url.searchParams.get("shopId");
    const date = url.searchParams.get("date");

    const admin = getSupabaseAdmin();
    let query = admin.from("labor_entries").select("*");

    // If the user has an alignment with shops, constrain to those shops
    if (session.alignment?.shops?.length) {
      query = query.in("shop_id", session.alignment.shops);
    }

    if (shopId) {
      if (!hasShopAccess(session.alignment, shopId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      query = query.eq("shop_id", shopId);
    }

    if (date) {
      query = query.eq("date", date);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) {
      console.error("labor_entries select failed", error);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("labor GET error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const body = (await request.json()) as Partial<LaborEntryPayload>;
    if (!body?.date || !body?.shopId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!hasShopAccess(session.alignment, body.shopId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const payload: LaborEntryInsert = {
      date: body.date,
      shop_id: String(body.shopId),
      expected_labor_pct: toNullableNumber(body.expectedLaborPct),
      actual_labor_pct: toNullableNumber(body.actualLaborPct),
      notes: body.notes ?? null,
      created_by: session.user.id,
      alignment_id: session.alignment?.activeAlignmentId ?? null,
    };

    const { data, error } = await admin.from("labor_entries").insert([payload]).select().maybeSingle();
    if (error) {
      console.error("labor_entries insert failed", error);
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error("labor POST error", err);
    return NextResponse.json({ error: "Invalid JSON or server error" }, { status: 400 });
  }
}
