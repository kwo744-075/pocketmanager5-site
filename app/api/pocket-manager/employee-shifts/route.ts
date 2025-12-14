import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type ApiBody = {
  action?: "create" | "update" | "delete" | "bulk_insert";
  payload?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ApiBody;
    const action = body.action ?? "create";
    const payload = body.payload ?? {};

    const admin = getSupabaseAdmin();

    if (action === "create") {
      const { data, error } = await admin.from("employee_shifts").insert([payload]).select("id").maybeSingle<{ id: string }>();
      if (error) {
        console.error("employee_shifts insert failed", error);
        return NextResponse.json({ error: error.message ?? "Insert failed" }, { status: 500 });
      }
      return NextResponse.json({ ok: true, id: data?.id ?? null });
    }

    if (action === "bulk_insert") {
      // payload expected to be an array of shift objects
      const items = Array.isArray(payload) ? (payload as Record<string, unknown>[]) : [];
      if (items.length === 0) return NextResponse.json({ error: "No items provided" }, { status: 400 });
      const { data, error } = await admin.from("employee_shifts").insert(items);
      if (error) {
        console.error("employee_shifts bulk insert failed", error);
        return NextResponse.json({ error: error.message ?? "Bulk insert failed" }, { status: 500 });
      }
      const bulkData = data as any;
      return NextResponse.json({ ok: true, inserted: Array.isArray(bulkData) ? bulkData.length : 0 });
    }

    if (action === "update") {
      const id = payload.id as string | undefined;
      if (!id) return NextResponse.json({ error: "Missing id for update" }, { status: 400 });
      const updates = { ...payload } as Record<string, unknown>;
      delete updates.id;
      const { data, error } = await admin.from("employee_shifts").update(updates).eq("id", id).select("id").maybeSingle<{ id: string }>();
      if (error) {
        console.error("employee_shifts update failed", error);
        return NextResponse.json({ error: error.message ?? "Update failed" }, { status: 500 });
      }
      return NextResponse.json({ ok: true, id: data?.id ?? id });
    }

    if (action === "delete") {
      const id = payload.id as string | undefined;
      if (!id) return NextResponse.json({ error: "Missing id for delete" }, { status: 400 });
      const { error } = await admin.from("employee_shifts").delete().eq("id", id);
      if (error) {
        console.error("employee_shifts delete failed", error);
        return NextResponse.json({ error: error.message ?? "Delete failed" }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("employee-shifts api error", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
