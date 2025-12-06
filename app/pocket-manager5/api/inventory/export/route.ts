import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

const mapToSimplifiedCategory = (original: string | null) => {
  if (!original) return "Miscellaneous";
  if (original.includes("BEAM ") || original.includes("CONVENTIONAL ") || original.includes("WINTER ") || original.includes("REAR ") || original.includes("EXACT FIT") || original.includes("WIPER") || original.includes("Wiper")) {
    return "Wipers";
  }
  if (original.includes("OIL FILTER") || original.includes("Oil Filter") || original.includes("SYNTHETIC OIL FILTER") || original.includes("SYNTHETIC+ OIL FILTER")) {
    return "Oil Filters";
  }
  if (original.includes("AIR FILTER") || original.includes("Air Filter")) {
    return "Air Filters";
  }
  if (original.includes("CABIN") && original.includes("FILTER")) {
    return "Cabin Filters";
  }
  return original as string;
};

const normalizeItem = (row: { itemnumber?: string | null; item_number?: string | null }) => row.itemnumber ?? row.item_number ?? "";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get("shop");
  const categoryFilter = searchParams.get("category");

  if (!shop) {
    return NextResponse.json({ error: "shop is required" }, { status: 400 });
  }

  const [countRes, masterRes] = await Promise.all([
    supabaseServer
      .from("inventory_counts_v2")
      .select("itemnumber, item_number, floor_count, floorcount, storage_count, storagecount, last_changed_at, updated_at, shop_id")
      .eq("shop_id", shop),
    supabaseServer.from("inventory_items").select("itemnumber, item_number, category"),
  ]);

  if (countRes.error) {
    return NextResponse.json({ error: countRes.error.message }, { status: 500 });
  }
  if (masterRes.error) {
    return NextResponse.json({ error: masterRes.error.message }, { status: 500 });
  }

  const masterByItem = new Map<string, string>();
  (masterRes.data ?? []).forEach((row) => {
    const key = normalizeItem(row);
    if (!key) return;
    masterByItem.set(key, mapToSimplifiedCategory(row.category ?? ""));
  });

  const rows = (countRes.data ?? []).filter((row) => {
    if (!categoryFilter) return true;
    const category = masterByItem.get(normalizeItem(row)) ?? "Miscellaneous";
    return category === categoryFilter;
  });

  const csvHeader = ["Shop", "Item", "Category", "Floor", "Storage", "Total", "Last Changed"].join(",");
  const csvBody = rows
    .map((row) => {
      const item = normalizeItem(row);
      const category = masterByItem.get(item) ?? "Miscellaneous";
      const floor = (row.floor_count ?? row.floorcount ?? 0) as number;
      const storage = (row.storage_count ?? row.storagecount ?? 0) as number;
      const lastChanged = row.last_changed_at ?? row.updated_at ?? "";
      const cells = [shop, item, category, floor, storage, floor + storage, lastChanged];
      return cells.map((cell) => (typeof cell === "string" ? `"${cell.replace(/"/g, '""')}"` : cell)).join(",");
    })
    .join("\n");

  const csv = [csvHeader, csvBody].filter(Boolean).join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="inventory-${shop}.csv"`,
    },
  });
}
