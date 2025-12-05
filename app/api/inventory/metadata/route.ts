import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { DEFAULT_INVENTORY_THRESHOLD_CONFIG } from "@shared/features/inventory-captain/config";
import { loadInventoryShopDirectory, loadInventoryThresholdConfig } from "@/lib/inventoryCaptainServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getServerSession();
    const alignmentId = session.alignment?.activeAlignmentId ?? null;
    const [thresholds, directory] = await Promise.all([
      loadInventoryThresholdConfig(alignmentId),
      loadInventoryShopDirectory(),
    ]);

    const permittedShopIds = new Set(session.alignment?.shops ?? []);
    const scopedDirectory = permittedShopIds.size
      ? directory.filter((entry) => !entry.shopId || permittedShopIds.has(entry.shopId))
      : directory;

    return NextResponse.json({
      thresholds,
      shops: scopedDirectory,
    });
  } catch (error) {
    console.error("[InventoryCaptain] metadata error", error);
    return NextResponse.json({
      thresholds: {
        ...DEFAULT_INVENTORY_THRESHOLD_CONFIG,
        source: "fallback",
      },
      shops: [],
      error: "Unable to load inventory metadata",
    });
  }
}
