import type { SupabaseClient } from "@supabase/supabase-js";

export type AlignmentMembershipRow = {
  alignment_id: string;
  alignment_name?: string | null;
  shop_id?: string | null;
  role?: string | null;
  is_primary?: boolean | null;
};

const ignoredErrorCodes = new Set(["42P01", "PGRST201"]);

export type AlignmentContext = {
  memberships: AlignmentMembershipRow[];
  shops: string[];
  activeAlignmentId?: string;
};

const ADMIN_ALIGNMENT_ROLES = new Set(["ops", "admin"]);

const normalizeShopInput = (value: string | number | null | undefined): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "default") {
      return null;
    }
    return trimmed;
  }
  return null;
};

const shopComparisonKey = (value: string | number | null | undefined): string | null => {
  const normalized = normalizeShopInput(value);
  if (!normalized) {
    return null;
  }
  const digits = normalized.replace(/[^0-9]/g, "");
  if (digits) {
    return digits;
  }
  return normalized.toLowerCase();
};

export const normalizeShopIdentifier = (value: string | number | null | undefined): string | null => {
  const normalized = normalizeShopInput(value);
  if (!normalized) {
    return null;
  }
  const digits = normalized.replace(/[^0-9]/g, "");
  return digits || normalized;
};

export function resolvePermittedShopNumber(alignment: AlignmentContext | null | undefined, requested: string | number | null | undefined): string | null {
  const prepared = normalizeShopIdentifier(requested);
  if (!alignment || !alignment.shops?.length) {
    return prepared;
  }

  const requestedKey = shopComparisonKey(prepared);
  if (requestedKey) {
    const hasAccess = alignment.shops.some((shopId) => shopComparisonKey(shopId) === requestedKey);
    if (hasAccess) {
      return prepared;
    }
  }

  const fallback = alignment.shops.find((value) => shopComparisonKey(value));
  return normalizeShopIdentifier(fallback) ?? prepared ?? null;
}

export function hasShopAccess(alignment: AlignmentContext | null | undefined, shopIdentifier: string | number | null | undefined): boolean {
  if (!alignment?.shops?.length) {
    return false;
  }
  const targetKey = shopComparisonKey(shopIdentifier);
  if (!targetKey) {
    return false;
  }
  return alignment.shops.some((shopId) => shopComparisonKey(shopId) === targetKey);
}

export function userCanManageAlignments(alignment: AlignmentContext | null | undefined): boolean {
  if (!alignment?.memberships?.length) {
    return false;
  }
  return alignment.memberships.some((membership) => membership.role && ADMIN_ALIGNMENT_ROLES.has(membership.role));
}

export async function loadAlignmentContextForUser(
  supabase: SupabaseClient,
  userId: string,
  preferredAlignmentId?: string,
): Promise<AlignmentContext> {
  try {
    const { data: memberships, error } = await supabase
      .from("alignment_memberships")
      .select("alignment_id, alignment_name, shop_id, role, is_primary")
      .eq("user_id", userId);

    if (error) {
      if (!ignoredErrorCodes.has(error.code ?? "")) {
        console.warn("[Auth] alignment_memberships lookup failed", error);
      }
      return { memberships: [], shops: [], activeAlignmentId: undefined };
    }

    const shops = new Set<string>();
    memberships.forEach((membership) => {
      if (membership.shop_id) {
        shops.add(membership.shop_id);
      }
    });

    let activeAlignmentId = preferredAlignmentId;
    if (!activeAlignmentId || !memberships.some((m) => m.alignment_id === activeAlignmentId)) {
      activeAlignmentId = memberships.find((membership) => membership.is_primary)?.alignment_id ?? memberships[0]?.alignment_id;
    }

    const { data: shopAssignments, error: shopError } = await supabase
      .from("shop_role_assignments")
      .select("shop_id")
      .eq("user_id", userId);

    if (shopError) {
      if (!ignoredErrorCodes.has(shopError.code ?? "")) {
        console.warn("[Auth] shop_role_assignments lookup failed", shopError);
      }
    } else {
      shopAssignments?.forEach((assignment) => {
        if (assignment.shop_id) {
          shops.add(assignment.shop_id);
        }
      });
    }

    return {
      memberships,
      shops: Array.from(shops),
      activeAlignmentId: activeAlignmentId ?? undefined,
    };
  } catch (error) {
    console.warn("[Auth] alignment context fetch failed", error);
    return { memberships: [], shops: [], activeAlignmentId: undefined };
  }
}
