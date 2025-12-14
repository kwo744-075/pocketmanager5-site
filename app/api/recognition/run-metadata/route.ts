import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import type { AwardShowRunMetadata } from "@/lib/recognition-captain/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RunMetadataRequest = Partial<AwardShowRunMetadata> & {
  runId?: string | null;
};

type RunMetadataResponse = {
  ok: boolean;
  updatedAt: string;
};

export async function POST(request: Request) {
  try {
    const body = await readRequestBody<RunMetadataRequest>(request);
    if (!body.runId) {
      return NextResponse.json({ error: "Run ID is required." }, { status: 400 });
    }

    const payload: AwardShowRunMetadata = {
      manualAwards: body.manualAwards ?? [],
      confirmations: body.confirmations ?? [],
      birthdays: body.birthdays ?? [],
    };

    const { error } = await supabaseServer
      .from("recognition_runs")
      .update({
        manual_awards_json: payload.manualAwards,
        confirmations_json: payload.confirmations,
        birthdays_json: payload.birthdays,
      })
      .eq("id", body.runId);

    if (error) {
      throw error;
    }

    const response: RunMetadataResponse = { ok: true, updatedAt: new Date().toISOString() };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Recognition run metadata sync error", error);
    return NextResponse.json({ error: "Unable to save run metadata." }, { status: 500 });
  }
}

async function readRequestBody<T>(request: Request): Promise<T> {
  try {
    const text = await request.text();
    if (!text) {
      return {} as T;
    }
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}
