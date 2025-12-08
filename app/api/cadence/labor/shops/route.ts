import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HierarchyScope = {
  district?: string | null;
  region?: string | null;
  division?: string | null;
};

type HierarchySummaryRow = {
  district_name: string | null;
  region_name: string | null;
  division_name: string | null;
};

type ShopRow = {
  id?: string | null;
  shop_number?: number | string | null;
  shop_name?: string | null;
  district_name?: string | null;
  region_name?: string | null;
};

const formatShopNumber = (value: number | string | null | undefined): string => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }
  if (typeof value === "string" && value.trim().length) {
    return value.trim();
  }
  return "";
};

async function loadHierarchyScope(admin = getSupabaseAdmin(), login: string | null): Promise<HierarchyScope> {
  if (!login) {
    return {};
  }

  try {
    const { data, error } = await admin
      .from("hierarchy_summary_vw")
      .select("district_name, region_name, division_name")
      .eq("login", login)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("labor shops hierarchy lookup failed", error);
      return {};
    }

    const typedData: HierarchySummaryRow | null = data;

    if (!typedData) {
      return {};
    }

    return {
      district: typedData.district_name ?? null,
      region: typedData.region_name ?? null,
      division: typedData.division_name ?? null,
    } satisfies HierarchyScope;
  } catch (err) {
    console.error("labor shops hierarchy exception", err);
    return {};
  }
}

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const login = (session.user.email ?? "").toLowerCase();
    const scope = await loadHierarchyScope(admin, login);

    const buildBaseQuery = () =>
      admin
        .from("shops")
        .select("id, shop_number, shop_name, district_name, region_name")
        .order("shop_number", { ascending: true })
        .limit(500);

    const alignedMembershipNumbers = (session.alignment?.memberships ?? [])
      .map((membership) => formatShopNumber(membership.shop_id ?? null))
      .filter((value): value is string => Boolean(value));
    const alignedShopNumbers = (session.alignment?.shops ?? [])
      .map((value) => formatShopNumber(value))
      .filter((value): value is string => Boolean(value));

    const queryAttempts: Array<() => ReturnType<typeof buildBaseQuery>> = [];
    if (scope.district) {
      queryAttempts.push(() => buildBaseQuery().eq("district_name", scope.district));
    } else if (scope.region) {
      queryAttempts.push(() => buildBaseQuery().eq("region_name", scope.region));
    } else if (scope.division) {
      queryAttempts.push(() => buildBaseQuery().eq("division_name", scope.division));
    }
    if (alignedMembershipNumbers.length) {
      queryAttempts.push(() => buildBaseQuery().in("shop_number", alignedMembershipNumbers));
    }
    if (alignedShopNumbers.length) {
      queryAttempts.push(() => buildBaseQuery().in("shop_number", alignedShopNumbers));
    }

    if (!queryAttempts.length) {
      return NextResponse.json({ shops: [] });
    }

    let rows: ShopRow[] | null = null;
    let lastError: unknown = null;
    for (const build of queryAttempts) {
      const { data, error } = await build();
      if (error) {
        lastError = error;
        continue;
      }
      if (data?.length) {
        rows = data as ShopRow[];
        break;
      }
    }

    if (!rows) {
      if (alignedShopNumbers.length || alignedMembershipNumbers.length) {
        const numbers = alignedShopNumbers.length ? alignedShopNumbers : alignedMembershipNumbers;
        rows = numbers.map((value) => ({
          id: `alignment-${value}`,
          shop_number: value,
          shop_name: `Shop ${value}`,
          district_name: scope.district ?? null,
          region_name: scope.region ?? null,
        } satisfies ShopRow));
      } else {
        if (lastError) {
          console.error("labor shops load failed", lastError);
          return NextResponse.json({ error: "Unable to load shops" }, { status: 500 });
        }
        return NextResponse.json({ shops: [] });
      }
    }

    const typedRows: ShopRow[] = rows;
    const shops = typedRows.map((row) => {
      const shopNumber = formatShopNumber(row.shop_number);
      return {
        id: row.id ?? (shopNumber ? `shop-${shopNumber}` : crypto.randomUUID()),
        shopNumber,
        shopName: row.shop_name ?? (shopNumber ? `Shop ${shopNumber}` : "Shop"),
        districtName: row.district_name ?? scope.district ?? null,
        regionName: row.region_name ?? scope.region ?? null,
      };
    }) ?? [];

    return NextResponse.json({ shops });
  } catch (error) {
    console.error("labor shops GET error", error);
    return NextResponse.json({ error: "Unable to resolve shops" }, { status: 500 });
  }
}
