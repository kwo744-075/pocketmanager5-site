import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth/session";
import { userCanManageAlignments } from "@/lib/auth/alignment";
import { upsertAlignmentMembership, removeAlignmentMembership } from "@/lib/alignmentAdmin";

export async function POST(request: Request) {
  const session = await requireServerSession();
  if (!userCanManageAlignments(session.alignment)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload.userId !== "string" || typeof payload.alignmentId !== "string" || typeof payload.role !== "string") {
    return NextResponse.json({ error: "Missing membership fields" }, { status: 400 });
  }

  try {
    await upsertAlignmentMembership(
      {
        userId: payload.userId,
        alignmentId: payload.alignmentId,
        shopId: typeof payload.shopId === "string" ? payload.shopId.trim() || null : null,
        role: payload.role,
        isPrimary: Boolean(payload.isPrimary),
      },
      session.user?.id ?? null,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[AlignmentAdmin] membership upsert failed", error);
    return NextResponse.json({ error: "Unable to upsert membership" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await requireServerSession();
  if (!userCanManageAlignments(session.alignment)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload.userId !== "string" || typeof payload.alignmentId !== "string") {
    return NextResponse.json({ error: "Missing membership fields" }, { status: 400 });
  }

  try {
    await removeAlignmentMembership(
      {
        userId: payload.userId,
        alignmentId: payload.alignmentId,
        shopId: typeof payload.shopId === "string" ? payload.shopId.trim() || null : undefined,
      },
      session.user?.id ?? null,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[AlignmentAdmin] membership removal failed", error);
    return NextResponse.json({ error: "Unable to delete membership" }, { status: 500 });
  }
}
