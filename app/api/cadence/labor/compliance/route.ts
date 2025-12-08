import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { laborDistrictCompliance } from "@/lib/server/laborRollup";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  const region = url.searchParams.get("region");
  const weekStart = url.searchParams.get("weekStart");

  try {
    const rows = await laborDistrictCompliance(region, weekStart);
    return NextResponse.json({ rows });
  } catch (error) {
    console.error("labor compliance API failure", error);
    return NextResponse.json({ error: "Failed to load compliance" }, { status: 500 });
  }
}
