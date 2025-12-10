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
  Paperclip,
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
import CompactKpiLeaders from "./CompactKpiLeaders";
import OnePagerGrid from "./OnePagerGrid";
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

type UploadKind = "employee" | "shop" | "customRegion";

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
  { id: "qualifiers", label: "Qualifiers & uploads", description: "", icon: Sparkles },
  { id: "uploads", label: "Reports", description: "", icon: FileSpreadsheet },
  { id: "manual-awards", label: "Rankings", description: "", icon: NotebookPen },
  { id: "review", label: "Review", description: "", icon: ShieldCheck },
  { id: "exports", label: "Generate", description: "", icon: Download },
];

type UploadedFileMeta = {
  name: string;
  uploadedAt: string;
  rows?: number;
  notes?: string[];
};

type QualifierUploadKind = "powerRanker" | "periodWinner" | "donations";

type QualifierUploadResult = {
  powerRanker?: UploadedFileMeta;
  periodWinner?: UploadedFileMeta;
  donations?: UploadedFileMeta;
  coverageNotes?: string[];
  previewRows?: RecognitionDatasetRow[];
};

type AwardShowRunDraft = {
  period: string;
  qualifiers: QualifierUploadResult | null;
  uploads: {
    employee?: UploadedFileMeta;
    shop?: UploadedFileMeta;
    customRegion?: UploadedFileMeta;
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

type AwardShowAction =
  | { type: "setPeriod"; value: string }
  | { type: "setUploadMeta"; kind: UploadKind; meta?: UploadedFileMeta }
  | { type: "setQualifierMeta"; kind: QualifierUploadKind; meta?: UploadedFileMeta; previewRows?: RecognitionDatasetRow[] }
  | { type: "setManualAward"; entry: ManualAwardEntry }
  | { type: "setCelebrations"; birthdays?: CelebrationEntry[]; anniversaries?: CelebrationEntry[] }
  | { type: "setConfirmations"; rows: ConfirmationRow[] }
  | { type: "reset" };

type MetadataStatus = "idle" | "saving" | "saved" | "error";

function awardShowReducer(state: AwardShowRunDraft, action: AwardShowAction): AwardShowRunDraft {
  switch (action.type) {
    case "setPeriod":
      return { ...state, period: action.value };
    case "setUploadMeta":
      return { ...state, uploads: { ...state.uploads, [action.kind]: action.meta } };
    case "setQualifierMeta": {
      const nextQualifiers: QualifierUploadResult = {
        ...(state.qualifiers ?? {}),
        [action.kind]: action.meta,
      };
      if (action.previewRows) {
        nextQualifiers.previewRows = action.previewRows;
      }
      return { ...state, qualifiers: nextQualifiers };
    }
    case "setManualAward": {
      const filtered = state.manualAwards.filter((entry) => entry.id !== action.entry.id);
      return { ...state, manualAwards: [...filtered, action.entry] };
    }
    case "setCelebrations":
      return {
        ...state,
        birthdays: action.birthdays ?? state.birthdays,
        anniversaries: action.anniversaries ?? state.anniversaries,
      };
    case "setConfirmations":
      return { ...state, confirmations: action.rows };
    case "reset":
      return defaultAwardShowDraft;
    default:
      return state;
  }
}

function loadAwardShowDraft(): AwardShowRunDraft {
  if (typeof window === "undefined") {
    return defaultAwardShowDraft;
  }
  const raw = window.localStorage.getItem(AWARD_SHOW_DRAFT_STORAGE_KEY);
  if (!raw) {
    return defaultAwardShowDraft;
  }
  try {
    const parsed = JSON.parse(raw) as AwardShowRunDraft;
    return { ...defaultAwardShowDraft, ...parsed };
  } catch (error) {
    console.warn("Failed to parse award show draft from storage", error);
    return defaultAwardShowDraft;
  }
}

export function RecognitionCaptainWorkspace() {
  const hierarchy = usePocketHierarchy("/pocket-manager5/dm-tools/captains/recognition");
  const scopeLevel = hierarchy.hierarchy?.scope_level ?? null;
  const scopeSummary = hierarchy.hierarchy;
  const { role, canEditRules, canQueueExports } = useCaptainRoleGate({
    scopeLevel,
    loading: hierarchy.hierarchyLoading,
  });
  const defaultRules = useMemo(
    () => RECOGNITION_AWARD_CONFIG.map((config) => ({ ...config.rule, label: config.label })),
    [],
  );
  const [draft, dispatch] = useReducer(awardShowReducer, undefined, loadAwardShowDraft);
  const periodValue = draft.period;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(AWARD_SHOW_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('pocketmanager-award-mapper');
      if (raw) {
        setFileMapperState(JSON.parse(raw));
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const [activeStep, setActiveStep] = useState<AwardShowStepId>("qualifiers");
  const [qualifierUploadState, setQualifierUploadState] = useState<Record<QualifierUploadKind, ProcessingState>>({
    powerRanker: "idle",
    periodWinner: "idle",
    donations: "idle",
  });
  const [rules, setRules] = useState<RecognitionRuleDraft[]>(() => defaultRules.map((rule) => ({ ...rule })));
  const [ruleMessage, setRuleMessage] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<ProcessingState>("idle");
  const [statusMessage, setStatusMessage] = useState("Upload a KPI workbook to calculate captains.");
  const [lastFileName, setLastFileName] = useState<string | null>(null);
  const [summary, setSummary] = useState<RecognitionProcessingSummary | null>(null);
  const [awards, setAwards] = useState<RecognitionAwardResult[]>([]);
  const [dataset, setDataset] = useState<RecognitionDatasetRow[]>([]);
  const qualifierDataset = draft.qualifiers?.previewRows?.length ? draft.qualifiers.previewRows : dataset;
  const [winnerThresholds, setWinnerThresholds] = useState<PeriodWinnerThresholds>({
    minOilChanges: 100,
    npsQualifier: 80,
  });
  const periodWinnerInsights = useMemo(
    () => buildPeriodWinnerInsights(qualifierDataset, winnerThresholds),
    [qualifierDataset, winnerThresholds],
  );
  const anniversaryEntries = useMemo(() => buildAnniversaryEntries(dataset), [dataset]);
  const [exportJobs, setExportJobs] = useState<RecognitionExportJob[]>([]);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [uploaderEmail, setUploaderEmail] = useState<string | null>(null);
  const [fileMapperState, setFileMapperState] = useState<any>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Qualification lists (derived from dataset + thresholds)
  const [qualifiedEmployees, setQualifiedEmployees] = useState<RecognitionDatasetRow[]>([]);
  const [disqualifiedEmployees, setDisqualifiedEmployees] = useState<RecognitionDatasetRow[]>([]);
  const [qualifiedShops, setQualifiedShops] = useState<RecognitionDatasetRow[]>([]);
  const [disqualifiedShops, setDisqualifiedShops] = useState<RecognitionDatasetRow[]>([]);
  // KPI leaderboards (computed from qualified pools)
  const [kpiLeadersEmployees, setKpiLeadersEmployees] = useState<Record<string, RecognitionDatasetRow[]>>({});
  const [kpiLeadersShops, setKpiLeadersShops] = useState<Record<string, RecognitionDatasetRow[]>>({});
  // Global runtime error catcher (shows a visible banner instead of a blank screen)
  const [runtimeError, setRuntimeError] = useState<any>(null);
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      // eslint-disable-next-line no-console
      console.error("Runtime error event:", e.error ?? e.message ?? e);
      setRuntimeError(e.error ?? e.message ?? String(e));
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      // eslint-disable-next-line no-console
      console.error("Unhandled rejection:", e.reason ?? e);
      setRuntimeError(e.reason ?? String(e));
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection as any);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection as any);
    };
  }, []);
  const [birthdaysLoading, setBirthdaysLoading] = useState(false);
  const [birthdaysError, setBirthdaysError] = useState<string | null>(null);
  const [metadataStatus, setMetadataStatus] = useState<MetadataStatus>("idle");
  const [metadataMessage, setMetadataMessage] = useState<string | null>(null);
  // Manual award modal state
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState<{ winnerName: string; winnerShop: string; district: string; rationale: string; title: string }>({
    winnerName: "",
    winnerShop: "",
    district: "",
    rationale: "",
    title: "KPI District winner",
  });

  const qualifiersComplete = Boolean(draft.qualifiers?.powerRanker && draft.qualifiers?.periodWinner);
  const uploadsComplete = dataset.length > 0;
  const manualAwardsComplete = draft.manualAwards.some((entry) => entry.winnerName?.trim().length);
  const reviewComplete = uploadsComplete;
  const exportsComplete = exportJobs.length > 0;

  const sanitizedManualAwards = useMemo(
    () =>
      draft.manualAwards
        .map((entry) => ({
          ...entry,
          winnerName: entry.winnerName.trim(),
          rationale: entry.rationale.trim(),
        }))
        .filter((entry) => entry.winnerName.length > 0),
    [draft.manualAwards],
  );

  const sanitizedConfirmations = useMemo(
    () =>
      draft.confirmations.map((row) => ({
        ...row,
        dmNote: row.dmNote?.trim() ?? "",
        rdNote: row.rdNote?.trim() ?? "",
      })),
    [draft.confirmations],
  );

  const sanitizedBirthdays = useMemo(() => draft.birthdays.map((entry) => ({ ...entry })), [draft.birthdays]);

  const metadataPayload = useMemo(
    () => ({
      manualAwards: sanitizedManualAwards,
      confirmations: sanitizedConfirmations,
      birthdays: sanitizedBirthdays,
    }),
    [sanitizedManualAwards, sanitizedConfirmations, sanitizedBirthdays],
  );

  const metadataSignature = useMemo(() => JSON.stringify(metadataPayload), [metadataPayload]);

  const isStepComplete = useCallback(
    (stepId: AwardShowStepId) => {
      switch (stepId) {
        case "qualifiers":
          return qualifiersComplete;
        case "uploads":
          return uploadsComplete;
        case "manual-awards":
          return manualAwardsComplete;
        case "review":
          return reviewComplete;
        case "exports":
          return exportsComplete;
        default:
          return false;
      }
    },
    [qualifiersComplete, uploadsComplete, manualAwardsComplete, reviewComplete, exportsComplete],
  );

  const stepsWithStatus = useMemo(
    () =>
      AWARD_SHOW_STEPS.map((step) => {
        const status: StepStatus =
          step.id === activeStep ? "current" : isStepComplete(step.id) ? "complete" : "upcoming";
        return { ...step, status };
      }),
    [activeStep, isStepComplete],
  );

  const readinessChecklist = useMemo(
    () => [
      {
        id: "qualifiers",
        label: "Qualifier pool ready",
        helper: "Power Ranker + Period Results files",
        complete: qualifiersComplete,
      },
      {
        id: "uploads",
        label: "KPI dataset processed",
        helper: "EPR + Shop uploads minted",
        complete: uploadsComplete,
      },
      {
        id: "manual",
        label: "Manual awards (optional)",
        helper: "DM & RD picks saved when available",
        complete: manualAwardsComplete,
      },
      {
        id: "review",
        label: "Review ready",
        helper: "Confirmation notes + celebrations",
        complete: reviewComplete,
      },
      {
        id: "exports",
        label: "Exports queued",
        helper: "CSV/PPT deck requested",
        complete: exportsComplete,
      },
    ],
    [qualifiersComplete, uploadsComplete, manualAwardsComplete, reviewComplete, exportsComplete],
  );

  // Compute qualified/disqualified employees and shops when dataset or thresholds change
  useEffect(() => {
    if (!dataset || dataset.length === 0) {
      setQualifiedEmployees([]);
      setDisqualifiedEmployees([]);
      setQualifiedShops([]);
      setDisqualifiedShops([]);
      return;
    }

    const qEmployees: RecognitionDatasetRow[] = [];
    const dEmployees: RecognitionDatasetRow[] = [];

    // Treat rows with a managerName as employee-level rows
    for (const row of dataset) {
      const isEmployee = Boolean(row.managerName);
      if (!isEmployee) continue;
      const cars = Number(row.metrics?.carCount ?? 0);
      const nps = Number(row.metrics?.csi ?? 0);
      if (Number.isFinite(cars) && cars < winnerThresholds.minOilChanges) {
        dEmployees.push(row);
      } else if (Number.isFinite(nps) && nps < winnerThresholds.npsQualifier) {
        dEmployees.push(row);
      } else {
        qEmployees.push(row);
      }
    }

    // Build shop-level map (one representative row per shop)
    const shopMap = new Map<number, RecognitionDatasetRow>();
    for (const row of dataset) {
      const existing = shopMap.get(row.shopNumber);
      if (!existing) {
        shopMap.set(row.shopNumber, row);
      } else {
        // prefer the row with higher car count as representative
        const existingCars = Number(existing.metrics?.carCount ?? 0);
        const newCars = Number(row.metrics?.carCount ?? 0);
        if (newCars > existingCars) {
          shopMap.set(row.shopNumber, row);
        }
      }
    }

    const qSh: RecognitionDatasetRow[] = [];
    const dSh: RecognitionDatasetRow[] = [];
    for (const [, shopRow] of shopMap) {
      const nps = Number(shopRow.metrics?.csi ?? 0);
      if (Number.isFinite(nps) && nps < winnerThresholds.npsQualifier) {
        dSh.push(shopRow);
      } else {
        qSh.push(shopRow);
      }
    }

    setQualifiedEmployees(qEmployees.sort((a, b) => (b.metrics.csi ?? 0) - (a.metrics.csi ?? 0)));
    setDisqualifiedEmployees(dEmployees);
    setQualifiedShops(qSh.sort((a, b) => (b.metrics.csi ?? 0) - (a.metrics.csi ?? 0)));
    setDisqualifiedShops(dSh);
  }, [dataset, winnerThresholds]);

  // Compute KPI leaderboards for employees and shops whenever qualified pools change
  useEffect(() => {
    const topN = 10;
    const empLeaders: Record<string, RecognitionDatasetRow[]> = {};
    const shopLeaders: Record<string, RecognitionDatasetRow[]> = {};

    for (const metric of RECOGNITION_METRICS) {
      const key = metric.key;

      const empSorted = [...qualifiedEmployees]
        .filter((r) => typeof r.metrics?.[key] === 'number' && Number.isFinite(r.metrics?.[key]))
        .sort((a, b) => (b.metrics?.[key] ?? 0) - (a.metrics?.[key] ?? 0))
        .slice(0, topN);

      const shopSorted = [...qualifiedShops]
        .filter((r) => typeof r.metrics?.[key] === 'number' && Number.isFinite(r.metrics?.[key]))
        .sort((a, b) => (b.metrics?.[key] ?? 0) - (a.metrics?.[key] ?? 0))
        .slice(0, topN);

      empLeaders[key] = empSorted;
      shopLeaders[key] = shopSorted;
    }

    setKpiLeadersEmployees(empLeaders);
    setKpiLeadersShops(shopLeaders);
  }, [qualifiedEmployees, qualifiedShops]);

  // Helpers to retrieve leader lists for UI consumers
  const getTopEmployeeLeaders = (metricKey: string, limit = 10) => {
    const list = kpiLeadersEmployees[metricKey] ?? [];
    return list.slice(0, limit);
  };

  const getTopShopLeaders = (metricKey: string, limit = 10) => {
    const list = kpiLeadersShops[metricKey] ?? [];
    return list.slice(0, limit);
  };

  const currentStepIndex = AWARD_SHOW_STEPS.findIndex((step) => step.id === activeStep);
  const canGoPrev = currentStepIndex > 0;
  const canGoNext = currentStepIndex < AWARD_SHOW_STEPS.length - 1;
  const handleThresholdChange = useCallback((key: keyof PeriodWinnerThresholds, value: number) => {
    setWinnerThresholds((prev) => {
      const nextValue = Number.isFinite(value) ? Math.max(0, value) : prev[key];
      if (nextValue === prev[key]) {
        return prev;
      }
      return {
        ...prev,
        [key]: nextValue,
      };
    });
  }, []);

  const processUpload = useCallback(
    async (options?: { file?: File; sourceLabel?: string }) => {
      const { file, sourceLabel } = options ?? {};
      setUploadState("uploading");
      const descriptor = sourceLabel ? sourceLabel : "KPI data";
      setStatusMessage(file ? `Uploading ${descriptor} (${file.name})...` : `Loading ${descriptor}...`);
      setUploadError(null);

      try {
        const formData = new FormData();
        if (file) {
          formData.append("file", file);
        }
        const trimmedPeriod = periodValue.trim();
        if (trimmedPeriod) {
          formData.append("period", trimmedPeriod);
        }
        formData.append("rules", JSON.stringify(rules));

        const response = await fetch("/api/recognition/process", {
          method: "POST",
          body: formData,
        });

        const payload = (await response.json()) as RecognitionProcessResponse & { error?: string };

        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to process recognition upload");
        }

        setSummary(payload.summary);
        setAwards(payload.awards);
        setDataset(payload.dataset);
        setActiveRunId(payload.runId ?? null);
        const uploaderLabel = payload.uploader?.email ?? payload.summary.processedBy ?? null;
        setUploaderEmail(uploaderLabel);
        setUploadState("ready");
        const successMessage = `Processed ${payload.summary.rowCount} rows • ${payload.summary.reportingPeriod}`;
        setStatusMessage(uploaderLabel ? `${successMessage} • minted by ${uploaderLabel}` : successMessage);
        setUploadError(null);
        return true;
      } catch (error) {
        console.error(error);
        setUploadState("error");
        const errorMessage = error instanceof Error ? error.message : "Upload failed. Double-check the headers and try again.";
        setStatusMessage(errorMessage);
        setUploadError(errorMessage);
        return false;
      }
    },
    [periodValue, rules],
  );
  const handleFileChange = useCallback(
    (kind: UploadKind) =>
      async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
          return;
        }
        const label = kind === "employee" ? "Employee performance" : kind === "customRegion" ? "Custom Region" : "Shop KPI";
        setLastFileName(`${label} · ${file.name}`);
        // Client-side parsing helpers
        const parseFileToRows = async (file: File) => {
          const ext = file.name.split('.').pop()?.toLowerCase();
          if (ext === 'csv' || ext === 'txt') {
            const text = await file.text();
            const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
            if (!lines.length) return { headers: [], rows: [] };
            const headers = lines[0].split(',').map((h) => h.trim());
            const rows = lines.slice(1).map((ln) => {
              const cols = ln.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map((c) => c.replace(/^\"|\"$/g, '').trim());
              const obj: Record<string, any> = {};
              headers.forEach((h, i) => (obj[h] = cols[i] ?? ''));
              return obj;
            });
            return { headers, rows };
          }
          if (ext === 'xlsx' || ext === 'xls') {
            try {
              const XLSX = await import('xlsx');
              const buffer = await file.arrayBuffer();
              const workbook = XLSX.read(buffer, { type: 'array' });
              const sheet = workbook.Sheets[workbook.SheetNames[0]];
              const json = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[];
              const headers = json.length ? Object.keys(json[0]) : [];
              return { headers, rows: json };
            } catch (err) {
              console.warn('XLSX parse failed', err);
              return { headers: [], rows: [] };
            }
          }
          return { headers: [], rows: [] };
        };

        // map header to recognition metric key when possible
        const ONE_PAGER_KPI_KEYS = [
          'overAll', 'powerRanker1', 'powerRanker2', 'powerRanker3', 'carsVsBudget', 'carsVsComp', 'salesVsBudget', 'salesVsComp',
          'nps', 'emailCollection', 'pmix', 'big4', 'fuelFilters', 'netAro', 'coolants', 'discounts', 'differentials', 'donations'
        ];

        const mapHeaderToMetricKey = (header: string) => {
          if (!header) return undefined;
          const norm = header.toLowerCase().replace(/[^a-z0-9]/g, '');

          // prefer matching against the recognition metrics, but only return keys that appear on the one-pager
          for (const m of RECOGNITION_METRICS) {
            const lab = (m.label ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const key = (m.key ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (norm.includes(lab) || norm.includes(key) || lab.includes(norm) || key.includes(norm)) {
              // map legacy CSI -> NPS for mapper/headers
              const resolved = m.key === 'csi' ? 'nps' : m.key;
              return ONE_PAGER_KPI_KEYS.includes(resolved) ? resolved : undefined;
            }
          }

          // fallback: if header text contains 'nps' prefer nps
          if (norm.includes('nps')) return 'nps';
          return undefined;
        };

        // Handle custom region uploads locally (no server processing) to avoid server-side parser hang.
        if (kind === 'customRegion') {
          try {
            const parsed = await parseFileToRows(file);
            const headers = parsed.headers ?? [];
            const rows = parsed.rows ?? [];

            // Build recognition dataset rows from custom region (shop-level)
            const parsedDataset: RecognitionDatasetRow[] = rows.map((r: Record<string, any>) => {
              const metrics: Record<string, number> = {};
              let shopNumber = Number(r['shop'] ?? r['shop_number'] ?? r['Shop'] ?? r['Shop #'] ?? r['Shop#'] ?? r['store'] ?? r['Store'] ?? r['site'] ?? r['Site'] ?? null) || undefined;
              for (const h of headers) {
                const metricKey = mapHeaderToMetricKey(h);
                const raw = r[h];
                const val = typeof raw === 'string' ? Number(raw.replace(/[^0-9.\-]/g, '')) : Number(raw);
                if (!Number.isFinite(val)) continue;
                if (metricKey) {
                  metrics[metricKey] = val;
                } else {
                  // also add generic metrics under normalized header
                  const n = h.toString().trim();
                  metrics[n] = val;
                }
              }
              return {
                shopNumber: shopNumber ?? 0,
                managerName: '',
                metrics,
              } as any as RecognitionDatasetRow;
            });

            setDataset(parsedDataset);
            const meta: UploadedFileMeta = {
              name: file.name,
              uploadedAt: new Date().toISOString(),
              rows: parsedDataset.length,
            };
            dispatch({ type: 'setUploadMeta', kind, meta });
            setQualifierUploadState((prev) => ({ ...prev, [kind]: 'ready' }));
            setUploadState('ready');
            setStatusMessage(`Processed ${parsedDataset.length} customRegion rows`);
          } catch (error) {
            console.error('Custom region upload handling failed', error);
            setUploadError(error instanceof Error ? error.message : 'Custom region upload failed');
            setQualifierUploadState((prev) => ({ ...prev, [kind]: 'error' }));
          } finally {
            event.target.value = '';
          }
          return;
        }

        // Handle employee uploads locally using the mapper (client-side parsing)
        if (kind === 'employee') {
          try {
            const parsed = await parseFileToRows(file);
            const headers = parsed.headers ?? [];
            const rows = parsed.rows ?? [];

            // load mapper from localStorage (if present)
            let mapper: any = null;
            try {
              const raw = window.localStorage.getItem('pocketmanager-award-mapper');
              if (raw) mapper = JSON.parse(raw);
            } catch (e) {
              // ignore
            }

            const nameCol = mapper?.columns?.employee?.nameCol;
            const shopCol = mapper?.columns?.employee?.shopCol;
            const metricCol = mapper?.columns?.employee?.metricCol;
            const perKpi = mapper?.perKpi ?? {};

            const parsedDataset: RecognitionDatasetRow[] = rows.map((r: Record<string, any>) => {
              const metrics: Record<string, number> = {};
              // detect shop number
              let shopNumber = Number(r[shopCol] ?? r['shop'] ?? r['shop_number'] ?? r['Shop'] ?? r['Store'] ?? null) || undefined;

              // If a single metric column is explicitly mapped, prefer it and use perKpi or header mapping to assign KPI key
              if (metricCol) {
                const raw = r[metricCol];
                const mapped = perKpi?.[metricCol] || mapHeaderToMetricKey(metricCol);
                const key = mapped ?? undefined;
                const val = typeof raw === 'string' ? Number(String(raw).replace(/[^0-9.\-]/g, '')) : Number(raw);
                if (key && Number.isFinite(val)) metrics[key] = val;
              } else {
                for (const h of headers) {
                  if (h === nameCol || h === shopCol) continue;
                  const keyFromPer = perKpi?.[h];
                  const metricKey = keyFromPer || mapHeaderToMetricKey(h);
                  const raw = r[h];
                  const val = typeof raw === 'string' ? Number(String(raw).replace(/[^0-9.\-]/g, '')) : Number(raw);
                  if (!Number.isFinite(val)) continue;
                  if (metricKey) {
                    metrics[metricKey] = val;
                  }
                }
              }

              const employeeName = String(r[nameCol] ?? r['manager'] ?? r['Manager'] ?? r['employee'] ?? r['Employee'] ?? '').trim();

              return {
                shopNumber: shopNumber ?? 0,
                managerName: employeeName,
                metrics,
              } as any as RecognitionDatasetRow;
            });

            setDataset(parsedDataset);
            const meta: UploadedFileMeta = {
              name: file.name,
              uploadedAt: new Date().toISOString(),
              rows: parsedDataset.length,
            };
            dispatch({ type: 'setUploadMeta', kind, meta });
            setQualifierUploadState((prev) => ({ ...prev, [kind]: 'ready' }));
            setUploadState('ready');
            setStatusMessage(`Processed ${parsedDataset.length} employee rows`);
          } catch (error) {
            console.error('Employee upload handling failed', error);
            setUploadError(error instanceof Error ? error.message : 'Employee upload failed');
            setQualifierUploadState((prev) => ({ ...prev, [kind]: 'error' }));
          } finally {
            event.target.value = '';
          }
          return;
        }

        const success = await processUpload({ file, sourceLabel: label });
        if (success) {
          dispatch({ type: "setUploadMeta", kind, meta: { name: file.name, uploadedAt: new Date().toISOString() } });
        }
        event.target.value = "";
      },
    [dispatch, processUpload],
  );

  const handleLoadSample = useCallback(async () => {
    setLastFileName("Mock dataset");
    const success = await processUpload({ sourceLabel: "mock dataset" });
    if (success) {
      const timestamp = new Date().toISOString();
      dispatch({ type: "setUploadMeta", kind: "employee", meta: { name: "Sample Employee Performance", uploadedAt: timestamp } });
      dispatch({ type: "setUploadMeta", kind: "shop", meta: { name: "Sample KPI Workbook", uploadedAt: timestamp } });
    }
  }, [dispatch, processUpload]);

  const handlePeriodInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      dispatch({ type: "setPeriod", value: event.target.value });
    },
    [dispatch],
  );

  const handleQualifierFileChange = useCallback(
    (kind: QualifierUploadKind) =>
      async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
          return;
        }
        setQualifierUploadState((prev) => ({ ...prev, [kind]: "uploading" }));
        try {
          const meta: UploadedFileMeta = {
            name: file.name,
            uploadedAt: new Date().toISOString(),
          };
          dispatch({ type: "setQualifierMeta", kind, meta });
          setQualifierUploadState((prev) => ({ ...prev, [kind]: "ready" }));
        } catch (error) {
          console.error(error);
          setQualifierUploadState((prev) => ({ ...prev, [kind]: "error" }));
        } finally {
          event.target.value = "";
        }
      },
    [dispatch],
  );

  const handleRemoveUpload = useCallback(
    (kind: UploadKind) => {
      dispatch({ type: "setUploadMeta", kind, meta: undefined });
      // also clear any summary/dataset if employee/shop uploads are removed
      if (kind === "employee" || kind === "shop") {
        setSummary(null);
        setAwards([]);
        setDataset([]);
        setActiveRunId(null);
        setUploaderEmail(null);
        setUploadState("idle");
        setStatusMessage("Upload a KPI workbook to calculate captains.");
      }
    },
    [dispatch],
  );

  const handleRemoveQualifier = useCallback(
    (kind: QualifierUploadKind) => {
      dispatch({ type: "setQualifierMeta", kind, meta: undefined });
    },
    [dispatch],
  );

  const handleManualAwardChange = useCallback(
    (entry: ManualAwardEntry) => {
      dispatch({ type: "setManualAward", entry });
    },
    [dispatch],
  );

  const handleConfirmationRowsChange = useCallback(
    (rows: ConfirmationRow[]) => {
      dispatch({ type: "setConfirmations", rows });
    },
    [dispatch],
  );

  const handleAdvanceStep = useCallback(
    (direction: 1 | -1) => {
      const nextIndex = currentStepIndex + direction;
      if (nextIndex < 0 || nextIndex >= AWARD_SHOW_STEPS.length) {
        return;
      }
      setActiveStep(AWARD_SHOW_STEPS[nextIndex].id);
    },
    [currentStepIndex],
  );

  const handleResetDraft = useCallback(() => {
    dispatch({ type: "reset" });
    setSummary(null);
    setAwards([]);
    setDataset([]);
    setExportJobs([]);
    setExportMessage(null);
    setActiveRunId(null);
    setUploaderEmail(null);
    setUploadState("idle");
    setStatusMessage("Upload a KPI workbook to calculate captains.");
    setLastFileName(null);
    setUploadError(null);
    setQualifierUploadState({ powerRanker: "idle", periodWinner: "idle", donations: "idle" });
    setBirthdaysLoading(false);
    setBirthdaysError(null);
    setMetadataStatus("idle");
    setMetadataMessage(null);
  }, [dispatch]);

  useEffect(() => {
    if (hierarchy.hierarchyLoading) {
      return;
    }

    if (!scopeSummary?.scope_level) {
      setBirthdaysLoading(false);
      setBirthdaysError(null);
      dispatch({ type: "setCelebrations", birthdays: [] });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const payload = {
      scopeLevel: scopeSummary.scope_level,
      divisionName: scopeSummary.division_name,
      regionName: scopeSummary.region_name,
      districtName: scopeSummary.district_name,
      shopNumber: scopeSummary.shop_number,
    };

    const run = async () => {
      try {
        setBirthdaysLoading(true);
        setBirthdaysError(null);
        const response = await fetch("/api/recognition/birthdays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const data = (await response.json()) as { entries?: CelebrationEntry[]; error?: string };
        if (!response.ok) {
          throw new Error(data?.error ?? "Unable to load birthdays.");
        }
        if (!cancelled) {
          dispatch({ type: "setCelebrations", birthdays: Array.isArray(data.entries) ? data.entries : [] });
        }
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        console.error(error);
        setBirthdaysError(error instanceof Error ? error.message : "Unable to load birthdays.");
      } finally {
        if (!cancelled) {
          setBirthdaysLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    dispatch,
    hierarchy.hierarchyLoading,
    scopeSummary?.scope_level,
    scopeSummary?.division_name,
    scopeSummary?.region_name,
    scopeSummary?.district_name,
    scopeSummary?.shop_number,
  ]);

  useEffect(() => {
    if (!activeRunId) {
      setMetadataStatus("idle");
      setMetadataMessage(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setMetadataStatus("saving");
        const response = await fetch("/api/recognition/run-metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId: activeRunId, ...metadataPayload }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data?.error ?? "Unable to sync run metadata.");
        }
        if (!cancelled) {
          setMetadataStatus("saved");
          setMetadataMessage("Run metadata synced.");
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setMetadataStatus("error");
          setMetadataMessage(error instanceof Error ? error.message : "Unable to sync run metadata.");
        }
      }
    }, 900);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeRunId, metadataPayload, metadataSignature]);


  const handleExport = async (type: ExportKind) => {
    if (!canQueueExports) {
      setExportMessage("Exports are only available to DM or above scopes.");
      return;
    }

    if (!activeRunId) {
      setExportMessage("Process a KPI upload before exporting.");
      return;
    }

    const endpoint = type === "summary" ? "/api/recognition/export-summary" : "/api/recognition/export-pptx";
    const requestBody = {
      runId: activeRunId,
      manualAwards: sanitizedManualAwards,
      confirmations: sanitizedConfirmations,
      birthdays: sanitizedBirthdays,
    };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = (await response.json()) as ExportResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to queue export");
      }

      const job: RecognitionExportJob = {
        exportId: data.exportId,
        type,
        status: data.status,
        requestedAt: new Date().toISOString(),
        readyAt: data.readyAt,
        downloadUrl: data.downloadUrl,
      };
      setExportJobs((prev) => [job, ...prev].slice(0, 4));
      setExportMessage(type === "summary" ? "Summary export queued" : "PPTX export queued");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Export failed. Try again in a moment.";
      setExportMessage(message);
    }
  };

  const handleRuleInputChange = (ruleId: string, field: "topN" | "minValue", value: number) => {
    setRules((prev) => prev.map((rule) => (rule.id === ruleId ? { ...rule, [field]: value } : rule)));
    setRuleMessage(null);
  };

  const handleResetRules = () => {
    setRules(defaultRules.map((rule) => ({ ...rule })));
    setRuleMessage("Rules reset to defaults");
  };

  const handleSaveRules = () => {
    setRuleMessage("Rules captured for this session.");
  };

  if (hierarchy.needsLogin) {
    return (
      <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-8 text-center text-sm text-slate-300">
        Sign in to load the Recognition Captain workspace.
      </div>
    );
  }

  if (runtimeError) {
    return (
      <div className="rounded-3xl border border-rose-600/40 bg-rose-900/10 p-6">
        <p className="text-sm font-semibold text-rose-300">A client-side error occurred while loading this workspace</p>
        <pre className="mt-3 max-h-40 overflow-auto text-xs text-slate-300">{String(runtimeError)}</pre>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <StepNavigator
        activeStep={activeStep}
        steps={stepsWithStatus}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        onPrev={() => handleAdvanceStep(-1)}
        onNext={() => handleAdvanceStep(1)}
        onStepClick={(id) => setActiveStep(id)}
        onReset={handleResetDraft}
      />

      <StepSection
        id="qualifiers"
        title="Qualifiers & uploads"
        description="Upload Power Ranker + Period Results files to build eligible pools."
        active={activeStep === "qualifiers"}
      >
        <QualifierUploadsPanel
          qualifiers={draft.qualifiers}
          uploadState={qualifierUploadState}
          onFileChange={handleQualifierFileChange}
          onEmployeeFileChange={handleFileChange("employee") as any}
          onShopFileChange={handleFileChange("shop") as any}
          onCustomRegionFileChange={handleFileChange("customRegion") as any}
          thresholds={winnerThresholds}
          onThresholdChange={handleThresholdChange}
          eligibleShops={periodWinnerInsights.eligibleShops}
          eligibleEmployees={periodWinnerInsights.eligibleEmployees}
          shopQualifiers={periodWinnerInsights.shopQualifiers}
          employeeQualifiers={periodWinnerInsights.employeeQualifiers}
          qualifierPreview={qualifierDataset?.[0] ?? null}
          uploads={draft.uploads}
          onRemoveUpload={handleRemoveUpload}
          onRemoveQualifier={handleRemoveQualifier}
        />
      </StepSection>

      {/* Eligible cards moved to the Uploads (tab 2) processing summary */}

      <StepSection
        id="uploads"
        title="Confirm lists and employee names"
        description="Process KPI data to generate awards, leaderboards, and dataset previews."
        active={activeStep === "uploads"}
      >
        <RecognitionUploadPanel
          status={uploadState}
          statusMessage={statusMessage}
          lastFileName={lastFileName}
          runId={activeRunId}
          uploaderEmail={uploaderEmail}
          errorMessage={uploadError}
          periodValue={periodValue}
          onPeriodChange={handlePeriodInputChange}
          onEmployeeFileChange={handleFileChange("employee")}
          onShopFileChange={handleFileChange("shop")}
          onLoadSample={handleLoadSample}
          onProcess={processUpload}
          onOpenQualifiers={() => setActiveStep("qualifiers")}
          uploads={draft.uploads}
        />
        <SummaryPanel
          summary={summary}
          runId={activeRunId}
          periodLabel={periodValue}
          qualifiedShopsCount={qualifiedShops.length}
          qualifiedEmployeesCount={qualifiedEmployees.length}
          winnerThresholds={winnerThresholds}
          getTopEmployeeLeaders={getTopEmployeeLeaders}
          getTopShopLeaders={getTopShopLeaders}
        />
        {awards.length ? <AwardsGrid awards={awards} /> : null}
        {dataset.length ? (
          <>
            <PeriodWinnersSection insights={periodWinnerInsights} />
            <DatasetTable dataset={dataset} />
          </>
        ) : null}
      </StepSection>

      <StepSection
        id="manual-awards"
        title="Manual awards"
        description="Capture DM + RD winners, rationale, and spotlight notes."
        active={activeStep === "manual-awards"}
      >
        {/* Manual award cards removed per request; leaving OnePagerGrid only */}
        <OnePagerGrid
          qualifierPreview={qualifierDataset?.[0] ?? null}
          getTopEmployeeLeaders={getTopEmployeeLeaders}
          getTopShopLeaders={getTopShopLeaders}
          initialConfirmations={draft.confirmations}
          onConfirmationsChange={(rows) => dispatch({ type: 'setConfirmations', rows })}
          fileMapper={fileMapperState}
        />
      </StepSection>

      <StepSection
        id="review"
        title="Review"
        description="Confirm qualifiers, DM notes, and celebrations before exporting."
        active={activeStep === "review"}
      >
        <ReadyChecklistPanel items={readinessChecklist} />
        <MetadataSyncStatus status={metadataStatus} message={metadataMessage} />
        <ConfirmationGridPanel
          manualAwards={draft.manualAwards}
          awards={awards}
          confirmations={draft.confirmations}
          onRowsChange={handleConfirmationRowsChange}
        />
        {anniversaryEntries.length ? <AnniversaryPanel entries={anniversaryEntries} /> : null}
        <BirthdaysPanel entries={draft.birthdays} loading={birthdaysLoading} error={birthdaysError} />
      </StepSection>

      <StepSection
        id="exports"
        title="Generate"
        description="Queue PPTX decks, CSV summaries, and adjust guardrails."
        active={activeStep === "exports"}
      >
        <ExportsPanel
          canQueue={canQueueExports}
          onExport={handleExport}
          exportJobs={exportJobs}
          statusMessage={exportMessage}
          runId={activeRunId}
          uploaderEmail={uploaderEmail}
        />
        <RuleEditorPanel
          rules={rules}
          canEdit={canEditRules}
          onInputChange={handleRuleInputChange}
          onReset={handleResetRules}
          onSave={handleSaveRules}
          message={ruleMessage}
          role={role}
        />
      </StepSection>

      <StepNavigator
        activeStep={activeStep}
        steps={stepsWithStatus}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        onPrev={() => handleAdvanceStep(-1)}
        onNext={() => handleAdvanceStep(1)}
        onStepClick={(id) => setActiveStep(id)}
        onReset={handleResetDraft}
      />
    </div>
  );
}

type EligibleListCardProps = {
  label: string;
  description: string;
  count: number;
  qualifiers: PeriodWinnerQualifier[];
  isActive: boolean;
  onToggle: () => void;
  emptyLabel: string;
};

function EligibleListCard({
  label,
  description,
  count,
  qualifiers,
  isActive,
  onToggle,
  emptyLabel,
}: EligibleListCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{label}</p>
          <p className="text-3xl font-semibold text-white">{count}</p>
          <p className="text-xs text-slate-400">{description}</p>
        </div>
        <span className="rounded-full border border-slate-800/70 p-2 text-slate-400">
          <ChevronDown className={`h-4 w-4 transition ${isActive ? "rotate-180 text-emerald-200" : ""}`} />
        </span>
      </button>
      {isActive ? (
        <div className="mt-3 max-h-72 overflow-y-auto rounded-2xl border border-slate-800/70 bg-slate-950/80">
          {qualifiers.length ? (
            <ul className="divide-y divide-slate-800/60">
              {qualifiers.map((qualifier) => (
                <li key={qualifier.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{qualifier.title}</p>
                    <p className="text-xs text-slate-400">{qualifier.detailLine}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-4">
                    {qualifier.metrics.map((metric) => (
                      <div key={`${qualifier.id}-${metric.label}`} className="text-right">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">{metric.label}</p>
                        <p className="text-sm font-semibold text-emerald-200">{metric.value}</p>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-xs text-slate-400">{emptyLabel}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CompactEligibleCard({ label, count, hint }: { label: string; count: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 px-4 py-3 text-sm w-48">
      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{count}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

function RecognitionUploadPanel({
  status,
  statusMessage,
  lastFileName,
  runId,
  uploaderEmail,
  errorMessage,
  periodValue,
  onPeriodChange,
  onEmployeeFileChange,
  onShopFileChange,
  onLoadSample,
  onProcess,
  onOpenQualifiers,
  uploads,
}: {
  status: ProcessingState;
  statusMessage: string;
  lastFileName: string | null;
  runId: string | null;
  uploaderEmail: string | null;
  errorMessage: string | null;
  periodValue: string;
  onPeriodChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onEmployeeFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onShopFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onLoadSample: () => Promise<void>;
  onProcess: () => Promise<boolean>;
  onOpenQualifiers?: () => void;
  uploads: AwardShowRunDraft["uploads"];
}) {
  return (
    <section className="rounded-3xl border border-slate-900/70 bg-slate-950/80 p-6 shadow-2xl shadow-black/30">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Upload KPI workbooks</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Employee performance upload</h3>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Reporting period
            <input
              type="text"
              value={periodValue}
              onChange={onPeriodChange}
              placeholder="e.g., P10 2025"
              className="mt-1 w-full rounded-2xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-white"
            />
            <span className="text-[11px] normal-case tracking-normal text-slate-500">Optional label applied to both uploads.</span>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onProcess()}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/60 bg-emerald-600/20 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-40"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Process uploaded files
            </button>
            <button
              type="button"
              onClick={onLoadSample}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-400/60"
            >
              <Sparkles className="h-4 w-4" />
              Load sample data
            </button>
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <UploadMetaCard label="Employee performance" meta={uploads.employee} />
        <UploadMetaCard label="Shop KPI" meta={uploads.shop} />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-dashed border-slate-800/70 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Employee file</p>
              <p className="text-sm text-slate-300">Drop the Employee Performance report (hire date, NPS, oil changes).</p>
            </div>
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenQualifiers?.()}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-700/70 px-4 py-2 text-sm font-semibold text-slate-200"
              >
                <ArrowUp className="h-4 w-4" />
                Manage in qualifiers
              </button>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
            <p className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${statusBadgeClassMap[status]}`}>
              {status === "uploading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />} {status.toUpperCase()}
            </p>
            <p className="mt-2 text-sm text-white">{statusMessage}</p>
            {lastFileName ? <p className="text-xs text-slate-400">Last file: {lastFileName}</p> : null}
            {runId ? <p className="text-xs text-slate-500">Active run: {runId}</p> : null}
            {uploaderEmail ? <p className="text-xs text-emerald-200">Uploader: {uploaderEmail}</p> : null}
            {errorMessage ? <p className="text-xs text-rose-300">{errorMessage}</p> : null}
            <p className="mt-3 text-xs text-slate-400">Note: Upload KPI files from the <strong>Qualifiers & uploads</strong> tab above. This panel processes those files into awards and leaderboards.</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-5 text-sm text-slate-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Shop KPI upload</p>
              <p className="text-sm text-slate-300">Use the KPI export with Shop #, manager, cars, ticket, and CSI.</p>
            </div>
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenQualifiers?.()}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-700/70 px-4 py-2 text-sm font-semibold text-slate-200"
              >
                <ArrowUp className="h-4 w-4" />
                Manage in qualifiers
              </button>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Parser checklist</p>
            <ul className="mt-3 space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                Include headers: Shop #, Manager, Cars (Oil Changes), Growth %, Ticket, CSI, Retention, Safety.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                District + region columns help the exports build context slides.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                Keep one reporting period per upload so deltas stay accurate.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function UploadMetaCard({ label, meta }: { label: string; meta?: UploadedFileMeta }) {
  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{label}</p>
      {meta ? (
        <div className="mt-2 text-sm text-slate-200">
          <p className="font-semibold">{meta.name}</p>
          <p className="text-xs text-slate-400">Uploaded {new Date(meta.uploadedAt).toLocaleString()}</p>
          {meta.rows ? <p className="text-xs text-slate-500">Rows parsed: {meta.rows.toLocaleString()}</p> : null}
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500">No upload captured yet.</p>
      )}
    </div>
  );
}

function QualifierUploadsPanel({
  qualifiers,
  uploadState,
  onFileChange,
  onEmployeeFileChange,
  onShopFileChange,
  onCustomRegionFileChange,
  onRemoveUpload,
  onRemoveQualifier,
  thresholds,
  onThresholdChange,
  eligibleShops,
  eligibleEmployees,
  shopQualifiers,
  employeeQualifiers,
  uploads,
  qualifierPreview,
}: {
  qualifiers: QualifierUploadResult | null;
  uploadState: Record<QualifierUploadKind, ProcessingState>;
  onFileChange: (kind: QualifierUploadKind) => (event: ChangeEvent<HTMLInputElement>) => void;
  onEmployeeFileChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onShopFileChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onCustomRegionFileChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveUpload?: (kind: UploadKind) => void;
  onRemoveQualifier?: (kind: QualifierUploadKind) => void;
  thresholds: PeriodWinnerThresholds;
  onThresholdChange: (key: keyof PeriodWinnerThresholds, value: number) => void;
  eligibleShops: number;
  eligibleEmployees: number;
  shopQualifiers: PeriodWinnerQualifier[];
  employeeQualifiers: PeriodWinnerQualifier[];
  uploads?: { employee?: UploadedFileMeta; shop?: UploadedFileMeta; customRegion?: UploadedFileMeta };
  qualifierPreview?: RecognitionDatasetRow | null;
  
}) {
  const [activeList, setActiveList] = useState<"shops" | "employees" | null>(null);
  const cards: Array<{ kind: QualifierUploadKind; title: string; description?: string; helper: string }> = [
    {
      kind: "powerRanker",
      title: "Upload Power Ranker report",
      helper: "Include region, district, shop number, and rank columns.",
    },
    {
      kind: "periodWinner",
      title: "Period Results",
      description: "Upload Region Ranking Qlik report.",
      helper: "Cars + sales + email % help the confirmation grid.",
    },
  ];
  const fields: { key: keyof PeriodWinnerThresholds; label: string; suffix?: string }[] = [
    { key: "minOilChanges", label: "Min oil changes", suffix: "cars" },
    { key: "npsQualifier", label: "NPS qualifier", suffix: "%" },
  ];
  
  // Column mapper pill
  // qualifierPreview provides a sample row to derive available column keys for mapping
  
  const metaByKind: Partial<Record<QualifierUploadKind, UploadedFileMeta | undefined>> = {
    powerRanker: qualifiers?.powerRanker,
    periodWinner: qualifiers?.periodWinner,
    donations: qualifiers?.donations,
  };
  const toggleList = (panel: "shops" | "employees") => {
    setActiveList((prev) => (prev === panel ? null : panel));
  };

  return (
    <section className="rounded-3xl border border-slate-900/70 bg-slate-950/70 p-6">
      <div className="gap-4 lg:flex lg:items-start lg:justify-between">
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-[0.4em] text-slate-500">Qualifier uploads</p>
          <h3 className="text-2xl font-semibold text-white">Step1 set qualifiers / upload Qlik Docs</h3>
          <p className="text-sm text-slate-300">Sheets needed from Qlik for the period: EPR report, NPS, Custom Region, Donations, Power Ranker. Have these files ready to be uploaded to create your period rankings show.</p>

          <div className="mt-4">
            <div className="space-y-3">
              {fields.map((field) => (
                <label key={field.key} className="block text-xs uppercase tracking-[0.3em] text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className="min-w-[110px]">{field.label}</span>
                    <input
                      type="number"
                      min={0}
                      value={thresholds[field.key]}
                      onChange={(event) => onThresholdChange(field.key, Number(event.target.value))}
                      className="w-20 rounded-2xl border border-slate-800/70 bg-slate-950/60 px-2 py-1 text-sm text-white"
                    />
                    {field.suffix ? <span className="text-xs text-slate-500">{field.suffix}</span> : null}
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Upload boxes moved under the qualifier uploads section in a 2x3 grid */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
          {([
            { key: "employee", label: "Employee performance report", meta: uploads?.employee, onChange: onEmployeeFileChange },
            { key: "shop", label: "Shop KPI", meta: uploads?.shop, onChange: onShopFileChange },
            { key: "customRegion", label: "Custom Region Report", meta: uploads?.customRegion, onChange: onCustomRegionFileChange },
            { key: "powerRanker", label: "Power Ranker", meta: metaByKind.powerRanker, onChange: onFileChange("powerRanker") },
            { key: "donations", label: "Donations", meta: metaByKind.donations, onChange: onFileChange("donations") },
            { key: "nps", label: "NPS", meta: metaByKind.periodWinner, onChange: onFileChange("periodWinner") },
          ] as Array<{ key: string; label: string; meta?: UploadedFileMeta; onChange?: (e: any) => void }>).map((item) => {
            const handleRemove = () => {
              if (item.key === "employee" || item.key === "customRegion" || item.key === "shop") {
                onRemoveUpload?.(item.key as UploadKind);
              } else if (item.key === "powerRanker" || item.key === "donations" || item.key === "nps") {
                const qKind: QualifierUploadKind = item.key === "nps" ? "periodWinner" : (item.key as QualifierUploadKind);
                onRemoveQualifier?.(qKind);
              }
            };

            return (
              <div key={item.key} className="rounded-lg border border-slate-800/60 bg-slate-950/60 p-3 text-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{item.label}</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-700/60 px-2 py-1 text-xs font-semibold text-slate-200">
                    <Paperclip className="h-4 w-4" />
                    <input type="file" accept=".csv,.xlsx,.xls" className="sr-only" onChange={item.onChange} />
                  </label>
                  <div className="text-xs text-slate-300 flex items-center gap-3">
                    <div>
                      <div className="font-medium text-slate-200">{item.meta?.name ?? "No file"}</div>
                      {item.meta?.uploadedAt ? <div className="text-xs text-slate-400">Uploaded {new Date(item.meta.uploadedAt).toLocaleString()}</div> : null}
                    </div>
                    {item.meta ? (
                      <button
                        type="button"
                        onClick={handleRemove}
                        aria-label={`Remove ${item.label}`}
                        className="rounded-full border border-slate-700/60 px-2 py-1 text-xs text-rose-300 hover:bg-rose-900/10"
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const MANUAL_AWARD_TEMPLATES: Array<{ id: string; title: string; level: "DM" | "RD"; description: string }> = [
  { id: "dm-employee-of-period", title: "Employee of the Period", level: "DM", description: "Top-performing manager across KPIs." },
  { id: "dm-rising-star", title: "Rising Star", level: "DM", description: "Fast-climbing leader with strong NPS." },
  { id: "rd-spotlight", title: "Regional Spotlight", level: "RD", description: "RD highlight with culture or community impact." },
];

function ManualAwardsPanel({
  manualAwards,
  onEntryChange,
  uploaderEmail,
}: {
  manualAwards: ManualAwardEntry[];
  onEntryChange: (entry: ManualAwardEntry) => void;
  uploaderEmail: string | null;
}) {
  return (
    <section className="rounded-3xl border border-slate-900/70 bg-slate-950/70 p-6">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-[0.4em] text-slate-500">DM & RD selections</p>
        <h3 className="text-2xl font-semibold text-white">Manual awards</h3>
        <p className="text-sm text-slate-300">Capture spotlight stories and overrides alongside the automated winners.</p>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {MANUAL_AWARD_TEMPLATES.map((template) => {
          const existing = manualAwards.find((entry) => entry.id === template.id);
          const entry: ManualAwardEntry = existing ?? {
            id: template.id,
            title: template.title,
            level: template.level,
            winnerName: "",
            rationale: "",
            createdAt: new Date().toISOString(),
            createdBy: uploaderEmail ?? undefined,
          };

          return (
            <div key={template.id} className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{template.level} award</p>
              <div className="mt-1 flex items-center justify-between">
                <p className="text-lg font-semibold text-white">{template.title}</p>
                <span className="rounded-full border border-slate-800/70 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-slate-400">
                  {entry.winnerName ? "Captured" : "Pending"}
                </span>
              </div>
              <p className="text-sm text-slate-400">{template.description}</p>
              <div className="mt-4 space-y-3">
                <label className="block text-xs uppercase tracking-[0.3em] text-slate-400">
                  Winner name
                  <input
                    type="text"
                    value={entry.winnerName}
                    onChange={(event) => onEntryChange({ ...entry, winnerName: event.target.value })}
                    className="mt-1 w-full rounded-2xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="block text-xs uppercase tracking-[0.3em] text-slate-400">
                  Shop # (optional)
                  <input
                    type="number"
                    value={entry.winnerShop ?? ""}
                    onChange={(event) =>
                      onEntryChange({
                        ...entry,
                        winnerShop: event.target.value ? Number(event.target.value) : undefined,
                      })
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="block text-xs uppercase tracking-[0.3em] text-slate-400">
                  Rationale
                  <textarea
                    value={entry.rationale}
                    onChange={(event) => onEntryChange({ ...entry, rationale: event.target.value })}
                    rows={3}
                    className="mt-1 w-full rounded-2xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

type ReadyChecklistItem = {
  id: string;
  label: string;
  helper: string;
  complete: boolean;
};

function ReadyChecklistPanel({ items }: { items: ReadyChecklistItem[] }) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-slate-900/70 bg-slate-950/70 p-5">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-[0.4em] text-slate-500">Run readiness</p>
        <h3 className="text-2xl font-semibold text-white">Pre-export checklist</h3>
        <p className="text-sm text-slate-300">Make sure each stage lands before sending decks downstream.</p>
      </div>
      <div className="mt-5">
        <p className="text-sm text-slate-300">File uploads (Employee & Shop KPI) are managed in <strong>Step1 set qualifiers / upload Qlik Docs</strong>. Use that tab to drop your Employee Performance, Shop KPI, NPS, Custom Region, Donations and Power Ranker files. Once uploaded there, come back to this panel to process and create the period rankings show.</p>
      </div>
    </section>
  );
}

function ConfirmationGridPanel({
  manualAwards,
  awards,
  confirmations,
  onRowsChange,
}: {
  manualAwards: ManualAwardEntry[];
  awards: RecognitionAwardResult[];
  confirmations: ConfirmationRow[];
  onRowsChange: (rows: ConfirmationRow[]) => void;
}) {
  const manualRows = (manualAwards ?? []).map((entry) => ({
    id: `manual-${entry.id}`,
    awardId: entry.id,
    level: entry.level ?? "Manual",
    awardLabel: entry.title ?? entry.title,
    winnerName: entry.winnerName ?? "",
    shopNumber: entry.winnerShop,
    shopLabel: entry.winnerShop ? String(entry.winnerShop) : undefined,
    metricKey: undefined,
  }));

  // Flatten server awards (each award can have multiple winners) into rows
  const autoRows = (awards ?? []).flatMap((a) => {
    const awardId = (a as any).awardId ?? (a as any).id ?? "";
    const awardLabel = (a as any).awardLabel ?? (a as any).label ?? "";
    const winners = (a as any).winners ?? [];
    return winners.map((w: any, idx: number) => ({
      id: `award-${awardId}-${w.shopNumber ?? idx}`,
      awardId,
      level: "Auto" as const,
      awardLabel,
      winnerName: w.managerName ?? w.winnerName ?? "",
      shopNumber: w.shopNumber,
      shopLabel: w.shopName ? String(w.shopName) : w.shopNumber ? String(w.shopNumber) : undefined,
      metricKey: w.metricKey,
    }));
  });

  const baseRows = [...manualRows, ...autoRows];
  const confirmationMap = new Map(confirmations.map((row) => [row.id, row]));
  const rows = baseRows.map((row) => {
    const stored = confirmationMap.get(row.id);
    return {
      ...row,
      dmNote: stored?.dmNote ?? "",
      rdNote: stored?.rdNote ?? "",
    } satisfies ConfirmationRow & { dmNote: string; rdNote: string };
  });

  const handleNoteChange = (rowId: string, field: "dmNote" | "rdNote", value: string) => {
    const base = baseRows.find((row) => row.id === rowId);
    if (!base) {
      return;
    }
    const existing = confirmationMap.get(rowId);
    const nextRow: ConfirmationRow = {
      ...base,
      dmNote: field === "dmNote" ? value : existing?.dmNote,
      rdNote: field === "rdNote" ? value : existing?.rdNote,
    };
    const filtered = confirmations.filter((row) => row.id !== rowId);
    onRowsChange([...filtered, nextRow]);
  };

  return (
    <section className="rounded-3xl border border-slate-900/70 bg-slate-950/70 p-6">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-[0.4em] text-slate-500">Confirmation grid</p>
        <h3 className="text-2xl font-semibold text-white">Awards + overrides</h3>
        <p className="text-sm text-slate-300">Capture DM/RD context before exporting decks.</p>
      </div>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-900/70">
        <table className="min-w-[960px] w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-900/80 text-xs uppercase tracking-[0.3em] text-slate-400">
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Award</th>
              <th className="px-4 py-3">Winner</th>
              <th className="px-4 py-3">Shop</th>
              <th className="px-4 py-3">Metric</th>
              <th className="px-4 py-3">DM note</th>
              <th className="px-4 py-3">RD note</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => {
                const metricLabel = row.metricKey ? RECOGNITION_METRIC_LOOKUP[row.metricKey]?.label ?? row.metricKey : "—";
                return (
                  <tr key={row.id} className="border-t border-slate-900/60 text-slate-200">
                    <td className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">{row.level}</td>
                    <td className="px-4 py-3 font-semibold text-white">{row.awardLabel}</td>
                    <td className="px-4 py-3">{row.winnerName}</td>
                    <td className="px-4 py-3">{row.shopLabel ?? "—"}</td>
                    <td className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">{metricLabel}</td>
                    <td className="px-4 py-3">
                      <textarea
                        value={row.dmNote ?? ""}
                        onChange={(event) => handleNoteChange(row.id, "dmNote", event.target.value)}
                        rows={2}
                        className="w-full rounded-2xl border border-slate-800/70 bg-slate-950/60 p-2 text-sm text-white"
                        placeholder="DM callout"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <textarea
                        value={row.rdNote ?? ""}
                        onChange={(event) => handleNoteChange(row.id, "rdNote", event.target.value)}
                        rows={2}
                        className="w-full rounded-2xl border border-slate-800/70 bg-slate-950/60 p-2 text-sm text-white"
                        placeholder="RD callout"
                      />
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-4 py-4 text-center text-xs text-slate-500" colSpan={7}>
                  Capture manual awards or process a KPI upload to populate this table.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type StepperProps = {
  steps: Array<AwardShowStep & { status: StepStatus }>;
  onStepChange: (stepId: AwardShowStepId) => void;
  onResetDraft: () => void;
};

function AwardShowsStepper({ steps, onStepChange, onResetDraft }: StepperProps) {
  return (
    <section className="rounded-3xl border border-slate-900/70 bg-slate-950/80 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.4em] text-slate-500">Award Shows workflow</p>
          <h3 className="text-2xl font-semibold text-white">Recognition Captain stepper</h3>
          <p className="text-sm text-slate-300">Track progress as you move from qualifiers to exports.</p>
        </div>
        <button
          type="button"
          onClick={onResetDraft}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-700/70 px-4 py-2 text-sm font-semibold text-slate-200"
        >
          Reset workspace
        </button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-5">
        {steps.map((step) => (
          <button
            type="button"
            key={step.id}
            onClick={() => onStepChange(step.id)}
            className={`rounded-2xl border px-3 py-3 text-left transition ${
              step.status === "current"
                ? "border-emerald-400/60 bg-emerald-600/10"
                : step.status === "complete"
                  ? "border-slate-700/70 bg-slate-900/60"
                  : "border-dashed border-slate-800/60 bg-slate-950/40"
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <step.icon className="h-4 w-4 text-emerald-200" />
              {step.label}
            </div>
            <p className="text-xs text-slate-400">{step.description}</p>
            <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-slate-500">{step.status}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function StepSection({
  id,
  title,
  description,
  active,
  children,
}: {
  id: string;
  title: string;
  description: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-hidden={!active} className={active ? "space-y-4" : "hidden"}>
      <div className="flex flex-col gap-1">
        <p className="text-[11px] uppercase tracking-[0.4em] text-slate-500">{title}</p>
        <p className="text-sm text-slate-300">{description}</p>
      </div>
      {children}
    </section>
  );
}

function StepNavigator({
  activeStep,
  steps,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  onStepClick,
  onReset,
}: {
  activeStep: AwardShowStepId;
  steps: Array<AwardShowStep & { status?: StepStatus }>;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onStepClick?: (id: AwardShowStepId) => void;
  onReset?: () => void;
}) {
  const total = steps.length || 1;
  const completeCount = steps.filter((s) => s.status === "complete").length;
  const pct = Math.round((completeCount / total) * 100);

  return (
    <div className="w-full">
      {/* Thin banner row: left label + right progress + reset pill */}
      <div className="mb-3 flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-900/70 bg-slate-950/60 p-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.4em] text-slate-500">Award Shows workflow</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <div className="mt-0 w-56">
              <div className="h-2 w-full rounded-full bg-slate-900/50">
                <div className={`h-2 rounded-full bg-emerald-500`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-400">{completeCount}/{total} stages complete · {pct}%</p>
            </div>
          </div>
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700/70 px-3 py-1 text-sm font-semibold text-slate-200"
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>

      {/* Numbered step badges row */}
      <div className="flex w-full items-center gap-3 overflow-auto">
          {steps.map((step, idx) => {
          const isActive = step.id === activeStep;
          // Color by status: complete = green, upcoming = red, current = primary (sky)
          // Use only green (complete/current) or red (upcoming) per request
          const statusColor = step.status === "upcoming" ? "from-rose-500 to-rose-700 border-rose-400/60" : "from-emerald-500 to-emerald-700 border-emerald-400/60";
          const badgeClasses = isActive
            ? `ring-2 ring-white/10 ${statusColor} text-white`
            : `${statusColor} text-white border-slate-800/50`;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepClick?.(step.id)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:opacity-90 ${isActive ? "bg-gradient-to-br" : "bg-transparent"}`}
              aria-current={isActive}
            >
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${badgeClasses} font-semibold`}
              >
                {idx + 1}
              </span>
              <div className="text-left">
                <div className={`text-xs ${isActive ? "text-white font-semibold" : "text-slate-300"}`}>{step.label}</div>
              </div>
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={!canGoPrev}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-700/70 px-3 py-1 font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!canGoNext}
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/60 bg-emerald-600/20 px-3 py-1 font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function MetadataSyncStatus({ status, message }: { status: MetadataStatus; message: string | null }) {
  const labelMap: Record<MetadataStatus, string> = {
    idle: "Idle",
    saving: "Syncing run metadata…",
    saved: "Synced to Supabase",
    error: "Needs attention",
  };
  const badgeClass =
    status === "saved"
      ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
      : status === "saving"
        ? "border-amber-400/60 bg-amber-500/10 text-amber-100"
        : status === "error"
          ? "border-rose-400/60 bg-rose-500/10 text-rose-100"
          : "border-slate-700/60 bg-slate-900/40 text-slate-200";

  return (
    <section className="rounded-3xl border border-slate-900/70 bg-slate-950/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.4em] text-slate-500">Run metadata</p>
          <h3 className="text-xl font-semibold text-white">Metadata sync status</h3>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${badgeClass}`}>
          {labelMap[status]}
        </span>
      </div>
      {message ? <p className="mt-3 text-sm text-slate-300">{message}</p> : null}
    </section>
  );
}

function SummaryPanel({
  summary,
  runId,
  periodLabel,
  qualifiedShopsCount,
  qualifiedEmployeesCount,
  winnerThresholds,
  getTopEmployeeLeaders,
  getTopShopLeaders,
}: {
  summary?: RecognitionProcessingSummary | null;
  runId: string | null;
  periodLabel?: string;
  qualifiedShopsCount: number;
  qualifiedEmployeesCount: number;
  winnerThresholds: PeriodWinnerThresholds;
  getTopEmployeeLeaders?: (metricKey: string, limit?: number) => RecognitionDatasetRow[];
  getTopShopLeaders?: (metricKey: string, limit?: number) => RecognitionDatasetRow[];
}) {
  const rowsProcessed = summary?.rowCount ? summary.rowCount.toLocaleString("en-US") : "—";
  const medianCars = summary?.medianCarCount ? summary.medianCarCount.toLocaleString("en-US") : "—";
  const avgTicket = summary ? formatRecognitionMetricValue("ticket", summary.averageTicket) : "—";
  const reportingPeriod = summary?.reportingPeriod ?? periodLabel ?? "Period";

  const cards = [
    { label: "Rows processed", value: rowsProcessed, icon: Table },
    { label: "Median car count", value: medianCars, icon: ShieldCheck },
    { label: "Avg. ticket", value: avgTicket, icon: NotebookPen },
  ];

  return (
    <section className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Processing summary</p>
            <h3 className="mt-1 text-2xl font-semibold text-white">{reportingPeriod}</h3>
            <p className="text-sm text-slate-400">Source: {summary?.dataSource ?? "N/A"}</p>
            <div className="mt-2 text-xs text-slate-500">
              <p>Run ID: {runId ?? "n/a"}</p>
              <p>Processed by: {summary?.processedBy ?? "Recognition Captain"}</p>
              {summary?.processedAt ? <p>Processed at: {new Date(summary.processedAt).toLocaleString()}</p> : null}
            </div>
          </div>
          <div className="grid flex-1 gap-3 sm:grid-cols-3">
            {cards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-slate-800/70 bg-slate-950/70 p-3">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{card.label}</p>
                <div className="mt-2 flex items-center gap-2">
                  <card.icon className="h-4 w-4 text-emerald-200" />
                  <p className="text-xl font-semibold text-white">{card.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-start gap-4">
          <CompactEligibleCard label="Eligible shops" count={qualifiedShopsCount} hint={`Period Results · ${winnerThresholds.npsQualifier}%+ NPS`} />
          <CompactEligibleCard label="Eligible employees" count={qualifiedEmployeesCount} hint={`NPS qualifier + oil change floors`} />
        </div>
        {getTopEmployeeLeaders && getTopShopLeaders ? (
          <div className="mt-4">
            <CompactKpiLeaders getTopEmployeeLeaders={getTopEmployeeLeaders} getTopShopLeaders={getTopShopLeaders} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function AwardsGrid({ awards }: { awards: RecognitionAwardResult[] }) {
  const awardMap = Object.fromEntries(awards.map((award) => [award.awardId, award]));
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-[0.4em] text-slate-500">Leaderboards</p>
        <h3 className="text-2xl font-semibold text-white">Captain award decks</h3>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {RECOGNITION_AWARD_CONFIG.map((config) => {
          const result = awardMap[config.id];
          const Icon = ICON_MAP[config.icon] ?? BadgeCheck;
          return (
            <div
              key={config.id}
              className={`rounded-3xl border border-white/5 bg-gradient-to-br ${config.colorToken} p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)]`}
            >
              <div className="flex items-center gap-3">
                <span className="rounded-2xl border border-white/30 bg-white/10 p-2 text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/70">{config.label}</p>
                  <p className="text-sm text-white/80">{config.description}</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-white/90">
                {result?.winners?.length ? (
                  result.winners.map((winner) => (
                    <li key={`${config.id}-${winner.shopNumber}`} className="flex items-center justify-between rounded-2xl border border-white/15 bg-black/20 px-3 py-2">
                      <div>
                        <p className="text-base font-semibold text-white">
                          #{winner.rank} · {winner.shopName}
                        </p>
                        <p className="text-xs text-white/80">
                          {winner.managerName} · {winner.districtName}
                        </p>
                      </div>
                      <div className="text-right text-sm font-semibold">
                        {formatRecognitionMetricValue(winner.metricKey, winner.metricValue)}
                        {winner.deltaMetricKey && typeof winner.deltaMetricValue === "number" ? (
                          <p className="text-[11px] font-normal uppercase tracking-[0.3em] text-white/70">
                            Δ {formatRecognitionMetricValue(winner.deltaMetricKey, winner.deltaMetricValue)}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/80">Upload data to populate this leaderboard.</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DatasetTable({ dataset }: { dataset: RecognitionDatasetRow[] }) {
  return (
    <section className="rounded-3xl border border-slate-900/70 bg-slate-950/80 p-6 shadow-2xl shadow-black/30">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-[0.4em] text-slate-500">Raw dataset</p>
        <h3 className="text-2xl font-semibold text-white">All shops and metrics</h3>
        <p className="text-sm text-slate-300">Use the table below to audit data quality before exporting decks.</p>
      </div>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-900/70">
        <table className="min-w-[900px] w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-900/80 text-xs uppercase tracking-[0.3em] text-slate-400">
              <th className="px-4 py-3">Shop</th>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3">District</th>
              <th className="px-4 py-3">Region</th>
              {RECOGNITION_METRICS.map((metric) => (
                <th key={metric.key} className="px-4 py-3">
                  {metric.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataset.map((row) => (
              <tr key={row.shopNumber} className="border-t border-slate-900/60 text-slate-200">
                <td className="px-4 py-3 font-semibold text-white">{row.shopNumber}</td>
                <td className="px-4 py-3">{row.managerName}</td>
                <td className="px-4 py-3">{row.districtName}</td>
                <td className="px-4 py-3">{row.regionName}</td>
                {RECOGNITION_METRICS.map((metric) => (
                  <td key={`${row.shopNumber}-${metric.key}`} className="px-4 py-3 text-right font-mono text-xs text-slate-300">
                    {formatRecognitionMetricValue(metric.key, row.metrics[metric.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ExportsPanel({
  canQueue,
  onExport,
  exportJobs,
  statusMessage,
  runId,
  uploaderEmail,
}: {
  canQueue: boolean;
  onExport: (kind: ExportKind) => Promise<void>;
  exportJobs: RecognitionExportJob[];
  statusMessage: string | null;
  runId: string | null;
  uploaderEmail: string | null;
}) {
  const exportsDisabled = !canQueue || !runId;
  const disabledReason = !canQueue
    ? "Exports restricted to current role scope."
    : "Process a KPI upload to enable exports.";

  return (
    <section className="rounded-3xl border border-slate-900/70 bg-slate-950/70 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Exports</p>
          <h3 className="text-2xl font-semibold text-white">Summary & PPT decks</h3>
          <p className="text-sm text-slate-300">Queue CSV summary tables or auto-generated PPTX award decks.</p>
          <p className="text-xs text-slate-500">
            Active run: {runId ?? "None"}
            {uploaderEmail ? ` · minted by ${uploaderEmail}` : ""}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onExport("summary")}
            disabled={exportsDisabled}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-700/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            CSV summary
          </button>
          <button
            type="button"
            onClick={() => onExport("pptx")}
            disabled={exportsDisabled}
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/60 bg-emerald-600/20 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <NotebookPen className="h-4 w-4" />
            PPTX deck
          </button>
        </div>
      </div>
      {statusMessage ? <p className="mt-3 text-sm text-slate-300">{statusMessage}</p> : null}
      {exportsDisabled ? <p className="mt-2 text-xs text-amber-300">{disabledReason}</p> : null}
      <div className="mt-4 space-y-2 text-sm text-slate-300">
        {exportJobs.length === 0 ? (
          <p className="flex items-center gap-2 text-xs text-slate-400">
            <CircleAlert className="h-4 w-4 text-amber-300" /> No exports queued yet.
          </p>
        ) : (
          exportJobs.map((job) => (
            <div key={job.exportId} className="flex items-center justify-between rounded-2xl border border-slate-800/70 bg-slate-900/60 px-3 py-2">
              <div>
                <p className="text-white">
                  {job.type === "summary" ? "CSV Summary" : "PPTX Deck"} · {job.status}
                </p>
                <p className="text-xs text-slate-400">
                  Requested {new Date(job.requestedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="text-right">
                {job.downloadUrl ? (
                  <a
                    href={job.downloadUrl}
                    className="text-sm font-semibold text-emerald-200 underline-offset-4 hover:underline"
                  >
                    Download
                  </a>
                ) : (
                  <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function RuleEditorPanel({
  rules,
  canEdit,
  onInputChange,
  onReset,
  onSave,
  message,
  role,
}: {
  rules: RecognitionRuleDraft[];
  canEdit: boolean;
  onInputChange: (ruleId: string, field: "topN" | "minValue", value: number) => void;
  onReset: () => void;
  onSave: () => void;
  message: string | null;
  role: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-900/70 bg-slate-950/80 p-6">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-[0.4em] text-slate-500">Rule editor</p>
        <h3 className="text-2xl font-semibold text-white">Award guardrails</h3>
        <p className="text-sm text-slate-300">
          Adjust minimum thresholds, qualifier values, and winner counts before exporting. Only RD/Admin scopes can edit.
        </p>
      </div>
      {!canEdit ? (
        <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Editing locked. Current role: {role.toUpperCase()}.
          </p>
          <p className="text-xs text-amber-200">Ask an administrator to update the captain thresholds.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-white">{rule.label}</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Winners
                    <input
                      type="number"
                      min={1}
                      value={rule.topN}
                      disabled={!canEdit}
                      onChange={(event) => onInputChange(rule.id, "topN", Number(event.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Min value
                    <input
                      type="number"
                      value={rule.minValue ?? 0}
                      disabled={!canEdit}
                      onChange={(event) => onInputChange(rule.id, "minValue", Number(event.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Direction
                    <input
                      type="text"
                      value={rule.direction}
                      disabled
                      className="mt-1 w-full rounded-xl border border-slate-800/70 bg-slate-900/50 px-3 py-2 text-sm text-slate-400"
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={!canEdit}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/60 bg-emerald-600/20 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" /> Save rules
            </button>
            <button
              type="button"
              onClick={onReset}
              disabled={!canEdit}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700/70 px-4 py-2 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset defaults
            </button>
            {message ? <p className="text-sm text-slate-300">{message}</p> : null}
          </div>
        </div>
      )}
    </section>
  );
}

type PeriodWinnerThresholds = {
  minOilChanges: number;
  npsQualifier: number;
};

type PeriodWinnerEntry = {
  id: string;
  rank: number;
  displayName: string;
  detailLine: string;
  metricFormatted: string;
  metricValue: number | null;
  npsFormatted: string;
  npsValue: number | null;
  surveyCount: number;
};

type PeriodWinnerLeaderboard = {
  metricKey: string;
  metricLabel: string;
  winners: PeriodWinnerEntry[];
};

type PeriodWinnerQualifier = {
  id: string;
  title: string;
  detailLine: string;
  metrics: Array<{ label: string; value: string }>;
};

type PeriodWinnerInsights = {
  eligibleShops: number;
  eligibleEmployees: number;
  shopLeaderboards: PeriodWinnerLeaderboard[];
  employeeLeaderboards: PeriodWinnerLeaderboard[];
  shopQualifiers: PeriodWinnerQualifier[];
  employeeQualifiers: PeriodWinnerQualifier[];
};

type PeriodWinnersSectionProps = {
  insights: PeriodWinnerInsights;
};

function PeriodWinnersSection({ insights }: PeriodWinnersSectionProps) {
  return (
    <section className="rounded-3xl border border-slate-900/70 bg-slate-950/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
      <div className="space-y-6">
        <WinnerBoard
          title="Shop winners"
          subtitle={`${insights.eligibleShops} shops clear the floor`}
          boards={insights.shopLeaderboards}
          emptyLabel="Upload KPI data that meets the car count + NPS minimums to populate shop winners."
        />
        <WinnerBoard
          title="Employee winners"
          subtitle={`${insights.eligibleEmployees} managers clear the floor`}
          boards={insights.employeeLeaderboards}
          emptyLabel="Managers need 80%+ NPS and 100 oil changes to appear here."
        />
      </div>
    </section>
  );
}

function WinnerBoard({
  title,
  subtitle,
  boards,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  boards: PeriodWinnerLeaderboard[];
  emptyLabel: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-800/70 bg-slate-950/60 p-5">
      <div className="flex flex-col gap-1">
        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{title}</p>
        <p className="text-sm text-slate-300">{subtitle}</p>
      </div>
      {boards.length ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {boards.map((board) => (
            <div key={board.metricKey} className="rounded-2xl border border-slate-800/70 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">KPI</p>
                  <h5 className="text-lg font-semibold text-white">{board.metricLabel}</h5>
                </div>
                <span className="text-xs text-slate-400">Top {board.winners.length}</span>
              </div>
              <ol className="mt-3 space-y-2">
                {board.winners.map((winner) => (
                  <li key={winner.id} className="rounded-2xl border border-slate-800/60 bg-slate-950/60 p-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          #{winner.rank} · {winner.displayName}
                        </p>
                        <p className="text-xs text-slate-400">{winner.detailLine}</p>
                      </div>
                      <div className="text-right text-sm font-semibold text-emerald-200">
                        {winner.metricFormatted}
                        <p className="text-[11px] font-normal uppercase tracking-[0.3em] text-slate-400">
                          NPS {winner.npsFormatted}
                          {winner.surveyCount > 0 ? ` • ${winner.surveyCount.toLocaleString()} surveys` : ""}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-800/70 bg-slate-950/40 p-4 text-sm text-slate-400">
          {emptyLabel}
        </p>
      )}
    </div>
  );
}

type AnniversaryEntry = {
  id: string;
  name: string;
  shopNumber: number;
  shopName: string;
  districtName: string;
  regionName: string;
  anniversaryLabel: string;
  years: number;
  daysUntil: number;
  occursOn?: string;
};

function AnniversaryPanel({ entries }: { entries: AnniversaryEntry[] }) {
  return (
    <section className="rounded-3xl border border-slate-900/70 bg-slate-950/70 p-6">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-[0.4em] text-slate-500">Anniversaries</p>
        <h3 className="text-2xl font-semibold text-white">Upcoming hire-date celebrations</h3>
        <p className="text-sm text-slate-300">Powered by the hire dates inside the Employee Performance upload.</p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
            <div className="flex items-center gap-3">
              <span className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-2 text-emerald-200">
                <Cake className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{entry.name}</p>
                <p className="text-xs text-slate-400">{entry.anniversaryLabel} • {entry.years} yrs</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Shop {entry.shopNumber} · {entry.shopName} · {entry.districtName}
            </p>
            <p className="text-xs text-slate-500">{entry.regionName}</p>
            <p className="mt-3 text-sm font-semibold text-emerald-200">In {entry.daysUntil} days</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function BirthdaysPanel({ entries, loading, error }: { entries: CelebrationEntry[]; loading: boolean; error: string | null }) {
  const derivedEntries = useMemo(() => (
    entries.map((entry) => {
      if (entry.occursOn) {
        const upcoming = alignToUpcomingDate(new Date(entry.occursOn));
        return {
          ...entry,
          dateLabel: formatMonthDayLabel(upcoming),
          daysUntil: daysUntilDate(upcoming),
        } satisfies CelebrationEntry;
      }
      return entry;
    })
  ), [entries]);

  return (
    <section className="rounded-3xl border border-slate-900/70 bg-slate-950/70 p-6">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-[0.4em] text-slate-500">Birthdays</p>
        <h3 className="text-2xl font-semibold text-white">Upcoming celebrations</h3>
        <p className="text-sm text-slate-300">Auto-populated from shop_staff birth dates across your scope.</p>
      </div>
      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-200" /> Loading birthdays…
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {derivedEntries.length ? (
            derivedEntries.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
                <div className="flex items-center gap-3">
                  <span className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-2 text-emerald-200">
                    <Cake className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{entry.name}</p>
                    <p className="text-xs text-slate-400">Shop {entry.shopNumber}{entry.shopName ? ` · ${entry.shopName}` : ""}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">{entry.dateLabel}</p>
                <p className="text-sm font-semibold text-emerald-200">In {entry.daysUntil} days</p>
                {(entry.favoriteTreat || entry.celebrationNotes || entry.note) ? (
                  <div className="mt-2 space-y-1 text-xs text-slate-400">
                    {entry.favoriteTreat ? (
                      <p className="font-semibold text-emerald-100/80">Favorite treat · {entry.favoriteTreat}</p>
                    ) : null}
                    {entry.celebrationNotes ? <p>{entry.celebrationNotes}</p> : null}
                    {!entry.favoriteTreat && !entry.celebrationNotes && entry.note ? <p>{entry.note}</p> : null}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-800/60 bg-slate-950/50 p-4 text-sm text-slate-400">
              No birthdays detected for this scope. Add DOBs in the People workspace to populate this list.
            </p>
          )}
        </div>
      )}
      {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
    </section>
  );
}

const PERIOD_WINNER_METRIC_KEYS: string[] = ["carCount", "carGrowth", "sales", "ticket", "csi", "retention", "safetyScore"];
const SURVEY_COUNT_KEYS = ["surveyCount", "npsSurveys", "csiSurveys", "surveyResponses", "responseCount"];
const QUALIFIER_LIST_LIMIT = 12;
const qualifierNumberFormatter = new Intl.NumberFormat("en-US");

function buildPeriodWinnerInsights(dataset: RecognitionDatasetRow[], thresholds: PeriodWinnerThresholds): PeriodWinnerInsights {
  if (!dataset.length) {
    return {
      eligibleShops: 0,
      eligibleEmployees: 0,
      shopLeaderboards: [],
      employeeLeaderboards: [],
      shopQualifiers: [],
      employeeQualifiers: [],
    };
  }

  const shopCandidates = dataset.filter((row) => meetsThreshold(row, thresholds.minOilChanges, thresholds.npsQualifier));
  const employeeCandidates = dataset.filter((row) =>
    meetsThreshold(row, thresholds.minOilChanges, thresholds.npsQualifier),
  );

  return {
    eligibleShops: shopCandidates.length,
    eligibleEmployees: employeeCandidates.length,
    shopLeaderboards: buildLeaderboards(shopCandidates, "shop"),
    employeeLeaderboards: buildLeaderboards(employeeCandidates, "employee"),
    shopQualifiers: buildQualifierEntries(shopCandidates, "shop"),
    employeeQualifiers: buildQualifierEntries(employeeCandidates, "employee"),
  };
}

function buildAnniversaryEntries(dataset: RecognitionDatasetRow[]): AnniversaryEntry[] {
  if (!dataset.length) {
    return [];
  }

  const today = startOfDay(new Date());
  const windowInDays = 60;

  const entries = dataset
    .map((row, index) => {
      if (!row.hireDate) {
        return null;
      }
      const hireDate = new Date(row.hireDate);
      if (Number.isNaN(hireDate.getTime())) {
        return null;
      }
      const anniversary = startOfDay(new Date(hireDate));
      anniversary.setFullYear(today.getFullYear());
      if (anniversary < today) {
        anniversary.setFullYear(today.getFullYear() + 1);
      }
      const daysUntil = Math.round((anniversary.getTime() - today.getTime()) / 86400000);
      if (daysUntil > windowInDays) {
        return null;
      }
      const years = anniversary.getFullYear() - hireDate.getFullYear();
      if (years <= 0) {
        return null;
      }
      const name = row.managerName || row.shopName;
      const anniversaryLabel = anniversary.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const entry: AnniversaryEntry = {
        id: `${row.shopNumber}-${index}`,
        name,
        shopNumber: row.shopNumber,
        shopName: row.shopName,
        districtName: row.districtName || "Unassigned District",
        regionName: row.regionName || "Unassigned Region",
        anniversaryLabel,
        years,
        daysUntil,
        occursOn: anniversary.toISOString(),
      };
      return entry;
    })
    .filter((entry): entry is AnniversaryEntry => entry !== null);

  return entries.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 6);
}

function startOfDay(date: Date): Date {
  const clone = new Date(date);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

function alignToUpcomingDate(date: Date): Date {
  const today = startOfDay(new Date());
  const target = startOfDay(new Date(date));
  target.setFullYear(today.getFullYear());
  if (target < today) {
    target.setFullYear(today.getFullYear() + 1);
  }
  return target;
}

function formatMonthDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysUntilDate(date: Date): number {
  const today = startOfDay(new Date());
  return Math.max(0, Math.round((date.getTime() - today.getTime()) / 86400000));
}

function buildLeaderboards(rows: RecognitionDatasetRow[], scope: "shop" | "employee"): PeriodWinnerLeaderboard[] {
  if (!rows.length) {
    return [];
  }

  return PERIOD_WINNER_METRIC_KEYS.map((metricKey) => {
    const metricLabel = RECOGNITION_METRIC_LOOKUP[metricKey]?.label ?? metricKey;
    const winners = rankCandidates(rows, metricKey, scope);
    return winners.length
      ? {
          metricKey,
          metricLabel,
          winners,
        }
      : null;
  }).filter((entry): entry is PeriodWinnerLeaderboard => Boolean(entry));
}

function buildQualifierEntries(rows: RecognitionDatasetRow[], scope: "shop" | "employee"): PeriodWinnerQualifier[] {
  if (!rows.length) {
    return [];
  }

  return [...rows]
    .sort((a, b) => (b.metrics.carCount ?? 0) - (a.metrics.carCount ?? 0))
    .slice(0, QUALIFIER_LIST_LIMIT)
    .map((row, index) => {
      const shopLabel = row.shopName || `Shop ${row.shopNumber}`;
      const districtLabel = row.districtName || "Unassigned District";
      const title = scope === "shop" ? shopLabel : row.managerName || shopLabel;
      const detailLine = scope === "shop"
        ? `Shop ${row.shopNumber} • ${districtLabel}`
        : `${shopLabel} • ${districtLabel}`;

      return {
        id: `${scope}-qualifier-${row.shopNumber}-${index}`,
        title,
        detailLine,
        metrics: [
          { label: "Cars", value: formatQualifierNumber(row.metrics.carCount) },
          { label: "NPS", value: formatRecognitionMetricValue("csi", row.metrics.csi ?? null) },
        ],
      } satisfies PeriodWinnerQualifier;
    });
}

function formatQualifierNumber(value: number | null | undefined): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return qualifierNumberFormatter.format(value);
  }
  return "—";
}

function rankCandidates(
  rows: RecognitionDatasetRow[],
  metricKey: string,
  scope: "shop" | "employee",
  limit = 5,
): PeriodWinnerEntry[] {
  const withMetric = rows.filter((row) => typeof row.metrics[metricKey] === "number");
  if (!withMetric.length) {
    return [];
  }

  const higherIsBetter = RECOGNITION_METRIC_LOOKUP[metricKey]?.higherIsBetter !== false;
  const sorted = [...withMetric].sort((a, b) => compareRowsByMetric(a, b, metricKey, higherIsBetter));
  return sorted.slice(0, limit).map((row, index) => {
    const displayName = scope === "shop" ? row.shopName : row.managerName || row.shopName;
    const detailLine = scope === "shop"
      ? `${row.districtName || "Unassigned District"} • ${row.managerName || "Unassigned Manager"}`
      : `${row.shopName} • ${row.districtName || "Unassigned District"}`;

    return {
      id: `${scope}-${metricKey}-${row.shopNumber}-${index}`,
      rank: index + 1,
      displayName,
      detailLine,
      metricFormatted: formatRecognitionMetricValue(metricKey, row.metrics[metricKey]),
      metricValue: row.metrics[metricKey] ?? null,
      npsFormatted: formatRecognitionMetricValue("csi", row.metrics.csi ?? null),
      npsValue: row.metrics.csi ?? null,
      surveyCount: extractSurveyCount(row.metrics),
    };
  });
}

function meetsThreshold(row: RecognitionDatasetRow, minCars: number, minNps: number): boolean {
  const cars = row.metrics.carCount ?? null;
  const nps = row.metrics.csi ?? null;
  if (cars === null || cars < minCars) {
    return false;
  }
  if (nps === null || nps < minNps) {
    return false;
  }
  return true;
}

function compareRowsByMetric(
  a: RecognitionDatasetRow,
  b: RecognitionDatasetRow,
  metricKey: string,
  higherIsBetter: boolean,
): number {
  const aValue = a.metrics[metricKey];
  const bValue = b.metrics[metricKey];

  if (aValue === null || aValue === undefined) {
    return 1;
  }
  if (bValue === null || bValue === undefined) {
    return -1;
  }

  if (aValue !== bValue) {
    return higherIsBetter ? bValue - aValue : aValue - bValue;
  }

  const npsDiff = (b.metrics.csi ?? -Infinity) - (a.metrics.csi ?? -Infinity);
  if (npsDiff !== 0) {
    return npsDiff;
  }

  const surveyDiff = extractSurveyCount(b.metrics) - extractSurveyCount(a.metrics);
  if (surveyDiff !== 0) {
    return surveyDiff;
  }

  return a.shopNumber - b.shopNumber;
}

function extractSurveyCount(metrics: RecognitionDatasetRow["metrics"]): number {
  for (const key of SURVEY_COUNT_KEYS) {
    const value = metrics[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}
