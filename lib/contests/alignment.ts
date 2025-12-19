import { getServerSession } from "@/lib/auth/session";

export async function getScopeContext() {
  const session = await getServerSession();
  const alignment = session?.alignment;
  return {
    userId: session?.user?.id ?? null,
    shopNumber: (alignment as any)?.shop_number ?? alignment?.shops?.[0] ?? null,
    district: (alignment as any)?.district ?? (alignment as any)?.district_name ?? null,
    region: (alignment as any)?.region ?? (alignment as any)?.region_name ?? null,
    scope: (alignment as any)?.scope_level ?? (alignment as any)?.scope ?? null,
  };
}
