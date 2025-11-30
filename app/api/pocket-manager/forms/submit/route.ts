import { NextResponse, type NextRequest } from "next/server";
import { FORM_LOOKUP, type FormSlug } from "@/app/pocket-manager5/forms/formRegistry";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildSubmissionPlan,
  SubmissionValidationError,
  type ProfileRow,
  type SubmissionPlan,
  type SubmissionContext,
} from "./mapper";

type FormSubmissionBody = {
  slug?: FormSlug;
  data?: Record<string, unknown>;
  context?: SubmissionContext;
};

type ValidationResult =
  | { ok: true; value: { slug: FormSlug; data: Record<string, unknown>; context: SubmissionContext } }
  | { ok: false; error: string };

type ApiError = { error: string };

type ApiSuccess = { ok: true; table: string; id: string | null; message: string };

type SubmissionEvent = "attempt" | "success" | "failure" | "validation";

function logSubmissionEvent(event: SubmissionEvent, metadata: Record<string, unknown>) {
  const payload = { scope: "PocketManagerForms", event, ...metadata };
  if (event === "failure") {
    console.error(payload);
  } else if (event === "validation") {
    console.warn(payload);
  } else {
    console.info(payload);
  }
}

export async function POST(request: NextRequest) {
  try {
    const parseResult = await parseBody(request);
    if (!parseResult.ok) {
      return NextResponse.json<ApiError>({ error: parseResult.error }, { status: 400 });
    }

    const { slug, data, context } = parseResult.value;
    const form = FORM_LOOKUP[slug];

    if (!form?.supabaseTable) {
      return NextResponse.json<ApiError>({ error: "Form is not yet wired to Supabase." }, { status: 400 });
    }

    const profile = await resolveProfile(context.loginEmail);

    let plan: SubmissionPlan | null;
    try {
      plan = await buildSubmissionPlan(slug, data, context, profile);
    } catch (error) {
      if (error instanceof SubmissionValidationError) {
        logSubmissionEvent("validation", { slug, reason: error.message, context });
        return NextResponse.json<ApiError>({ error: error.message }, { status: 400 });
      }
      throw error;
    }
    if (!plan) {
      return NextResponse.json<ApiError>({ error: `Supabase mapping for ${slug} is not implemented yet.` }, { status: 422 });
    }

    logSubmissionEvent("attempt", { slug, table: plan.table, profileResolved: Boolean(profile) });

    const { data: insertedRows, error } = await supabaseAdmin
      .from(plan.table)
      .insert([plan.payload])
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("PocketManager form insert failed", {
        table: plan.table,
        error,
      });
      logSubmissionEvent("failure", { slug, table: plan.table, reason: error.message });
      return NextResponse.json<ApiError>({ error: error.message ?? "Unable to save form to Supabase." }, { status: 500 });
    }

    const insertedId = (insertedRows as { id?: string } | null)?.id ?? null;
    logSubmissionEvent("success", { slug, table: plan.table, id: insertedId });

    return NextResponse.json<ApiSuccess>({
      ok: true,
      table: plan.table,
      id: insertedId,
      message: `Saved to ${plan.table}.`,
    });
  } catch (error) {
    console.error("PocketManager form submission error", error);
    return NextResponse.json<ApiError>({ error: "Unexpected server error." }, { status: 500 });
  }
}

async function parseBody(request: NextRequest): Promise<ValidationResult> {
  try {
    const rawBody = (await request.json()) as FormSubmissionBody;

    if (!rawBody || typeof rawBody !== "object") {
      return { ok: false, error: "Body must be a JSON object." };
    }

    const { slug, data, context } = rawBody;

    if (typeof slug !== "string" || !(slug in FORM_LOOKUP)) {
      return { ok: false, error: "Unknown or missing form slug." };
    }

    if (!data || typeof data !== "object") {
      return { ok: false, error: "Form data payload is required." };
    }

    const safeContext = (context && typeof context === "object" ? context : {}) as SubmissionContext;

    return {
      ok: true,
      value: {
        slug: slug as FormSlug,
        data,
        context: safeContext,
      },
    };
  } catch (error) {
    console.warn("PocketManager form body parse failure", error);
    return { ok: false, error: "Invalid JSON body." };
  }
}

async function resolveProfile(email?: string | null): Promise<ProfileRow | null> {
  if (!email) {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length === 0) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("user_id,email,full_name")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    console.warn("Failed to resolve profile for PocketManager submission", { email, error });
    return null;
  }

  return data ?? null;
}
