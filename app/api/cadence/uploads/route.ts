import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "@/lib/auth/session";

// Server-side upload proxy. Accepts multipart/form-data with one or more
// files in the `files` field. Stores files into the `cadence-uploads` bucket
// using the Supabase admin client and returns signed, time-limited URLs that
// grant access to the private objects instead of public URLs.

const UPLOAD_BUCKET = process.env.CADENCE_UPLOAD_BUCKET ?? "cadence-uploads";
const SIGNED_URL_EXPIRES = Number(process.env.CADENCE_SIGNED_URL_EXPIRY_SECONDS ?? "3600");

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const formData = await request.formData();
    const entries = Array.from(formData.entries()).filter(([k]) => k === "files");
    if (entries.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const uploaded: Array<{ path: string; signedUrl: string; expiresAt: string }> = [];

    for (const [, value] of entries) {
      // value may be a File or a single Blob; handle both
      // If multiple files were appended under 'files', value will be the file.
      const file = value as any;
      if (!file || typeof file.stream !== "function") continue;

      const filename = file.name ?? `upload-${Date.now()}`;
      const ext = filename.split('.').pop() ?? 'bin';
      const filePath = `uploads/${session.user?.id ?? 'anon'}/${Date.now()}_${filename}`;

      // In Node/Edge, file.stream() returns a ReadableStream — supabase-js accepts a Blob/ReadableStream
      const stream = file.stream();

      const { error } = await admin.storage.from(UPLOAD_BUCKET).upload(filePath, stream as any, {
        contentType: file.type ?? undefined,
        upsert: false,
      } as any);

      if (error) {
        console.error("upload proxy: storage.upload error", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
      }

      // Create a signed URL for the uploaded file (expires in SIGNED_URL_EXPIRES seconds)
      const { data: signedData, error: signedErr } = await admin.storage
        .from(UPLOAD_BUCKET)
        .createSignedUrl(filePath, SIGNED_URL_EXPIRES);

      if (signedErr || !signedData?.signedUrl) {
        console.error("upload proxy: createSignedUrl failed", signedErr);
        return NextResponse.json({ error: "Failed to create signed URL" }, { status: 500 });
      }

      const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRES * 1000).toISOString();
      uploaded.push({ path: filePath, signedUrl: signedData.signedUrl, expiresAt });
    }

    return NextResponse.json({ uploaded });
  } catch (err) {
    console.error("upload proxy error", err);
    return NextResponse.json({ error: "Server error during upload" }, { status: 500 });
  }
}
