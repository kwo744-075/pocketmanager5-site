import { getSupabaseAdmin } from "../lib/supabaseAdmin";

type TimeSlot = "12pm" | "2:30pm" | "5pm" | "8pm";

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

async function main() {
  const admin = getSupabaseAdmin();

  const SHOP_NUMBER = process.env.CHECKIN_SHOP_NUMBER ?? "447";
  const CHECKIN_DATE = process.env.CHECKIN_DATE ?? todayISO();
  const DEFAULT_SLOT: TimeSlot = (process.env.CHECKIN_TIME_SLOT as TimeSlot) ?? "12pm";

  // Optional JSON env var mapping region_id -> time_slot (e.g. {"region-1":"5pm"})
  let regionOverrides: Record<string, TimeSlot> | null = null;
  if (process.env.CHECKIN_REGION_OVERRIDES) {
    try {
      regionOverrides = JSON.parse(process.env.CHECKIN_REGION_OVERRIDES);
    } catch (e) {
      console.warn("Invalid JSON for CHECKIN_REGION_OVERRIDES, ignoring");
      regionOverrides = null;
    }
  }

  // Lookup shop by shop_number (numeric or string)
  const shopNumberAsInt = Number(SHOP_NUMBER);
  const shopQuery = admin
    .from("shops")
    .select("id,shop_number,shop_name,region_id")
    .eq("shop_number", shopNumberAsInt)
    .limit(1)
    .maybeSingle();

  const shopResp = await shopQuery;
  if (shopResp.error) {
    console.error("Failed to query shops:", shopResp.error);
    process.exitCode = 2;
    return;
  }

  const shop = shopResp.data as { id: string; shop_number: number | null; shop_name?: string | null; region_id?: string | null } | null;
  if (!shop) {
    console.error(`Shop not found for shop_number=${SHOP_NUMBER}`);
    process.exitCode = 3;
    return;
  }

  let timeSlot: TimeSlot = DEFAULT_SLOT;
  if (regionOverrides && shop.region_id && regionOverrides[shop.region_id]) {
    timeSlot = regionOverrides[shop.region_id];
    console.log(`Using region override time slot '${timeSlot}' for region ${shop.region_id}`);
  } else {
    console.log(`Using time slot '${timeSlot}' (default or env override).`);
  }

  // Allow overriding individual metric values via env vars (optional)
  const metrics = {
    cars: Number(process.env.CHECKIN_CARS ?? 0),
    sales: Number(process.env.CHECKIN_SALES ?? 0),
    big4: Number(process.env.CHECKIN_BIG4 ?? 0),
    coolants: Number(process.env.CHECKIN_COOLANTS ?? 0),
    diffs: Number(process.env.CHECKIN_DIFFS ?? 0),
    fuel_filters: process.env.CHECKIN_FUEL_FILTERS ? Number(process.env.CHECKIN_FUEL_FILTERS) : undefined,
    donations: Number(process.env.CHECKIN_DONATIONS ?? 0),
    mobil1: Number(process.env.CHECKIN_MOBIL1 ?? 0),
  } as Record<string, unknown>;

  // Preflight: check existing slot
  const { data: existing, error: existingError } = await admin
    .from("check_ins")
    .select("id,is_submitted,submitted_at")
    .eq("shop_id", shop.id)
    .eq("check_in_date", CHECKIN_DATE)
    .eq("time_slot", timeSlot)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    console.error("Preflight error checking existing check_ins:", existingError);
    process.exitCode = 4;
    return;
  }

  if (existing && existing.is_submitted) {
    console.error(
      `Aborting: this slot is already submitted (shop_id=${shop.id}, date=${CHECKIN_DATE}, time_slot=${timeSlot}, submitted_at=${existing.submitted_at})`,
    );
    process.exitCode = 5;
    return;
  }

  const payload: Record<string, unknown> = {
    shop_id: shop.id,
    check_in_date: CHECKIN_DATE,
    time_slot: timeSlot,
    cars: metrics.cars ?? 0,
    sales: metrics.sales ?? 0,
    big4: metrics.big4 ?? 0,
    coolants: metrics.coolants ?? 0,
    diffs: metrics.diffs ?? 0,
    donations: metrics.donations ?? 0,
    mobil1: metrics.mobil1 ?? 0,
    temperature: process.env.CHECKIN_TEMPERATURE ?? "green",
    is_submitted: true,
    submitted_at: process.env.CHECKIN_SUBMITTED_AT ?? new Date().toISOString(),
  };

  if (typeof metrics.fuel_filters !== "undefined") {
    payload.fuel_filters = metrics.fuel_filters;
  }

  console.log("Upserting check-in payload:", { shopNumber: SHOP_NUMBER, shopId: shop.id, ...payload });

  try {
    const upsertResp = await admin
      .from("check_ins")
      .upsert([payload], { onConflict: "shop_id,check_in_date,time_slot" })
      .select("id,time_slot,check_in_date,is_submitted,submitted_at");

    if ((upsertResp as any).error) {
      console.error("Upsert error:", (upsertResp as any).error);
      process.exitCode = 6;
      return;
    }

    console.log("Upsert result:", JSON.stringify((upsertResp as any).data, null, 2));
    console.log("Completed.");
  } catch (err) {
    console.error("Unexpected error performing upsert:", err);
    process.exitCode = 7;
  }
}

main().catch((e) => {
  console.error("Script failed:", e);
  process.exitCode = 99;
});
