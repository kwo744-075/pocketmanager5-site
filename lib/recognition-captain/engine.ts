import { RECOGNITION_AWARD_CONFIG } from "./config";
import {
  type RecognitionAwardConfig,
  type RecognitionAwardResult,
  type RecognitionAwardWinner,
  type RecognitionDatasetRow,
  type RecognitionProcessingSummary,
  type RecognitionRuleQualifier,
} from "./types";

const COMPARATORS: Record<RecognitionRuleQualifier["comparison"], (value: number, threshold: number) => boolean> = {
  gte: (value, threshold) => value >= threshold,
  lte: (value, threshold) => value <= threshold,
  eq: (value, threshold) => value === threshold,
  neq: (value, threshold) => value !== threshold,
};

export type EvaluateRecognitionAwardsOptions = {
  awards?: RecognitionAwardConfig[];
};

export function evaluateRecognitionAwards(
  dataset: RecognitionDatasetRow[],
  options?: EvaluateRecognitionAwardsOptions,
): RecognitionAwardResult[] {
  const awards = options?.awards ?? RECOGNITION_AWARD_CONFIG;
  return awards.map((config) => ({
    awardId: config.id,
    awardLabel: config.label,
    description: config.description,
    colorToken: config.colorToken,
    winners: evaluateAwardWinners(config, dataset),
  }));
}

function evaluateAwardWinners(config: RecognitionAwardConfig, dataset: RecognitionDatasetRow[]): RecognitionAwardWinner[] {
  const { rule } = config;
  const rows = dataset
    .filter((row) => typeof row.metrics[rule.metricKey] === "number")
    .filter((row) => {
      if (rule.minValue === undefined) {
        return true;
      }
      return (row.metrics[rule.metricKey] ?? 0) >= rule.minValue;
    })
    .filter((row) => (rule.qualifiers ? passesQualifiers(row, rule.qualifiers) : true));

  const sorted = [...rows].sort((a, b) => {
    const aValue = a.metrics[rule.metricKey] ?? 0;
    const bValue = b.metrics[rule.metricKey] ?? 0;
    const directionMultiplier = rule.direction === "asc" ? 1 : -1;
    if (aValue !== bValue) {
      return (aValue - bValue) * directionMultiplier;
    }

    if (rule.tieBreakerMetric) {
      const aTie = a.metrics[rule.tieBreakerMetric] ?? 0;
      const bTie = b.metrics[rule.tieBreakerMetric] ?? 0;
      if (aTie !== bTie) {
        return (aTie - bTie) * directionMultiplier;
      }
    }

    return a.shopNumber - b.shopNumber;
  });

  return sorted.slice(0, rule.topN).map((row, index) => ({
    rank: index + 1,
    shopNumber: row.shopNumber,
    shopName: row.shopName,
    managerName: row.managerName,
    metricKey: rule.metricKey,
    metricValue: row.metrics[rule.metricKey] ?? 0,
    deltaMetricKey: rule.deltaMetricKey,
    deltaMetricValue: rule.deltaMetricKey ? row.metrics[rule.deltaMetricKey] ?? undefined : undefined,
    districtName: row.districtName,
    regionName: row.regionName,
  }));
}

function passesQualifiers(row: RecognitionDatasetRow, qualifiers: RecognitionRuleQualifier[]) {
  return qualifiers.every((qualifier) => {
    const comparator = COMPARATORS[qualifier.comparison];
    if (!comparator) {
      return true;
    }
    const value = row.metrics[qualifier.metricKey];
    if (value === null || value === undefined) {
      return false;
    }
    return comparator(value, qualifier.value);
  });
}

export type BuildRecognitionSummaryOptions = {
  reportingPeriod?: string;
  dataSource?: string;
  submissionNotes?: string[];
  processedBy?: string;
  processedAt?: string;
};

export function buildRecognitionSummary(
  dataset: RecognitionDatasetRow[],
  options?: BuildRecognitionSummaryOptions,
): RecognitionProcessingSummary {
  const cars = dataset.map((row) => row.metrics.carCount ?? 0).sort((a, b) => a - b);
  const mid = Math.floor(cars.length / 2);
  const medianCarCount = cars.length ? (cars.length % 2 === 0 ? (cars[mid - 1] + cars[mid]) / 2 : cars[mid]) : 0;
  const averageTicket = dataset.reduce((sum, row) => sum + (row.metrics.ticket ?? 0), 0) / Math.max(dataset.length, 1);

  return {
    processedAt: options?.processedAt ?? new Date().toISOString(),
    processedBy: options?.processedBy ?? "recognition@take5.local",
    reportingPeriod: options?.reportingPeriod ?? "Current Period",
    dataSource: options?.dataSource ?? "Recognition Upload",
    rowCount: dataset.length,
    medianCarCount: Math.round(medianCarCount),
    averageTicket: Math.round(averageTicket),
    submissionNotes: options?.submissionNotes ?? [],
  };
}
