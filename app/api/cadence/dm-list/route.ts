import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "@/lib/auth/session";
import { hasShopAccess } from "@/lib/auth/alignment";

import type { DmListItem } from "@/lib/types/cadence";

function deriveUserRole(alignment: any): "Shop" | "DM" | "RD" | "VP" | "Unknown" {
  if (!alignment?.memberships?.length) return "Unknown";
  const roles = alignment.memberships.map((m: any) => (m.role ?? "").toString().toLowerCase());
  if (roles.some((r: string) => r.includes("vp"))) return "VP";
  if (roles.some((r: string) => r.includes("rd") || r.includes("regional"))) return "RD";
  if (roles.some((r: string) => r.includes("dm") || r.includes("district"))) return "DM";
  if (roles.some((r: string) => r.includes("shop") || r.includes("employee") || r.includes("ops"))) return "Shop";
  return "Unknown";
}

function nextLevel(role: string) {
  switch (role) {
    case "Shop":
      return "DM";
    case "DM":
      return "RD";
    case "RD":
      return "VP";
    default:
      return "DM";
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    const userId = session.user.id;

    const url = new URL(request.url);
    const shopId = url.searchParams.get("shopId");
    const limitParam = Number(url.searchParams.get("limit") ?? 100);
    const offsetParam = Number(url.searchParams.get("offset") ?? 0);

    const admin = getSupabaseAdmin();
    // Use server-side pagination via range to limit rows returned from DB
    const from = Math.max(0, offsetParam);
    const to = Math.max(from, from + Math.max(0, limitParam) - 1);
    const { data, error } = await admin.from("dm_list").select("*").order("created_at", { ascending: false }).range(from, to);
    if (error) {
      console.error("dm_list select failed", error);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    const items: DmListItem[] = (data ?? []) as any;
    const today = new Date().toISOString().split("T")[0];
    const userRole = deriveUserRole(session.alignment);

    // Filter by alignment scope and carry-forward rules
    const visible = items.filter((it) => {
      // only pending shows in the cadence inbox
      if ((it as any).status !== "pending") return false;

      // alignment-based scoping
      if (userRole === "Shop") {
        return (it as any).created_by_user_id === userId || (it as any).shop_id === (session.alignment?.shops?.[0] ?? null);
      }

      if (userRole === "DM") {
        // DM sees items targeted to DM and within their shops
        if ((it as any).target_role !== "DM") return false;
        if (session.alignment?.shops?.length && (it as any).shop_id) {
          return session.alignment.shops.some((s: string) => String(s) === String((it as any).shop_id));
        }
      }

      if (userRole === "RD") {
        if ((it as any).target_role !== "RD") return false;
        // If we have an activeAlignmentId, match against district/active alignment
        if (session.alignment?.activeAlignmentId && (it as any).district_id) {
          return String(session.alignment.activeAlignmentId) === String((it as any).district_id);
        }
        // Fallback: if the RD has shops listed, include items for those shops
        if (session.alignment?.shops?.length && (it as any).shop_id) {
          return session.alignment.shops.some((s: string) => String(s) === String((it as any).shop_id));
        }
      }

      if (userRole === "VP") {
        if ((it as any).target_role !== "VP") return false;
        // VP-level scoping could be company or region; accept if any overlap
      }

      // carry-forward logic: show if effective_date <= today OR if effective_date < today and carry_forward_until_completed true
      const effective = String((it as any).effective_date ?? (it as any).effectiveDate ?? today).split("T")[0];
      const carry = Boolean((it as any).carry_forward_until_completed ?? (it as any).carryForwardUntilCompleted ?? true);

      if (effective === today) return true;
      if (effective < today && carry) return true;
      return false;
    });

    // If shopId param provided, narrow further
    const final = shopId ? visible.filter((v) => String((v as any).shop_id ?? (v as any).shopId) === String(shopId)) : visible;

    return NextResponse.json({ data: final });
  } catch (err) {
    console.error("dm-list GET error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const body = await request.json();
    if (!body?.message) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const admin = getSupabaseAdmin();
    const userRole = deriveUserRole(session.alignment);
    const targetRole = nextLevel(userRole);

    // Determine alignment-scoped ids based on caller
    let shop_id = null;
    let district_id = null;
    const region_id = null;

    if (userRole === "Shop") {
      shop_id = session.alignment?.shops?.[0] ?? null;
    } else if (userRole === "DM") {
      // require shopId parameter and ensure it's in DM's alignment
      if (!body?.shopId) return NextResponse.json({ error: "Missing shopId" }, { status: 400 });
      if (!session.alignment?.shops?.some((s: string) => String(s) === String(body.shopId))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      shop_id = String(body.shopId);
    } else if (userRole === "RD") {
      district_id = session.alignment?.activeAlignmentId ?? null;
    }

    const payload: any = {
      message: body.message,
      category: body.category ?? "Other",
      priority: body.priority ?? "Normal",
      created_by_user_id: session.user.id,
      created_by_role: userRole,
      target_role: targetRole,
      shop_id,
      district_id,
      region_id,
      status: "pending",
      carry_forward_until_completed: body.carryForwardUntilCompleted ?? true,
      effective_date: body.effectiveDate ?? new Date().toISOString().split("T")[0],
      alignment_id: session.alignment?.activeAlignmentId ?? null,
    };

    const { data, error } = await admin.from("dm_list").insert([payload]).select().maybeSingle();
    if (error) {
      console.error("dm_list insert failed", error);
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error("dm-list POST error", err);
    return NextResponse.json({ error: "Invalid JSON or server error" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const body = await request.json();
    const updates: any = {};
    if (body.status) updates.status = body.status;
    if (body.resolutionType) updates.resolution_type = body.resolutionType;
    if (body.status === "completed") updates.completed_at = new Date().toISOString();

    const admin = getSupabaseAdmin();
    const { data: existing } = await admin.from("dm_list").select("*").eq("id", id).maybeSingle();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // simple alignment check: only allow updating if item is in user's alignment scope
    const userRole = deriveUserRole(session.alignment);
    if (userRole === "Shop" && (existing as any).created_by_user_id !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await admin.from("dm_list").update(updates).eq("id", id).select().maybeSingle();
    if (error) {
      console.error("dm_list update failed", error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("dm-list PATCH error", err);
    return NextResponse.json({ error: "Invalid JSON or server error" }, { status: 400 });
  }
}
