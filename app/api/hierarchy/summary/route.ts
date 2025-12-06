import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "@/lib/auth/session";
import { loadAlignmentContextForUser } from "@/lib/auth/alignment";

type HierarchySummary = {
  login: string;
  scope_level: string | null;
  division_name: string | null;
  region_name: string | null;
  district_name: string | null;
  shop_number: string | null;
  shops_in_district: number | null;
  districts_in_region: number | null;
  shops_in_region: number | null;
  regions_in_division: number | null;
  shops_in_division: number | null;
};

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const admin = getSupabaseAdmin();
    const userId = session.user.id;
    const login = (session.user.email ?? "").toLowerCase();

    // Load alignment context (memberships + assigned shops)
    const alignment = await loadAlignmentContextForUser(admin, userId);

    // Determine primary shop if any
    const primaryShop = alignment.shops?.[0] ?? null;

    let shopNumber: string | null = primaryShop ?? null;
    let districtName: string | null = null;
    let regionName: string | null = null;
    let divisionName: string | null = null;

    if (shopNumber) {
      // Try to fetch shop metadata from shops table
      try {
        const { data: shop } = await admin
          .from("shops")
          .select("shop_number, shop_name, district_id, region_id, district_name, region_name, division_name")
          .eq("shop_number", shopNumber)
          .limit(1)
          .maybeSingle();

        if (shop) {
          shopNumber = String((shop as any).shop_number ?? shopNumber);
          districtName = (shop as any).district_name ?? null;
          regionName = (shop as any).region_name ?? null;
          divisionName = (shop as any).division_name ?? null;
        }
      } catch (err) {
        // ignore
      }
    }

    // Compute counts using shops table where possible
    let shopsInDistrict: number | null = null;
    let districtsInRegion: number | null = null;
    let shopsInRegion: number | null = null;
    let regionsInDivision: number | null = null;
    let shopsInDivision: number | null = null;

    try {
      if (districtName) {
        const { count } = await admin
          .from("shops")
          .select("shop_number", { count: "exact", head: true })
          .eq("district_name", districtName);
        shopsInDistrict = typeof count === "number" ? count : null;
      }

      if (regionName) {
        let distinctDistricts: any = null;
        try {
          const resp = await admin.rpc("distinct_districts_in_region", { region_name: regionName }).maybeSingle();
          distinctDistricts = resp?.data ?? null;
        } catch (e) {
          distinctDistricts = null;
        }

        // fallback: count distinct district_name
        if (!distinctDistricts) {
          const { data } = await admin
            .from("shops")
            .select("district_name")
            .eq("region_name", regionName);
          const set = new Set<string>();
          (data ?? []).forEach((r: any) => r.district_name && set.add(r.district_name));
          districtsInRegion = set.size;
        }

        const { count: sreg } = await admin
          .from("shops")
          .select("shop_number", { count: "exact", head: true })
          .eq("region_name", regionName);
        shopsInRegion = typeof sreg === "number" ? sreg : null;
      }

      if (divisionName) {
        const { data } = await admin
          .from("shops")
          .select("region_name")
          .eq("division_name", divisionName);
        const set = new Set<string>();
        (data ?? []).forEach((r: any) => r.region_name && set.add(r.region_name));
        regionsInDivision = set.size;

        const { count: sdiv } = await admin
          .from("shops")
          .select("shop_number", { count: "exact", head: true })
          .eq("division_name", divisionName);
        shopsInDivision = typeof sdiv === "number" ? sdiv : null;
      }
    } catch (err) {
      // ignore counting errors
    }

    // Determine scope level by membership specificity
    let scopeLevel: string | null = null;
    if (alignment.shops && alignment.shops.length > 0) {
      scopeLevel = "Shop";
    } else if (alignment.memberships?.some((m) => (m.role ?? "").toLowerCase().includes("dm"))) {
      scopeLevel = "District";
    } else if (alignment.memberships?.some((m) => (m.role ?? "").toLowerCase().includes("rd"))) {
      scopeLevel = "Region";
    } else if (alignment.memberships?.some((m) => (m.role ?? "").toLowerCase().includes("vp"))) {
      scopeLevel = "Division";
    }

    const result: HierarchySummary = {
      login,
      scope_level: scopeLevel,
      division_name: divisionName,
      region_name: regionName,
      district_name: districtName,
      shop_number: shopNumber,
      shops_in_district: shopsInDistrict,
      districts_in_region: districtsInRegion,
      shops_in_region: shopsInRegion,
      regions_in_division: regionsInDivision,
      shops_in_division: shopsInDivision,
    };

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("/api/hierarchy/summary error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
