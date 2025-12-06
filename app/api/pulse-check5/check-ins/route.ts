import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type CheckInPayload = {
  shop_id: string;
  check_in_date: string;
  time_slot: string;
  cars: number;
  sales: number;
  big4: number;
  coolants: number;
  diffs: number;
  fuel_filters: number;
  donations: number;
  mobil1: number;
  temperature: string | null;
  is_submitted: boolean;
  submitted_at: string;
};

function normalizePayload(raw: unknown): CheckInPayload | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  if (!candidate.shop_id || !candidate.check_in_date || !candidate.time_slot) {
    return null;
  }

  return {
    shop_id: String(candidate.shop_id),
    check_in_date: String(candidate.check_in_date),
    time_slot: String(candidate.time_slot),
    cars: Number(candidate.cars) || 0,
    sales: Number(candidate.sales) || 0,
    big4: Number(candidate.big4) || 0,
    coolants: Number(candidate.coolants) || 0,
    diffs: Number(candidate.diffs) || 0,
    fuel_filters: Number(candidate.fuel_filters) || 0,
    donations: Number(candidate.donations) || 0,
    mobil1: Number(candidate.mobil1) || 0,
    temperature: typeof candidate.temperature === "string" ? candidate.temperature : null,
    is_submitted: Boolean(candidate.is_submitted),
    submitted_at: typeof candidate.submitted_at === "string" ? candidate.submitted_at : new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const payload = normalizePayload(body?.payload ?? body);

    if (!payload) {
      return NextResponse.json({ error: "Invalid check-in payload." }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Prevent overwriting an already submitted slot (mobile or web)
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("check_ins")
      .select("is_submitted,submitted_at")
      .eq("shop_id", payload.shop_id)
      .eq("check_in_date", payload.check_in_date)
      .eq("time_slot", payload.time_slot)
      .maybeSingle();

    if (existingError && existingError.code !== "PGRST116") {
      console.error("check-ins preflight error", existingError);
      return NextResponse.json({ error: "Unable to submit right now." }, { status: 500 });
    }

    if (existing?.is_submitted) {
      return NextResponse.json(
        { error: "This time slot is already submitted. Refresh to view the latest data." },
        { status: 409 }
      );
    }

    // Upsert with onConflict keys so we never overwrite an already submitted slot
    const { data: inserted, error } = await supabaseAdmin
      .from("check_ins")
      .upsert([payload], { onConflict: "shop_id,check_in_date,time_slot" })
      .select("time_slot");

    if (error) {
      console.error("check-ins upsert error", error);
      return NextResponse.json({ error: error.message ?? "Failed to upsert check-in." }, { status: 500 });
    }

    if (!inserted || inserted.length === 0) {
      return NextResponse.json(
        { error: "This time slot is already submitted. Refresh to view the latest data." },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("check-ins route error", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
