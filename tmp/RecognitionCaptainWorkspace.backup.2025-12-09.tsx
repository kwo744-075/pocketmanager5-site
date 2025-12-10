"use client";

import { useCallback, useEffect, useMemo, useReducer, useState, type ChangeEvent, type ReactNode } from "react";
import {
  ArrowUp,
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  Cake,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Loader2,
  LucideIcon,
  NotebookPen,
  Package,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Table,
} from "lucide-react";
import { usePocketHierarchy } from "@/hooks/usePocketHierarchy";
import { useCaptainRoleGate } from "@/hooks/useCaptainRoleGate";
import {
  formatRecognitionMetricValue,
  RECOGNITION_AWARD_CONFIG,
  RECOGNITION_METRIC_LOOKUP,
  RECOGNITION_METRICS,
} from "@/lib/recognition-captain/config";
import {
  type RecognitionAwardResult,
  type RecognitionDatasetRow,
  type RecognitionExportJob,
  type RecognitionProcessResponse,
  type RecognitionProcessingSummary,
  type RecognitionRuleDraft,
  type CelebrationEntry,
  type ConfirmationRow,
  type ManualAwardEntry,
} from "@/lib/recognition-captain/types";

const ICON_MAP: Record<string, LucideIcon> = {
  crown: BadgeCheck,
  package: Package,
  chart: NotebookPen,
  "line-chart": NotebookPen,
  sparkles: Sparkles,
};

const statusBadgeClassMap: Record<ProcessingState, string> = {
  idle: "text-slate-400 border-slate-700",
  uploading: "text-amber-200 border-amber-400/60",
  ready: "text-emerald-200 border-emerald-400/60",
  error: "text-rose-200 border-rose-400/60",
};

type ProcessingState = "idle" | "uploading" | "ready" | "error";

type ExportKind = "summary" | "pptx";

type UploadKind = "employee" | "shop";

type ExportResponse = {
  exportId: string;
  status: "queued" | "ready";
  readyAt?: string;
  downloadUrl?: string;
};

type AwardShowStepId = "qualifiers" | "uploads" | "manual-awards" | "review" | "exports";

type StepStatus = "complete" | "current" | "upcoming";

type AwardShowStep = {
  id: AwardShowStepId;
  label: string;
  description: string;
  icon: LucideIcon;
};

const AWARD_SHOW_STEPS: AwardShowStep[] = [
  { id: "qualifiers", label: "Qualifiers & uploads", description: "Power Ranker + Period Results", icon: Sparkles },
  { id: "uploads", label: "Confirm lists and employee names", description: "KPI + EPR data", icon: FileSpreadsheet },
  { id: "manual-awards", label: "Manual awards", description: "DM & RD selections", icon: NotebookPen },
  { id: "review", label: "Review", description: "Confirm winners & notes", icon: ShieldCheck },
  { id: "exports", label: "Generate", description: "Decks & CSV", icon: Download },
];

type UploadedFileMeta = {
  name: string;
  uploadedAt: string;
  rows?: number;
  notes?: string[];
};

type QualifierUploadKind = "powerRanker" | "periodWinner";

type QualifierUploadResult = {
  powerRanker?: UploadedFileMeta;
  periodWinner?: UploadedFileMeta;
  coverageNotes?: string[];
  previewRows?: RecognitionDatasetRow[];
};

type AwardShowRunDraft = {
  period: string;
  qualifiers: QualifierUploadResult | null;
  uploads: {
    employee?: UploadedFileMeta;
    shop?: UploadedFileMeta;
  };
  manualAwards: ManualAwardEntry[];
  birthdays: CelebrationEntry[];
  anniversaries: CelebrationEntry[];
  confirmations: ConfirmationRow[];
};

const AWARD_SHOW_DRAFT_STORAGE_KEY = "pocketmanager-award-show-draft";

const defaultAwardShowDraft: AwardShowRunDraft = {
  period: "",
  qualifiers: null,
  uploads: {},
  manualAwards: [],
  birthdays: [],
  anniversaries: [],
  confirmations: [],
};

// ... file continues (backup of the current edited file)
