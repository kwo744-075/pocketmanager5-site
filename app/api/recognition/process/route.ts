import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getServerSession } from "@/lib/auth/session";
import { buildMockRecognitionResponse } from "@/lib/recognition-captain/mockData";
import { evaluateRecognitionAwards, buildRecognitionSummary } from "@/lib/recognition-captain/engine";
import { parseRecognitionUpload, RecognitionUploadError } from "@/lib/recognition-captain/parser";
import { RECOGNITION_AWARD_CONFIG } from "@/lib/recognition-captain/config";
import type { RecognitionRuleDraft, RecognitionUploaderContext } from "@/lib/recognition-captain/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_TOP_N = 15;
const MIN_TOP_N = 1;

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
      const raw = await request.text();
      const period = raw ? (JSON.parse(raw) as { period?: string }).period : undefined;
      const payload = buildMockRecognitionResponse({ reportingPeriod: period });
      return NextResponse.json(payload);
    }

    const formData = await request.formData();
    const periodOverride = formData.get("period")?.toString()?.trim() || undefined;
    const rawRules = formData.get("rules");
    const rulesPayload = typeof rawRules === "string" ? rawRules : null;
    const ruleOverrides = parseRuleOverrides(rulesPayload);
    const awardsConfig = applyRuleOverrides(ruleOverrides);
    const file = formData.get("file");

    if (!(file instanceof File)) {
      const payload = buildMockRecognitionResponse({ reportingPeriod: periodOverride });
      return NextResponse.json(payload);
    }

    const parsedUpload = await parseRecognitionUpload(file);
    const session = await getServerSession();
    const dataset = parsedUpload.rows;
    const submissionNotes = [
      ...parsedUpload.submissionNotes,
      ruleOverrides.size ? "Custom award thresholds applied from client request." : null,
    ].filter((note): note is string => Boolean(note));

    const reportingPeriod = periodOverride || parsedUpload.reportingPeriod || "Current Period";
    const dataSource = parsedUpload.dataSource || file.name || "Recognition Upload";
    const awards = evaluateRecognitionAwards(dataset, { awards: awardsConfig });
    const summary = buildRecognitionSummary(dataset, {
      reportingPeriod,
      dataSource,
      submissionNotes,
      processedBy: session.user?.email ?? "recognition@take5.local",
    });

    let runId: string | null = null;
    try {
      const { data: inserted, error } = await supabaseServer
        .from("recognition_runs")
        .insert({
          reporting_period: summary.reportingPeriod,
          data_source: summary.dataSource,
          file_name: file.name ?? null,
          processed_by: summary.processedBy,
          uploader_user_id: session.user?.id ?? null,
          uploader_alignment_id: session.alignment?.activeAlignmentId ?? null,
          row_count: summary.rowCount,
          median_car_count: summary.medianCarCount,
          average_ticket: summary.averageTicket,
          submission_notes: summary.submissionNotes,
          summary_json: summary,
          awards_json: awards,
          dataset_json: dataset,
          rule_overrides: buildRuleOverridePayload(ruleOverrides),
          manual_awards_json: [],
          confirmations_json: [],
          birthdays_json: [],
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }
      runId = inserted?.id ?? null;
    } catch (insertError) {
      console.warn("Recognition run insert failed, responding without persistence", insertError);
    }

    const uploaderContext: RecognitionUploaderContext = {
      userId: session.user?.id ?? null,
      email: session.user?.email ?? null,
      alignmentId: session.alignment?.activeAlignmentId ?? null,
    };

    return NextResponse.json({
      runId,
      uploader: uploaderContext,
      summary,
      awards,
      dataset,
    });
  } catch (error) {
    if (error instanceof RecognitionUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Recognition Captain process error", error);
    return NextResponse.json({ error: "Unable to process recognition upload" }, { status: 500 });
  }
}

type RuleOverride = {
  topN?: number;
  minValue?: number;
};

function parseRuleOverrides(raw: string | null): Map<string, RuleOverride> {
  if (!raw) {
    return new Map();
  }

  try {
    const parsed = JSON.parse(raw) as RecognitionRuleDraft[];
    const overrides = new Map<string, RuleOverride>();
    parsed.forEach((rule) => {
      const override = normalizeRuleOverride(rule);
      if (override) {
        overrides.set(rule.id, override);
      }
    });
    return overrides;
  } catch (error) {
    console.warn("Recognition rule overrides failed to parse", error);
    return new Map();
  }
}

function normalizeRuleOverride(rule: RecognitionRuleDraft): RuleOverride | null {
  const override: RuleOverride = {};

  if (typeof rule.topN === "number" && Number.isFinite(rule.topN)) {
    const clamped = Math.min(MAX_TOP_N, Math.max(MIN_TOP_N, Math.round(rule.topN)));
    override.topN = clamped;
  }

  if (typeof rule.minValue === "number" && Number.isFinite(rule.minValue)) {
    override.minValue = rule.minValue;
  }

  return Object.keys(override).length ? override : null;
}

function applyRuleOverrides(overrides: Map<string, RuleOverride>) {
  if (!overrides.size) {
    return RECOGNITION_AWARD_CONFIG;
  }

  return RECOGNITION_AWARD_CONFIG.map((config) => {
    const override = overrides.get(config.rule.id);
    if (!override) {
      return config;
    }
    return {
      ...config,
      rule: {
        ...config.rule,
        topN: override.topN ?? config.rule.topN,
        minValue: override.minValue ?? config.rule.minValue,
      },
    };
  });
}

function buildRuleOverridePayload(overrides: Map<string, RuleOverride>) {
  if (!overrides.size) {
    return null;
  }

  const entries = Array.from(overrides.entries()).map(([id, override]) => {
    const payload = Object.fromEntries(
      Object.entries(override).filter(([, value]) => value !== undefined && value !== null),
    );
    return [id, payload];
  });

  return Object.fromEntries(entries);
}
