import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import type { CelebrationEntry } from "@/lib/recognition-captain/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BirthdaysRequest = {
  scopeLevel?: string | null;
  divisionName?: string | null;
  regionName?: string | null;
  districtName?: string | null;
  shopNumber?: string | number | null;
  windowDays?: number;
  limit?: number;
};

type AlignmentRow = {
  store: string | null;
  Division?: string | null;
  Region?: string | null;
  District?: string | null;
};

type ShopStaffRow = {
  id: string;
  staff_name: string | null;
  shop_id: string | null;
  birth_date: string | null;
  celebration_profile_json: CelebrationProfileJson | null;
};

type CelebrationProfileJson = {
  favoriteTreat?: string | null;
  celebrationNotes?: string | null;
  favorite_treat?: string | null;
  celebration_notes?: string | null;
  note?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = await readRequestBody<BirthdaysRequest>(request);
    const scopeLevel = (body.scopeLevel ?? "SHOP").toUpperCase();
    const windowDays = clamp(body.windowDays ?? 60, 7, 120);
    const limit = clamp(body.limit ?? 8, 1, 24);

    const { shopIds, alignmentLookup } = await resolveShopIds(scopeLevel, body);
    if (!shopIds.length) {
      return NextResponse.json({ entries: [] satisfies CelebrationEntry[] });
    }

    const staffRows = await loadStaffRows(shopIds);
    const entries = buildBirthdayEntries({ staffRows, alignmentLookup, windowDays, limit });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Recognition birthday lookup error", error);
    return NextResponse.json({ error: "Unable to load birthdays." }, { status: 500 });
  }
}

async function readRequestBody<T>(request: Request): Promise<T> {
  try {
    const text = await request.text();
    if (!text) {
      return {} as T;
    }
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

async function resolveShopIds(scopeLevel: string, body: BirthdaysRequest) {
  if (scopeLevel === "SHOP" && body.shopNumber) {
    const shopId = String(body.shopNumber).trim();
    return { shopIds: shopId ? [shopId] : [], alignmentLookup: new Map<string, AlignmentRow>() };
  }

  const filters: Array<[string, string]> = [];
  if (scopeLevel === "DIVISION" && body.divisionName) {
    filters.push(["Division", body.divisionName]);
  }
  if (scopeLevel === "REGION" && body.regionName) {
    filters.push(["Region", body.regionName]);
    if (body.divisionName) {
      filters.push(["Division", body.divisionName]);
    }
  }
  if (scopeLevel === "DISTRICT" && body.districtName) {
    filters.push(["District", body.districtName]);
    if (body.regionName) {
      filters.push(["Region", body.regionName]);
    }
    if (body.divisionName) {
      filters.push(["Division", body.divisionName]);
    }
  }

  if (!filters.length) {
    const fallback = body.shopNumber ? [String(body.shopNumber).trim()] : [];
    return { shopIds: fallback.filter(Boolean), alignmentLookup: new Map<string, AlignmentRow>() };
  }

  let query = supabaseServer.from("company_alignment").select("store, Division, Region, District").not("store", "is", null);
  filters.forEach(([column, value]) => {
    query = query.eq(column, value);
  });
  query = query.limit(1000);

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const alignmentRows = (data as AlignmentRow[] | null) ?? [];
  const alignmentLookup = new Map<string, AlignmentRow>();
  const shopIds = alignmentRows
    .map((row) => {
      if (!row.store) {
        return null;
      }
      alignmentLookup.set(row.store, row);
      return row.store;
    })
    .filter((value): value is string => Boolean(value));

  return { shopIds: Array.from(new Set(shopIds)), alignmentLookup };
}

async function loadStaffRows(shopIds: string[]): Promise<ShopStaffRow[]> {
  const { data, error } = await supabaseServer
    .from("shop_staff")
    .select("id, staff_name, shop_id, birth_date, celebration_profile_json")
    .in("shop_id", shopIds)
    .not("birth_date", "is", null)
    .limit(1200);

  if (error) {
    throw error;
  }

  return (data as ShopStaffRow[] | null) ?? [];
}

function buildBirthdayEntries(options: {
  staffRows: ShopStaffRow[];
  alignmentLookup: Map<string, AlignmentRow>;
  windowDays: number;
  limit: number;
}): CelebrationEntry[] {
  const today = startOfDay(new Date());
  const entries: CelebrationEntry[] = [];

  options.staffRows.forEach((row) => {
    if (!row.birth_date || !row.shop_id) {
      return;
    }
    const baseDate = new Date(row.birth_date);
    if (Number.isNaN(baseDate.getTime())) {
      return;
    }
    const upcoming = alignToUpcomingDate(baseDate, today);
    const daysUntil = daysBetween(today, upcoming);
    if (daysUntil > options.windowDays) {
      return;
    }

    const shopNumber = Number(row.shop_id);
    if (!Number.isFinite(shopNumber)) {
      return;
    }

    const alignment = options.alignmentLookup.get(row.shop_id);
    const celebrationDetails = extractCelebrationDetails(row.celebration_profile_json);
    entries.push({
      id: row.id,
      name: (row.staff_name ?? "Unnamed").trim() || "Unnamed",
      shopNumber,
      shopName: `Shop ${shopNumber}`,
      districtName: alignment?.District ?? undefined,
      regionName: alignment?.Region ?? undefined,
      dateLabel: formatMonthDay(upcoming),
      daysUntil,
      favoriteTreat: celebrationDetails.favoriteTreat,
      celebrationNotes: celebrationDetails.celebrationNotes ?? celebrationDetails.legacyNote,
      note: buildCelebrationNote(celebrationDetails),
      occursOn: baseDate.toISOString(),
    });
  });

  return entries
    .sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name))
    .slice(0, options.limit);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

function startOfDay(date: Date): Date {
  const clone = new Date(date);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

function alignToUpcomingDate(baseDate: Date, reference: Date): Date {
  const upcoming = startOfDay(new Date(baseDate));
  upcoming.setFullYear(reference.getFullYear());
  if (upcoming < reference) {
    upcoming.setFullYear(reference.getFullYear() + 1);
  }
  return upcoming;
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86400000));
}

function formatMonthDay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type CelebrationDetails = {
  favoriteTreat?: string;
  celebrationNotes?: string;
  legacyNote?: string;
};

function extractCelebrationDetails(profile: CelebrationProfileJson | null): CelebrationDetails {
  if (!profile || typeof profile !== "object") {
    return {};
  }

  return {
    favoriteTreat: normalizeProfileValue(profile.favoriteTreat ?? profile.favorite_treat),
    celebrationNotes: normalizeProfileValue(profile.celebrationNotes ?? profile.celebration_notes),
    legacyNote: normalizeProfileValue(profile.note),
  };
}

function normalizeProfileValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function buildCelebrationNote(details: CelebrationDetails): string | undefined {
  const parts: string[] = [];
  if (details.favoriteTreat) {
    parts.push(`Favorite treat: ${details.favoriteTreat}`);
  }
  if (details.celebrationNotes) {
    parts.push(details.celebrationNotes);
  } else if (!parts.length && details.legacyNote) {
    parts.push(details.legacyNote);
  }
  return parts.length ? parts.join(" • ") : undefined;
}
