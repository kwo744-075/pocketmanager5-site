import test from "node:test";
import assert from "node:assert/strict";
import type { NextRequest } from "next/server";

test("POST handler saves dm-action-plan when Supabase succeeds", async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role";
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.test";

  const { getSupabaseAdmin } = await import("@/lib/supabaseAdmin");
  const supabaseAdmin = getSupabaseAdmin();
  const originalFrom = supabaseAdmin.from;
  const insertPayloads: Record<string, unknown>[] = [];

  (supabaseAdmin as unknown as { from: (table: string) => unknown }).from = (table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                user_id: "dm-user-1",
                email: "dm@example.com",
                full_name: "Pocket DM",
              },
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "dm_action_plans") {
      return {
        insert: (rows: Record<string, unknown>[]) => {
          insertPayloads.push(rows[0]);
          return {
            select: () => ({
              maybeSingle: async () => ({ data: { id: "mock-insert-id" }, error: null }),
            }),
          };
        },
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  };

  try {
    const { POST } = await import("../app/api/pocket-manager/forms/submit/route");

    const body = {
      slug: "dm-action-plan",
      data: {
        shopNumber: "447",
        owner: "GM Example",
        dueDate: "2024-12-15",
        priority: "high",
        workstream: "operations",
        actions: "Schedule daily huddles",
        checkpoints: "Weekly DM follow up",
        risks: "Turnover",
        successSignal: "Sustain 90% cadence completion",
      },
      context: {
        loginEmail: "dm@example.com",
        shopNumber: "447",
        shopId: "shop-447",
        storedShopName: "Shop 447",
      },
    };

    const response = await POST({ json: async () => body } as NextRequest);
    const result = await response.json();

    assert.equal(result.ok, true);
    assert.equal(result.table, "dm_action_plans");
    assert.equal(result.id, "mock-insert-id");

    assert.equal(insertPayloads.length, 1);
    assert.equal(insertPayloads[0].owner_name, "GM Example");
    assert.equal(insertPayloads[0].created_by, "dm-user-1");
  } finally {
    (supabaseAdmin as unknown as { from: typeof originalFrom }).from = originalFrom;
  }
});

test("POST handler saves people-employee-profile when Supabase succeeds", async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role";
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.test";

  const { getSupabaseAdmin } = await import("@/lib/supabaseAdmin");
  const supabaseAdmin = getSupabaseAdmin();
  const originalFrom = supabaseAdmin.from;
  const insertPayloads: Record<string, unknown>[] = [];

  (supabaseAdmin as unknown as { from: (table: string) => unknown }).from = (table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                user_id: "dm-user-1",
                email: "dm@example.com",
                full_name: "Pocket DM",
              },
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "shop_staff") {
      return {
        insert: (rows: Record<string, unknown>[]) => {
          insertPayloads.push(rows[0]);
          return {
            select: () => ({
              maybeSingle: async () => ({ data: { id: "mock-staff-id" }, error: null }),
            }),
          };
        },
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  };

  try {
    const { POST } = await import("../app/api/pocket-manager/forms/submit/route");

    const body = {
      slug: "people-employee-profile",
      data: {
        staffName: "Jordan Sample",
        phoneNumber: "555-222-3333",
        hireDate: "2024-05-01",
      },
      context: {
        loginEmail: "dm@example.com",
        shopNumber: "447",
        shopId: "shop-447",
      },
    };

    const response = await POST({ json: async () => body } as NextRequest);
    const result = await response.json();

    assert.equal(result.ok, true);
    assert.equal(result.table, "shop_staff");
    assert.equal(result.id, "mock-staff-id");

    assert.equal(insertPayloads.length, 1);
    assert.equal(insertPayloads[0].shop_id, "shop-447");
    assert.equal(insertPayloads[0].shop_number, "447");
    assert.equal(insertPayloads[0].staff_name, "Jordan Sample");
    assert.equal(insertPayloads[0].employee_phone_number, "555-222-3333");
  } finally {
    (supabaseAdmin as unknown as { from: typeof originalFrom }).from = originalFrom;
  }
});
