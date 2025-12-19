import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (serviceRole && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRole);
  }
  // fallback to anon client (may be restricted by RLS)
  return supabase;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, awardKey, meta } = body;
    if (!title) {
      return NextResponse.json({ error: "missing title" }, { status: 400 });
    }

    const admin = getAdminClient();
    const insert = {
      title,
      award_key: awardKey ?? null,
      payload: meta ?? {},
      created_at: new Date().toISOString(),
    } as any;

    const { data, error } = await admin.from("awards_show_runtime").insert(insert).select();
    if (error) {
      console.error("add-to-show insert error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, row: data?.[0] ?? null });
  } catch (err: any) {
    console.error("add-to-show route error", err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
