import { supabaseServer } from "./supabaseServer";
import type { PostgrestError } from "@supabase/supabase-js";

export type AlignmentOverview = {
  id: string;
  code: string | null;
  name: string;
  region: string | null;
  isActive: boolean;
  memberCount: number;
};

export type AlignmentMembershipInput = {
  userId: string;
  alignmentId: string;
  shopId?: string | null;
  role: string;
  isPrimary?: boolean | null;
};

export type ShopRoleAssignmentInput = {
  userId: string;
  shopId: string;
  role: string;
};

type AlignmentAuditEvent = {
  action: string;
  actorId: string | null;
  targetUserId?: string | null;
  alignmentId?: string | null;
  shopId?: string | null;
  payload?: Record<string, unknown> | null;
};

const AUDIT_TABLE = "alignment_audit_log";

const raise = (error: PostgrestError) => {
  const wrapped = new Error(error.message);
  (wrapped as PostgrestError & Error).details = error.details;
  (wrapped as PostgrestError & Error).hint = error.hint;
  throw wrapped;
};

export async function listAlignmentsWithMembers(): Promise<AlignmentOverview[]> {
  const [alignmentsResult, membershipsResult] = await Promise.all([
    supabaseServer
      .from("alignments")
      .select("id, code, name, region, is_active")
      .order("name", { ascending: true }),
    supabaseServer.from("alignment_memberships").select("alignment_id"),
  ]);

  if (alignmentsResult.error) {
    raise(alignmentsResult.error);
  }

  if (membershipsResult.error) {
    raise(membershipsResult.error);
  }

  const memberCounts = new Map<string, number>();
  (membershipsResult.data ?? []).forEach((row) => {
    if (!row.alignment_id) return;
    memberCounts.set(row.alignment_id, (memberCounts.get(row.alignment_id) ?? 0) + 1);
  });

  return (alignmentsResult.data ?? []).map((row) => ({
    id: row.id,
    code: row.code ?? null,
    name: row.name ?? "Alignment",
    region: row.region ?? null,
    isActive: row.is_active !== false,
    memberCount: memberCounts.get(row.id) ?? 0,
  }));
}

export async function upsertAlignmentMembership(input: AlignmentMembershipInput, actorId: string | null) {
  const response = await supabaseServer.from("alignment_memberships").upsert({
    user_id: input.userId,
    alignment_id: input.alignmentId,
    shop_id: input.shopId ?? null,
    role: input.role,
    is_primary: Boolean(input.isPrimary),
  });

  if (response.error) {
    raise(response.error);
  }

  await logAlignmentAdminEvent({
    action: "alignment.membership.upsert",
    actorId,
    targetUserId: input.userId,
    alignmentId: input.alignmentId,
    shopId: input.shopId ?? null,
    payload: { role: input.role, isPrimary: Boolean(input.isPrimary) },
  });
}

export async function removeAlignmentMembership(input: { userId: string; alignmentId: string; shopId?: string | null }, actorId: string | null) {
  const query = supabaseServer
    .from("alignment_memberships")
    .delete()
    .eq("user_id", input.userId)
    .eq("alignment_id", input.alignmentId);

  if (input.shopId) {
    query.eq("shop_id", input.shopId);
  }

  const response = await query;
  if (response.error) {
    raise(response.error);
  }

  await logAlignmentAdminEvent({
    action: "alignment.membership.remove",
    actorId,
    targetUserId: input.userId,
    alignmentId: input.alignmentId,
    shopId: input.shopId ?? null,
  });
}

export async function upsertShopRoleAssignment(input: ShopRoleAssignmentInput, actorId: string | null) {
  const response = await supabaseServer.from("shop_role_assignments").upsert({
    user_id: input.userId,
    shop_id: input.shopId,
    role: input.role,
  });

  if (response.error) {
    raise(response.error);
  }

  await logAlignmentAdminEvent({
    action: "alignment.shopRole.upsert",
    actorId,
    targetUserId: input.userId,
    shopId: input.shopId,
    payload: { role: input.role },
  });
}

export async function removeShopRoleAssignment(input: { userId: string; shopId: string }, actorId: string | null) {
  const response = await supabaseServer
    .from("shop_role_assignments")
    .delete()
    .eq("user_id", input.userId)
    .eq("shop_id", input.shopId);

  if (response.error) {
    raise(response.error);
  }

  await logAlignmentAdminEvent({
    action: "alignment.shopRole.remove",
    actorId,
    targetUserId: input.userId,
    shopId: input.shopId,
  });
}

async function logAlignmentAdminEvent(event: AlignmentAuditEvent) {
  try {
    await supabaseServer.from(AUDIT_TABLE).insert({
      actor_id: event.actorId,
      target_user_id: event.targetUserId ?? null,
      alignment_id: event.alignmentId ?? null,
      shop_id: event.shopId ?? null,
      action: event.action,
      metadata: event.payload ?? null,
    });
  } catch (error) {
    console.warn("[AlignmentAdmin] Audit insert failed", error);
  }
}
