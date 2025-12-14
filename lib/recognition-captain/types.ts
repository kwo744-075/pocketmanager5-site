export type RecognitionMetricFormat = "currency" | "percent" | "integer" | "decimal";

export type RecognitionMetricDefinition = {
  key: string;
  label: string;
  description?: string;
  format: RecognitionMetricFormat;
  precision?: number;
  higherIsBetter?: boolean;
};

export type RecognitionRuleQualifierComparison = "gte" | "lte" | "eq" | "neq";

export type RecognitionRuleQualifier = {
  metricKey: string;
  comparison: RecognitionRuleQualifierComparison;
  value: number;
  label?: string;
};

export type RecognitionAwardRule = {
  id: string;
  metricKey: string;
  direction: "asc" | "desc";
  topN: number;
  minValue?: number;
  qualifiers?: RecognitionRuleQualifier[];
  deltaMetricKey?: string;
  tieBreakerMetric?: string;
};

export type RecognitionAwardConfig = {
  id: string;
  label: string;
  description: string;
  narrative: string;
  colorToken: string;
  icon: string;
  rule: RecognitionAwardRule;
};

export type RecognitionDatasetRow = {
  shopNumber: number;
  shopName: string;
  managerName: string;
  districtName: string;
  regionName: string;
  metrics: Record<string, number | null>;
  hireDate?: string | null;
};

export type RecognitionAwardWinner = {
  rank: number;
  shopNumber: number;
  shopName: string;
  managerName: string;
  metricKey: string;
  metricValue: number;
  deltaMetricKey?: string;
  deltaMetricValue?: number;
  districtName?: string;
  regionName?: string;
};

export type RecognitionAwardResult = {
  awardId: string;
  awardLabel: string;
  description: string;
  colorToken: string;
  winners: RecognitionAwardWinner[];
};

export type RecognitionUploaderContext = {
  userId?: string | null;
  email?: string | null;
  alignmentId?: string | null;
};

export type RecognitionProcessingSummary = {
  processedAt: string;
  processedBy: string;
  reportingPeriod: string;
  dataSource: string;
  rowCount: number;
  medianCarCount: number;
  averageTicket: number;
  submissionNotes: string[];
};

export type RecognitionProcessResponse = {
  runId?: string;
  uploader?: RecognitionUploaderContext | null;
  summary: RecognitionProcessingSummary;
  awards: RecognitionAwardResult[];
  dataset: RecognitionDatasetRow[];
};

export type RecognitionUploadHint = {
  title: string;
  description: string;
};

export type RecognitionRuleDraft = RecognitionAwardRule & {
  label: string;
};

export type RecognitionExportJob = {
  exportId: string;
  type: "summary" | "pptx";
  status: "queued" | "ready";
  requestedAt: string;
  readyAt?: string;
  downloadUrl?: string;
};

export type ManualAwardLevel = "DM" | "RD";

export type ManualAwardEntry = {
  id: string;
  level: ManualAwardLevel;
  title: string;
  winnerName: string;
  winnerShop?: number;
  scopeId?: string;
  rationale: string;
  createdBy?: string;
  createdAt: string;
};

export type CelebrationEntry = {
  id: string;
  name: string;
  shopNumber: number;
  shopName?: string;
  districtName?: string;
  regionName?: string;
  dateLabel: string;
  daysUntil: number;
  favoriteTreat?: string;
  celebrationNotes?: string;
  note?: string;
  occursOn?: string;
  highlight?: boolean;
};

export type ConfirmationRow = {
  id: string;
  awardId: string;
  awardLabel: string;
  winnerName: string;
  shopNumber?: number;
  shopLabel?: string;
  level: "Auto" | ManualAwardLevel;
  dmNote?: string;
  rdNote?: string;
  metricKey?: string;
};

export type AwardShowRunMetadata = {
  manualAwards: ManualAwardEntry[];
  confirmations: ConfirmationRow[];
  birthdays: CelebrationEntry[];
};
