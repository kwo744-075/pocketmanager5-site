#!/usr/bin/env tsx
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";

const workspaceRoot = path.resolve(__dirname, "..", "..");
loadEnvConfig(workspaceRoot);

const SIM_BUCKET = process.env.PULSE_CHECK_SIM_BUCKET ?? "test-data Gulf";
const SIM_OBJECT = process.env.PULSE_CHECK_SIM_OBJECT ?? "Checkins Test Sheet Master..xlsx";
const SIM_WORKBOOK = process.env.PULSE_CHECK_SIM_WORKBOOK ?? "Checkins Test Sheet Master..xlsx";
const SIGNED_URL_TTL_SECONDS = Number(
  process.env.PULSE_CHECK_SIM_SIGNED_URL_TTL ?? 60 * 60 * 24 * 30,
);

async function main() {
  const workbookPath = path.join(workspaceRoot, SIM_WORKBOOK);
  console.log(`Uploading ${workbookPath} to bucket "${SIM_BUCKET}"…`);

  const buffer = await readFile(workbookPath);
  const supabaseAdmin = getSupabaseAdmin();
  const storage = supabaseAdmin.storage.from(SIM_BUCKET);

  const { error: uploadError } = await storage.upload(SIM_OBJECT, buffer, {
    upsert: true,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message ?? uploadError.name}`);
  }

  const ttlDays = Math.round(SIGNED_URL_TTL_SECONDS / 86400);
  const { data: signedUrlData, error: signedUrlError } = await storage.createSignedUrl(
    SIM_OBJECT,
    SIGNED_URL_TTL_SECONDS,
  );

  if (signedUrlError) {
    console.warn("Upload succeeded but signed URL generation failed:", signedUrlError.message);
    return;
  }

  console.log(
    `Upload complete. Signed URL (valid for ~${ttlDays} day${ttlDays === 1 ? "" : "s"}):\n${signedUrlData?.signedUrl}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
