import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import type { LaborScope } from "@/lib/laborTypes";
import { laborScopeRollup } from "@/lib/server/laborRollup";

const SCOPES: LaborScope[] = ["region", "district", "shop"];

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  const scopeParam = (url.searchParams.get("scope") ?? "district").toLowerCase();
  const scope: LaborScope = SCOPES.includes(scopeParam as LaborScope) ? (scopeParam as LaborScope) : "district";
  const region = url.searchParams.get("region");
  const district = url.searchParams.get("district");
  const search = url.searchParams.get("search");
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  try {
    const data = await laborScopeRollup({ scope, region, district, search, limit, offset });
    return NextResponse.json(data);
  } catch (error) {
    console.error("labor rollup API failure", error);
    return NextResponse.json({ error: "Failed to load labor rollup" }, { status: 500 });
  }
}
