import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth/session";
import { userCanManageAlignments } from "@/lib/auth/alignment";
import { upsertShopRoleAssignment, removeShopRoleAssignment } from "@/lib/alignmentAdmin";

export async function POST(request: Request) {
  const session = await requireServerSession();
  if (!userCanManageAlignments(session.alignment)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload.userId !== "string" || typeof payload.shopId !== "string" || typeof payload.role !== "string") {
    return NextResponse.json({ error: "Missing role fields" }, { status: 400 });
  }

  try {
    await upsertShopRoleAssignment(
      {
        userId: payload.userId,
        shopId: payload.shopId,
        role: payload.role,
      },
      session.user?.id ?? null,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[AlignmentAdmin] shop role upsert failed", error);
    return NextResponse.json({ error: "Unable to upsert shop role" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await requireServerSession();
  if (!userCanManageAlignments(session.alignment)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload.userId !== "string" || typeof payload.shopId !== "string") {
    return NextResponse.json({ error: "Missing role fields" }, { status: 400 });
  }

  try {
    await removeShopRoleAssignment(
      {
        userId: payload.userId,
        shopId: payload.shopId,
      },
      session.user?.id ?? null,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[AlignmentAdmin] shop role removal failed", error);
    return NextResponse.json({ error: "Unable to delete shop role" }, { status: 500 });
  }
}
