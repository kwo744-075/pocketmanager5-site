import { supabaseServer } from "@/lib/supabaseServer";
import type {
  RecognitionAwardResult,
  RecognitionDatasetRow,
  RecognitionProcessingSummary,
} from "@shared/features/recognition-captain/types";

export class RecognitionRunNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecognitionRunNotFoundError";
  }
}

export type RecognitionRunRecord = {
  id: string;
  createdAt: string;
  reportingPeriod: string;
  dataSource: string;
  fileName: string | null;
  processedBy: string | null;
  submissionNotes: string[];
  summary: RecognitionProcessingSummary;
  awards: RecognitionAwardResult[];
  dataset: RecognitionDatasetRow[];
};

type RecognitionRunRow = {
  id: string;
  created_at: string;
  reporting_period: string;
  data_source: string;
  file_name: string | null;
  processed_by: string | null;
  submission_notes: string[];
  summary_json: RecognitionProcessingSummary;
  awards_json: RecognitionAwardResult[];
  dataset_json: RecognitionDatasetRow[];
};

export async function loadRecognitionRun(runId?: string | null): Promise<RecognitionRunRecord> {
  if (!runId) {
    throw new RecognitionRunNotFoundError("Recognition run ID is required.");
  }

  const { data, error } = await supabaseServer
    .from("recognition_runs")
    .select(
      "id, created_at, reporting_period, data_source, file_name, processed_by, submission_notes, summary_json, awards_json, dataset_json",
    )
    .eq("id", runId)
    .single();

  if (error || !data) {
    throw new RecognitionRunNotFoundError("Recognition run not found.");
  }

  const record = data as RecognitionRunRow;

  return {
    id: record.id,
    createdAt: record.created_at,
    reportingPeriod: record.reporting_period,
    dataSource: record.data_source,
    fileName: record.file_name,
    processedBy: record.processed_by,
    submissionNotes: record.submission_notes ?? [],
    summary: record.summary_json,
    awards: record.awards_json,
    dataset: record.dataset_json,
  } satisfies RecognitionRunRecord;
}