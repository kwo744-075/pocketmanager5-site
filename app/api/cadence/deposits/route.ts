import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "@/lib/auth/session";
import { hasShopAccess } from "@/lib/auth/alignment";

const UPLOAD_BUCKET = process.env.CADENCE_UPLOAD_BUCKET ?? "cadence-uploads";

type DepositEntryPayload = {
  date: string;
  shopId: string;
  bankVisitVerified: boolean;
  depositAmount: number;
  expectedAmount: number;
  cashOverShort: number;
  notes?: string;
};

export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const url = new URL(request.url);
    const shopId = url.searchParams.get("shopId");
    const date = url.searchParams.get("date");

    const admin = getSupabaseAdmin();
    let query = admin.from("deposit_entries").select("*");

    if (session.alignment?.shops?.length) {
      query = query.in("shop_id", session.alignment.shops);
    }

    if (shopId) {
      if (!hasShopAccess(session.alignment, shopId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      query = query.eq("shop_id", shopId);
    }

    if (date) {
      query = query.eq("date", date);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) {
      console.error("deposit_entries select failed", error);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("deposit GET error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const body = await request.json();
    if (!body?.date || !body?.shopId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!hasShopAccess(session.alignment, body.shopId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    // Allow clients to send an array of file URLs (we now expect the client to upload via /api/cadence/uploads first)
    // Normalize incoming files: support either an array of signed URL strings
    // or objects returned by the upload proxy ({ path, signedUrl, expiresAt }).
    const incomingFiles = Array.isArray(body.files) ? body.files : [];
    const filesPayload = incomingFiles
      .map((f: any) => {
        if (!f) return null;
        if (typeof f === "string") return { signed_url: f };
        return {
          signed_url: f.signedUrl ?? f.signed_url ?? null,
          path: f.path ?? null,
          expires_at: f.expiresAt ?? f.expires_at ?? null,
        };
      })
      .filter(Boolean);

    // Verify signed URLs look like they originate from our Supabase storage bucket.
    // Signed URLs from Supabase have the form: https://<project>.supabase.co/storage/v1/object/sign/<bucket>/<path>?...
    for (const f of filesPayload) {
      if (f?.signed_url && typeof f.signed_url === "string") {
        if (!f.signed_url.includes(`/storage/v1/object/sign/${UPLOAD_BUCKET}/`)) {
          console.warn("Rejected file signed_url not in expected bucket", f.signed_url);
          return NextResponse.json({ error: "Invalid file URL" }, { status: 400 });
        }
      } else if (f?.path && typeof f.path === "string") {
        // basic safety: disallow traversal and ensure path looks like uploads/...
        if (f.path.includes("..") || f.path.startsWith("/")) {
          console.warn("Rejected file path invalid", f.path);
          return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
        }
      } else {
        // neither signed_url nor path provided
        return NextResponse.json({ error: "Invalid file object" }, { status: 400 });
      }
    }

    const payload: Partial<DepositEntryPayload & { created_by?: string; alignment_id?: string; files?: any[] }> = {
      date: body.date,
      shop_id: String(body.shopId),
      bank_visit_verified: Boolean(body.bankVisitVerified) ?? false,
      deposit_amount: Number(body.depositAmount) || null,
      expected_amount: Number(body.expectedAmount) || null,
      cash_over_short: Number(body.cashOverShort) || 0,
      notes: body.notes ?? null,
      files: filesPayload,
      created_by: session.user.id,
      alignment_id: session.alignment?.activeAlignmentId ?? null,
    } as any;

    const { data, error } = await admin.from("deposit_entries").insert([payload]).select().maybeSingle();
    if (error) {
      console.error("deposit_entries insert failed", error);
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error("deposit POST error", err);
    return NextResponse.json({ error: "Invalid JSON or server error" }, { status: 400 });
  }
}
