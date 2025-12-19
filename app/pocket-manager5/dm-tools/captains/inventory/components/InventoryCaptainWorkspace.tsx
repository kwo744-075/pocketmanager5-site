"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Filter,
  Loader2,
  Search,
  X,
} from "lucide-react";
import Chip from "@/app/components/Chip";
import { usePocketHierarchy } from "@/hooks/usePocketHierarchy";
import { useCaptainRoleGate } from "@/hooks/useCaptainRoleGate";
import {
  DEFAULT_INVENTORY_THRESHOLD_CONFIG,
  INVENTORY_CATEGORY_LABELS,
} from "@/lib/inventory-captain/config";
import type {
  InventoryShopDirectoryEntry,
  InventoryThresholdRecord,
} from "@/lib/inventory-captain/metadata";
import type {
  DistrictInventorySummary,
  InventoryCategory,
  InventoryThresholdConfig,
  InventoryProcessResponse,
  InventoryExportJob,
  ShopDayInventoryStatus,
  CategoryVariance,
} from "@/lib/inventory-captain/types";
import { InventoryPivotBoard } from "./InventoryPivotBoard";

const PERIOD_OPTIONS = [
  { label: "This Week", value: "thisWeek" },
  { label: "Last Week", value: "lastWeek" },
  { label: "Last 14 Days", value: "last14" },
  { label: "Custom", value: "custom" },
] as const;

const REGION_ALL_OPTION = "All Regions";
const DISTRICT_ALL_OPTION = "All Districts";

const CATEGORY_ORDER: InventoryCategory[] = ["lubesOil", "oilFilters", "airFilters", "wipers", "cabins"];
const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const percentFormatter = new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 0, maximumFractionDigits: 0 });

const mockCategories = (): Record<InventoryCategory, CategoryVariance> => ({
  lubesOil: { qty: -2, value: -120 },
  oilFilters: { qty: -1, value: -35 },
  airFilters: { qty: 0, value: 0 },
  wipers: { qty: 1, value: 22 },
  cabins: { qty: 0, value: 0 },
});

const MOCK_RESPONSE: InventoryProcessResponse = {
  shopStatuses: [
    {
      storeNumber: 447,
      region: "Gulf Coast",
      district: "District 101",
      date: "2025-11-01",
      categories: mockCategories(),
      adjustmentVarianceValue: -133,
      didCount: true,
    },
    {
      storeNumber: 447,
      region: "Gulf Coast",
      district: "District 101",
      date: "2025-11-02",
      categories: mockCategories(),
      adjustmentVarianceValue: -80,
      didCount: true,
    },
    {
      storeNumber: 511,
      region: "Gulf Coast",
      district: "District 101",
      date: "2025-11-01",
      categories: mockCategories(),
      adjustmentVarianceValue: 55,
      didCount: false,
    },
    {
      storeNumber: 612,
      region: "Midwest",
      district: "District 220",
      date: "2025-11-01",
      categories: mockCategories(),
      adjustmentVarianceValue: 10,
      didCount: true,
    },
  ],
  districtSummaries: [
    {
      district: "District 101",
      region: "Gulf Coast",
      lubesOil: { qty: -8, value: -420 },
      oilFilters: { qty: -4, value: -120 },
      airFilters: { qty: -1, value: -30 },
      wipers: { qty: 2, value: 40 },
      cabins: { qty: 0, value: 0 },
      adjustmentVarianceValue: -530,
      onTimeCounts: 8,
      totalCountTarget: 10,
      countCompliance: 0.8,
    },
    {
      district: "District 220",
      region: "Midwest",
      lubesOil: { qty: -1, value: -40 },
      oilFilters: { qty: -2, value: -60 },
      airFilters: { qty: 1, value: 20 },
      wipers: { qty: 0, value: 0 },
      cabins: { qty: 0, value: 0 },
      adjustmentVarianceValue: -80,
      onTimeCounts: 5,
      totalCountTarget: 5,
      countCompliance: 1,
    },
  ],
};

type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

type ShopAggregate = {
  storeNumber: number;
  storeName?: string | null;
  region?: string;
  district?: string;
  categories: Record<InventoryCategory, CategoryVariance>;
  totalVariance: number;
  daysCounted: number;
  daysAvailable: number;
};
type ShopDirectoryMap = Record<number, InventoryShopDirectoryEntry>;

type InventoryExportResponsePayload = {
  exportId?: string;
  status?: "queued" | "processing" | "ready" | "failed" | "expired";
  readyAt?: string | null;
  downloadUrl?: string | null;
  error?: string;
};

const buildShopAggregates = (rows: ShopDayInventoryStatus[], directory?: ShopDirectoryMap) => {
  const map = new Map<number, ShopAggregate>();
  rows.forEach((row) => {
    const metadata = directory?.[row.storeNumber];
    if (!map.has(row.storeNumber)) {
      map.set(row.storeNumber, {
        storeNumber: row.storeNumber,
        storeName: metadata?.shopName ?? row.storeName,
        region: metadata?.regionName ?? row.region,
        district: metadata?.districtName ?? row.district,
        categories: CATEGORY_ORDER.reduce((acc, key) => {
          acc[key] = { qty: 0, value: 0 };
          return acc;
        }, {} as Record<InventoryCategory, CategoryVariance>),
        totalVariance: 0,
        daysCounted: 0,
        daysAvailable: 0,
      });
    }
    const entry = map.get(row.storeNumber)!;
    if (!entry.storeName && (metadata?.shopName || row.storeName)) {
      entry.storeName = metadata?.shopName ?? row.storeName ?? null;
    }
    if (metadata?.regionName) {
      entry.region = metadata.regionName;
    } else if (!entry.region) {
      entry.region = row.region;
    }
    if (metadata?.districtName) {
      entry.district = metadata.districtName;
    } else if (!entry.district) {
      entry.district = row.district;
    }
    entry.daysAvailable += 1;
    if (row.didCount) {
      entry.daysCounted += 1;
    }
    CATEGORY_ORDER.forEach((category) => {
      entry.categories[category].qty += row.categories[category].qty;
      entry.categories[category].value += row.categories[category].value;
    });
    entry.totalVariance += row.adjustmentVarianceValue;
  });
  return Array.from(map.values()).sort((a, b) => a.storeNumber - b.storeNumber);
};

const decorateStatusesWithMetadata = (rows: ShopDayInventoryStatus[], directory: ShopDirectoryMap) =>
  rows.map((row) => {
    const metadata = directory?.[row.storeNumber];
    if (!metadata) {
      return row;
    }
    return {
      ...row,
      storeName: metadata.shopName ?? row.storeName,
      region: metadata.regionName ?? row.region,
      district: metadata.districtName ?? row.district,
    } satisfies ShopDayInventoryStatus;
  });

type InventoryMetadataResponse = {
  thresholds?: InventoryThresholdRecord;
  shops?: InventoryShopDirectoryEntry[];
  error?: string;
};

const complianceStatus = (ratio: number, config: InventoryThresholdConfig = DEFAULT_INVENTORY_THRESHOLD_CONFIG) => {
  if (ratio >= config.greenCompliance) {
    return { label: "On Track", tone: "text-emerald-300 bg-emerald-500/10 border-emerald-400/20" };
  }
  if (ratio >= config.yellowCompliance) {
    return { label: "Watch", tone: "text-amber-300 bg-amber-500/10 border-amber-400/20" };
  }
  return { label: "Action", tone: "text-rose-300 bg-rose-500/10 border-rose-400/20" };
};

const formatVariance = (value: number) => currencyFormatter.format(Math.round(value));

export function InventoryCaptainWorkspace() {
  const hierarchy = usePocketHierarchy("/pocket-manager5/dm-tools/captains/inventory/adjustments");
  const scopeLevel = hierarchy.hierarchy?.scope_level ?? null;
  const { role, canQueueExports, hydrated } = useCaptainRoleGate({ scopeLevel, loading: hierarchy.hierarchyLoading });

  const [thresholds, setThresholds] = useState<InventoryThresholdConfig>(DEFAULT_INVENTORY_THRESHOLD_CONFIG);
  const [thresholdSource, setThresholdSource] = useState<InventoryThresholdRecord["source"]>("fallback");
  const [shopDirectory, setShopDirectory] = useState<ShopDirectoryMap>({});
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodValue>("thisWeek");
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [region, setRegion] = useState<string>(REGION_ALL_OPTION);
  const [district, setDistrict] = useState<string>(DISTRICT_ALL_OPTION);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [adjustFile, setAdjustFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [shopStatuses, setShopStatuses] = useState<ShopDayInventoryStatus[]>(MOCK_RESPONSE.shopStatuses);
  const [districtSummaries, setDistrictSummaries] = useState<DistrictInventorySummary[]>(MOCK_RESPONSE.districtSummaries);
  const [activeTab, setActiveTab] = useState<"shops" | "districts">("shops");
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);
  const [detailStore, setDetailStore] = useState<ShopAggregate | null>(null);
  const [detailHistory, setDetailHistory] = useState<ShopDayInventoryStatus[]>([]);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [latestRunId, setLatestRunId] = useState<string | null>(null);
  const [exportJobs, setExportJobs] = useState<InventoryExportJob[]>([]);
  const [includeRegionDirectory, setIncludeRegionDirectory] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadMetadata = async () => {
      setMetadataLoading(true);
      setMetadataError(null);
      try {
        const response = await fetch("/api/inventory/metadata", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Metadata request failed");
        }
        const payload = (await response.json()) as InventoryMetadataResponse;
        if (cancelled) {
          return;
        }
        if (payload.thresholds) {
          setThresholds({
            countsPerShopPerWeek: payload.thresholds.countsPerShopPerWeek ?? DEFAULT_INVENTORY_THRESHOLD_CONFIG.countsPerShopPerWeek,
            greenCompliance: payload.thresholds.greenCompliance ?? DEFAULT_INVENTORY_THRESHOLD_CONFIG.greenCompliance,
            yellowCompliance: payload.thresholds.yellowCompliance ?? DEFAULT_INVENTORY_THRESHOLD_CONFIG.yellowCompliance,
          });
          setThresholdSource(payload.thresholds.source ?? "fallback");
        } else {
          setThresholds(DEFAULT_INVENTORY_THRESHOLD_CONFIG);
          setThresholdSource("fallback");
        }
        if (Array.isArray(payload.shops)) {
          const directory: ShopDirectoryMap = {};
          payload.shops.forEach((entry) => {
            if (typeof entry.shopNumber === "number") {
              directory[entry.shopNumber] = entry;
            }
          });
          setShopDirectory(directory);
        } else {
          setShopDirectory({});
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[InventoryCaptain] metadata fetch failed", error);
          setMetadataError("Using default thresholds. Live metadata unavailable.");
          setThresholds(DEFAULT_INVENTORY_THRESHOLD_CONFIG);
          setThresholdSource("fallback");
          setShopDirectory({});
        }
      } finally {
        if (!cancelled) {
          setMetadataLoading(false);
        }
      }
    };

    loadMetadata();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!shopDirectory || !Object.keys(shopDirectory).length) {
      return;
    }
    setShopStatuses((current) => decorateStatusesWithMetadata(current, shopDirectory));
  }, [shopDirectory]);

  const regionOptions = useMemo(() => {
    const options = new Set<string>([REGION_ALL_OPTION]);
    Object.values(shopDirectory).forEach((entry) => {
      if (entry.regionName) {
        options.add(entry.regionName);
      }
    });
    return Array.from(options);
  }, [shopDirectory]);

  const districtOptions = useMemo(() => {
    const options = new Set<string>([DISTRICT_ALL_OPTION]);
    Object.values(shopDirectory).forEach((entry) => {
      if (!entry.districtName) {
        return;
      }
      if (region !== REGION_ALL_OPTION && entry.regionName !== region) {
        return;
      }
      options.add(entry.districtName);
    });
    return Array.from(options);
  }, [shopDirectory, region]);

  useEffect(() => {
    if (!regionOptions.includes(region)) {
      setRegion(regionOptions[0] ?? REGION_ALL_OPTION);
    }
  }, [regionOptions, region]);

  useEffect(() => {
    if (!districtOptions.includes(district)) {
      setDistrict(districtOptions[0] ?? DISTRICT_ALL_OPTION);
    }
  }, [districtOptions, district]);

  const shopTableRef = useRef<HTMLDivElement | null>(null);

  const baseAggregates = useMemo(() => buildShopAggregates(shopStatuses, shopDirectory), [shopDirectory, shopStatuses]);

  const directoryShops = useMemo(() => {
    return Object.values(shopDirectory).filter((entry) => {
      if (region !== REGION_ALL_OPTION && entry.regionName !== region) return false;
      if (district !== DISTRICT_ALL_OPTION && entry.districtName !== district) return false;
      return true;
    });
  }, [district, region, shopDirectory]);

  const aggregates = useMemo(() => {
    if (!includeRegionDirectory || !directoryShops.length || !shopStatuses.length) {
      return baseAggregates;
    }
    const map = new Map<number, ShopAggregate>();
    baseAggregates.forEach((agg) => map.set(agg.storeNumber, agg));
    directoryShops.forEach((entry) => {
      if (typeof entry.shopNumber !== "number" || map.has(entry.shopNumber)) return;
      map.set(entry.shopNumber, {
        storeNumber: entry.shopNumber,
        storeName: entry.shopName ?? null,
        region: entry.regionName ?? undefined,
        district: entry.districtName ?? undefined,
        categories: CATEGORY_ORDER.reduce((acc, key) => {
          acc[key] = { qty: 0, value: 0 };
          return acc;
        }, {} as Record<InventoryCategory, CategoryVariance>),
        totalVariance: 0,
        daysCounted: 0,
        daysAvailable: 1,
      });
    });
    return Array.from(map.values()).sort((a, b) => a.storeNumber - b.storeNumber);
  }, [baseAggregates, directoryShops, includeRegionDirectory, shopStatuses.length]);

  const totalShops = aggregates.length;
  const shopsWithCounts = aggregates.filter((shop) => shop.daysCounted > 0).length;
  const shopsMissingCounts = Math.max(0, totalShops - shopsWithCounts);
  const totalVariance = shopStatuses.reduce((sum, row) => sum + row.adjustmentVarianceValue, 0);

  const worstVariance = useMemo(() => {
    const byStore = new Map<number, number>();
    shopStatuses.forEach((row) => {
      byStore.set(row.storeNumber, (byStore.get(row.storeNumber) ?? 0) + row.adjustmentVarianceValue);
    });
    let targetStore: number | null = null;
    let targetValue = 0;
    byStore.forEach((value, store) => {
      if (targetStore === null || Math.abs(value) > Math.abs(targetValue)) {
        targetStore = store;
        targetValue = value;
      }
    });
    return targetStore ? { storeNumber: targetStore, variance: targetValue } : null;
  }, [shopStatuses]);

  const filteredAggregates = useMemo(() => {
    return aggregates.filter((shop) => {
      if (showOnlyMissing && shop.daysCounted > 0) {
        return false;
      }
      if (!searchTerm) {
        return true;
      }
      const term = searchTerm.trim().toLowerCase();
      return (
        shop.storeNumber.toString().includes(term) ||
        (shop.storeName ? shop.storeName.toLowerCase().includes(term) : false)
      );
    });
  }, [aggregates, searchTerm, showOnlyMissing]);

  const outliers = useMemo(() => {
    return aggregates
      .map((shop) => ({
        storeNumber: shop.storeNumber,
        storeName: shop.storeName,
        district: shop.district,
        missingCounts: Math.max(0, shop.daysAvailable - shop.daysCounted),
        variance: shop.totalVariance,
      }))
      .sort((a, b) => b.missingCounts - a.missingCounts || Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, 10);
  }, [aggregates]);

  const presetRange = useCallback(
    (value: PeriodValue) => {
      const now = new Date();
      const end = new Date(now);
      const start = new Date(now);
      switch (value) {
        case "thisWeek":
          start.setDate(now.getDate() - now.getDay());
          break;
        case "lastWeek":
          end.setDate(now.getDate() - now.getDay() - 1);
          start.setDate(end.getDate() - 6);
          break;
        case "last14":
          start.setDate(now.getDate() - 13);
          break;
        case "custom":
        default:
          return;
      }
      setStartDate(start.toISOString().slice(0, 10));
      setEndDate(end.toISOString().slice(0, 10));
    },
    [],
  );

  const handlePeriodChange = (value: PeriodValue) => {
    setPeriod(value);
    presetRange(value);
  };

  const handleProcess = useCallback(async () => {
    if (!rawFile) {
      setStatusMessage("Upload the raw inventory export first.");
      return;
    }
    const filters = {
      startDate: period === "custom" ? startDate : undefined,
      endDate: period === "custom" ? endDate : undefined,
      region: region !== REGION_ALL_OPTION ? region : undefined,
      district: district !== DISTRICT_ALL_OPTION ? district : undefined,
    };
    try {
      setProcessing(true);
      setStatusMessage("Processing inventory data…");
      const formData = new FormData();
      formData.append("rawFile", rawFile);
      if (adjustFile) {
        formData.append("adjustFile", adjustFile);
      }
      if (filters.startDate) formData.append("startDate", filters.startDate);
      if (filters.endDate) formData.append("endDate", filters.endDate);
      if (filters.region) formData.append("region", filters.region);
      if (filters.district) formData.append("district", filters.district);

      const response = await fetch("/api/inventory/process", { method: "POST", body: formData });
      if (!response.ok) {
        throw new Error((await response.json())?.error ?? "Unable to process inventory files");
      }
      const payload = (await response.json()) as InventoryProcessResponse;

      if (payload.thresholds) {
        setThresholds({
          countsPerShopPerWeek: payload.thresholds.countsPerShopPerWeek ?? DEFAULT_INVENTORY_THRESHOLD_CONFIG.countsPerShopPerWeek,
          greenCompliance: payload.thresholds.greenCompliance ?? DEFAULT_INVENTORY_THRESHOLD_CONFIG.greenCompliance,
          yellowCompliance: payload.thresholds.yellowCompliance ?? DEFAULT_INVENTORY_THRESHOLD_CONFIG.yellowCompliance,
        });
        setThresholdSource((payload.thresholds.source as InventoryThresholdRecord["source"]) ?? "fallback");
      }

      setLatestRunId(payload.runId ?? null);
      setExportJobs([]);
      setExportMessage(null);

      if (!payload.shopStatuses?.length) {
        setStatusMessage("Processed file but no rows matched filters — showing recent mock data.");
        setShopStatuses(decorateStatusesWithMetadata(MOCK_RESPONSE.shopStatuses, shopDirectory));
        setDistrictSummaries(MOCK_RESPONSE.districtSummaries);
      } else {
        setShopStatuses(decorateStatusesWithMetadata(payload.shopStatuses, shopDirectory));
        setDistrictSummaries(payload.districtSummaries);
        const mintedBy = payload.uploader?.email ?? null;
        const processedMessage = `Processed ${payload.shopStatuses.length} shop-days.`;
        setStatusMessage(mintedBy ? `${processedMessage} Minted by ${mintedBy}.` : processedMessage);
      }
      setShowOnlyMissing(false);
    } catch (error) {
      console.error(error);
      setStatusMessage("Processing failed, showing sample data.");
      setShopStatuses(decorateStatusesWithMetadata(MOCK_RESPONSE.shopStatuses, shopDirectory));
      setDistrictSummaries(MOCK_RESPONSE.districtSummaries);
      setLatestRunId(null);
      setExportJobs([]);
    } finally {
      setProcessing(false);
    }
  }, [adjustFile, district, endDate, period, rawFile, region, shopDirectory, startDate]);

  const handleExport = useCallback(
    async (type: "summary" | "shops") => {
      try {
        if (!canQueueExports) {
          setExportMessage("Exports are limited to DM scope or higher.");
          return;
        }
        const endpoint = type === "summary" ? "/api/inventory/export-summary" : "/api/inventory/export-shops";
        const hasData = type === "summary" ? districtSummaries.length > 0 : shopStatuses.length > 0;
        if (!hasData) {
          setExportMessage("Load inventory data before exporting.");
          return;
        }
        const requestBody = latestRunId
          ? { runId: latestRunId }
          : type === "summary"
            ? { districtSummaries }
            : { shopStatuses };
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        const data = (await response.json()) as InventoryExportResponsePayload;
        if (!response.ok || !data?.exportId) {
          throw new Error(data?.error ?? "Unable to build export");
        }

        const job: InventoryExportJob = {
          exportId: data.exportId,
          type,
          status: (data.status ?? "ready") as InventoryExportJob["status"],
          requestedAt: new Date().toISOString(),
          readyAt: data.readyAt ?? null,
          downloadUrl: data.downloadUrl ?? null,
        };
        setExportJobs((prev) => [job, ...prev].slice(0, 4));

        if (data.downloadUrl) {
          const filename = type === "summary" ? "inventory_district_summary.csv" : "inventory_shop_variances.csv";
          const link = document.createElement("a");
          link.href = data.downloadUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setExportMessage("Export ready. Download starting…");
        } else {
          setExportMessage("Export queued — check status below.");
        }
      } catch (error) {
        console.error(error);
        setExportMessage("Export failed. Try again in a moment.");
      }
    },
    [canQueueExports, districtSummaries, latestRunId, shopStatuses],
  );

  const handleRowClick = (aggregate: ShopAggregate) => {
    setDetailStore(aggregate);
    setDetailHistory(shopStatuses.filter((row) => row.storeNumber === aggregate.storeNumber));
  };

  const closeDetail = () => {
    setDetailStore(null);
    setDetailHistory([]);
  };

  const scrollToShops = () => {
    shopTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setShowOnlyMissing(true);
  };

  if (hierarchy.needsLogin) {
    return (
      <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-8 text-center text-sm text-slate-300">
        Sign in to load the Inventory Captain workspace.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SessionHeader
        loginEmail={hierarchy.loginEmail}
        role={role}
        hydrated={hydrated}
        statusMessage={statusMessage}
        thresholdSource={thresholdSource}
        metadataLoading={metadataLoading}
        metadataError={metadataError}
      />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <UploadPanel
          period={period}
          onPeriodChange={handlePeriodChange}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          region={region}
          regionOptions={regionOptions}
          district={district}
          districtOptions={districtOptions}
          onRegionChange={setRegion}
          onDistrictChange={setDistrict}
          onRawFileChange={setRawFile}
          onAdjustFileChange={setAdjustFile}
          rawFile={rawFile}
          adjustFile={adjustFile}
          onProcess={handleProcess}
          processing={processing}
        />
        <DashboardPanel
          totalShops={totalShops}
          shopsWithCounts={shopsWithCounts}
          totalVariance={totalVariance}
          shopsMissingCounts={shopsMissingCounts}
          worstVariance={worstVariance}
          onShowMissing={scrollToShops}
          includeRegionDirectory={includeRegionDirectory}
          onToggleRegionDirectory={setIncludeRegionDirectory}
          outliers={outliers}
        />
      </div>
      <InventoryPivotBoard />
      <div className="rounded-3xl border border-slate-900/70 bg-slate-950/60">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900/60 px-6 py-4">
          <div className="flex gap-2">
            {(["shops", "districts"] as const).map((tab) => (
              <Chip key={tab} onClick={() => setActiveTab(tab)} className="relative px-5 py-2 text-sm font-semibold tracking-wide" active={activeTab === tab}>
                {tab === "shops" ? "Shop Status" : "District Summary"}
                {activeTab === tab ? (
                  <motion.span layoutId="inventory-tab" className="absolute inset-0 rounded-full bg-slate-800/80" />
                ) : null}
              </Chip>
            ))}
          </div>
          {activeTab === "shops" ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search shop #"
                  className="rounded-full border border-slate-800 bg-slate-900/70 py-2 pl-10 pr-4 text-sm text-slate-100 focus:border-emerald-400/60 focus:outline-none"
                />
              </div>
              <Chip
                onClick={() => setShowOnlyMissing((prev) => !prev)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${
                  showOnlyMissing ? "border-rose-400/60 text-rose-200" : "border-slate-800 text-slate-400"
                }`}
                active={showOnlyMissing}
              >
                <Filter className="h-3.5 w-3.5" /> Missing
              </Chip>
            </div>
          ) : null}
        </div>
        {activeTab === "shops" ? (
          <div ref={shopTableRef} className="max-h-[520px] overflow-auto p-6">
            <ShopStatusTable rows={filteredAggregates} thresholds={thresholds} onRowClick={handleRowClick} />
          </div>
        ) : (
          <div className="max-h-[520px] overflow-auto p-6">
            <DistrictSummaryTable rows={districtSummaries} thresholds={thresholds} />
          </div>
        )}
      </div>
      <div className="space-y-4 rounded-3xl border border-slate-900/70 bg-slate-950/60 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Exports</p>
            <p className="text-sm text-slate-300">Queue CSV roll-ups backed by the latest processed run.</p>
            <p className="text-xs text-slate-500">Active run: {latestRunId ?? "None"}</p>
            {exportMessage ? <p className="text-xs text-slate-400">{exportMessage}</p> : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handleExport("summary")}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/60 px-4 py-2 text-sm font-semibold text-emerald-100"
            >
              <Download className="h-4 w-4" /> Export Region Summary
            </button>
            <button
              type="button"
              onClick={() => handleExport("shops")}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200"
            >
              <FileSpreadsheet className="h-4 w-4" /> Export Shop Variances
            </button>
          </div>
        </div>
        <div className="w-full space-y-2 rounded-2xl border border-slate-900/60 bg-slate-950/40 p-4">
          {exportJobs.length === 0 ? (
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-300" /> No exports queued yet this session.
            </p>
          ) : (
            exportJobs.map((job) => (
              <div key={job.exportId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/70 bg-slate-900/60 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {job.type === "summary" ? "Region summary" : "Shop variances"} · {job.status}
                  </p>
                  <p className="text-xs text-slate-400">
                    Requested {new Date(job.requestedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {job.downloadUrl ? (
                  <a
                    href={job.downloadUrl}
                    download={job.type === "summary" ? "inventory_district_summary.csv" : "inventory_shop_variances.csv"}
                    className="text-sm font-semibold text-emerald-200 underline-offset-4 hover:underline"
                  >
                    Download
                  </a>
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
      {detailStore ? <ShopDetailDrawer store={detailStore} history={detailHistory} onClose={closeDetail} /> : null}
    </div>
  );
}

function SessionHeader({
  loginEmail,
  role,
  hydrated,
  statusMessage,
  thresholdSource,
  metadataLoading,
  metadataError,
}: {
  loginEmail: string | null;
  role: string;
  hydrated: boolean;
  statusMessage: string | null;
  thresholdSource: InventoryThresholdRecord["source"];
  metadataLoading: boolean;
  metadataError: string | null;
}) {
  const resolveSourceLabel = () => {
    if (metadataLoading) {
      return "Loading…";
    }
    switch (thresholdSource) {
      case "alignment":
        return "Alignment profile";
      case "global":
        return "Org default";
      default:
        return "Fallback";
    }
  };
  return (
    <section className="rounded-3xl border border-slate-900/70 bg-gradient-to-br from-slate-950 via-slate-950/70 to-slate-900/40 p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.4em] text-slate-500">Inventory Captain</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Upload raw logs, auto-score variance, and spotlight missing counts.</h2>
          <p className="mt-3 text-sm text-slate-300">
            Inventory Captain ingests the Untitled export, maps parts into core shrink categories, and grades each shop + district against their count targets.
          </p>
        </div>
        <div className="grid w-full rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4 text-sm text-slate-300 lg:max-w-sm">
          <div className="flex items-center justify-between">
            <span>Signed in</span>
            <span className="text-white">{loginEmail ?? "demo@take5.local"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Role scope</span>
            <span className="text-white">{hydrated ? role.toUpperCase() : "..."}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Status</span>
            <span className="text-emerald-200">{statusMessage ?? "Ready"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Retail timestamp</span>
            <span className="text-white">{new Date().toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Threshold profile</span>
            <span className="text-white">{resolveSourceLabel()}</span>
          </div>
        </div>
        {metadataError ? <p className="text-xs text-amber-300">{metadataError}</p> : null}
      </div>
    </section>
  );
}

function UploadPanel({
  period,
  onPeriodChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  region,
  regionOptions,
  district,
  districtOptions,
  onRegionChange,
  onDistrictChange,
  rawFile,
  adjustFile,
  onRawFileChange,
  onAdjustFileChange,
  onProcess,
  processing,
}: {
  period: PeriodValue;
  onPeriodChange: (value: PeriodValue) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  region: string;
  regionOptions: string[];
  district: string;
  districtOptions: string[];
  onRegionChange: (value: string) => void;
  onDistrictChange: (value: string) => void;
  rawFile: File | null;
  adjustFile: File | null;
  onRawFileChange: (file: File | null) => void;
  onAdjustFileChange: (file: File | null) => void;
  onProcess: () => void;
  processing: boolean;
}) {
  const handleFileInput = (event: ChangeEvent<HTMLInputElement>, setter: (file: File | null) => void) => {
    const file = event.target.files?.[0] ?? null;
    setter(file);
  };

  return (
    <section className="space-y-4 rounded-3xl border border-slate-900/70 bg-slate-950/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Controls & Uploads</p>
        <h3 className="mt-2 text-xl font-semibold text-white">Pick the window, drop your exports, process.</h3>
      </div>
      <div className="space-y-3 text-sm">
        <label className="block text-xs uppercase tracking-[0.3em] text-slate-500">Period</label>
        <select
          value={period}
          onChange={(event) => onPeriodChange(event.target.value as PeriodValue)}
          className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-slate-100 focus:border-emerald-400/60 focus:outline-none"
        >
          {PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {period === "custom" ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Start</label>
              <input
                type="date"
                value={startDate}
                onChange={(event) => onStartDateChange(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-slate-100"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-500">End</label>
              <input
                type="date"
                value={endDate}
                onChange={(event) => onEndDateChange(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-slate-100"
              />
            </div>
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Region</label>
          <select
            value={region}
            onChange={(event) => onRegionChange(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-slate-100"
          >
            {regionOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.3em] text-slate-500">District</label>
          <select
            value={district}
            onChange={(event) => onDistrictChange(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-slate-100"
          >
            {districtOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-3 text-sm">
        <UploadCard
          label="Raw Inventory Log (Untitled export)"
          description="Required. First sheet is parsed automatically."
          file={rawFile}
          onChange={(event) => handleFileInput(event, onRawFileChange)}
        />
        <UploadCard
          label="Inventory Adjustments (optional)"
          description="If empty we'll filter Adjust rows automatically."
          file={adjustFile}
          onChange={(event) => handleFileInput(event, onAdjustFileChange)}
        />
      </div>
      <button
        type="button"
        onClick={onProcess}
        disabled={processing}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/60 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-60"
      >
        {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />} Process Inventory Data
      </button>
    </section>
  );
}

function UploadCard({ label, description, file, onChange }: { label: string; description: string; file: File | null; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label className="block cursor-pointer rounded-2xl border border-dashed border-slate-800/80 bg-slate-900/40 p-4">
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="text-xs text-slate-400">{description}</p>
      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
        <ArrowUp className="h-3.5 w-3.5" /> {file ? file.name : "Select file"}
      </div>
      <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={onChange} />
    </label>
  );
}

function DashboardPanel({
  totalShops,
  shopsWithCounts,
  totalVariance,
  shopsMissingCounts,
  worstVariance,
  onShowMissing,
  includeRegionDirectory,
  onToggleRegionDirectory,
  outliers,
}: {
  totalShops: number;
  shopsWithCounts: number;
  totalVariance: number;
  shopsMissingCounts: number;
  worstVariance: { storeNumber: number; variance: number } | null;
  onShowMissing: () => void;
  includeRegionDirectory: boolean;
  onToggleRegionDirectory: (value: boolean) => void;
  outliers: { storeNumber: number; storeName?: string | null; district?: string; missingCounts: number; variance: number }[];
}) {
  const cards = [
    {
      label: "Shops counted in range",
      primary: `${shopsWithCounts} / ${totalShops || 1}`,
      secondary: totalShops ? percentFormatter.format(shopsWithCounts / totalShops) : "--",
      icon: CheckCircle2,
      accent: "text-emerald-300",
    },
    {
      label: "Total variance (all shops)",
      primary: currencyFormatter.format(Math.round(totalVariance)),
      secondary: totalVariance >= 0 ? "over" : "short",
      icon: BarChart3,
      accent: "text-sky-300",
    },
    {
      label: "Worst variance shop",
      primary: worstVariance ? `#${worstVariance.storeNumber}` : "--",
      secondary: worstVariance ? formatVariance(worstVariance.variance) : "--",
      icon: ClipboardList,
      accent: "text-amber-300",
    },
    {
      label: "Shops missing counts",
      primary: shopsMissingCounts.toString(),
      secondary: "View list",
      icon: AlertTriangle,
      accent: "text-rose-300",
      action: onShowMissing,
    },
  ];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-900/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
        <span>Summary covers {includeRegionDirectory ? "all shops in region (zeros added for missing counts)" : "only shops present in the upload"}.</span>
        <label className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-200">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-700"
            checked={includeRegionDirectory}
            onChange={(event) => onToggleRegionDirectory(event.target.checked)}
          />
          Show all shops in region
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <motion.div
            key={card.label}
            whileHover={{ y: -4 }}
            className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
          >
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>{card.label}</span>
              <card.icon className={`h-5 w-5 ${card.accent}`} />
            </div>
            <div className="mt-3 text-3xl font-semibold text-white">{card.primary}</div>
            <div className="text-sm text-slate-400">{card.secondary}</div>
            {card.action ? (
              <button
                type="button"
                onClick={card.action}
                className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-rose-200"
              >
                Jump <ArrowUp className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </motion.div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-900/70 bg-slate-950/70 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Outliers</p>
            <p className="text-sm text-slate-300">Top 10 worst missing counts or dollars.</p>
          </div>
          <select className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100">
            <option>Top outlier shops</option>
            {outliers.map((outlier) => (
              <option key={outlier.storeNumber} className="text-slate-900">
                #{outlier.storeNumber} {outlier.storeName ? `- ${outlier.storeName}` : ""} ({outlier.district ?? "Unknown"}) • missing {outlier.missingCounts} • {formatVariance(outlier.variance)}
              </option>
            ))}
          </select>
        </div>
        {!outliers.length ? <p className="mt-2 text-xs text-slate-500">No outliers found for this selection.</p> : null}
      </div>
    </section>
  );
}

function ShopStatusTable({ rows, thresholds, onRowClick }: { rows: ShopAggregate[]; thresholds: InventoryThresholdConfig; onRowClick: (row: ShopAggregate) => void }) {
  if (!rows.length) {
    return <p className="text-sm text-slate-400">No shop data available. Upload a file to get started.</p>;
  }
  return (
    <table className="min-w-full text-sm text-slate-200">
      <thead className="bg-slate-900/60 text-xs uppercase text-slate-400">
        <tr>
          <th className="px-3 py-2 text-left">Shop #</th>
          <th className="px-3 py-2 text-left">District</th>
          <th className="px-3 py-2 text-left">Counts</th>
          {CATEGORY_ORDER.map((category) => (
            <th key={category} className="px-3 py-2 text-left">
              {INVENTORY_CATEGORY_LABELS[category]}
            </th>
          ))}
          <th className="px-3 py-2 text-left">Overall variance</th>
          <th className="px-3 py-2 text-left">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const ratio = row.daysAvailable ? row.daysCounted / row.daysAvailable : 0;
          const status = complianceStatus(ratio, thresholds);
          return (
            <tr
              key={row.storeNumber}
              className="cursor-pointer border-b border-slate-900/50 hover:bg-slate-900/30"
              onClick={() => onRowClick(row)}
            >
              <td className="px-3 py-3 font-semibold text-white">
                <div>#{row.storeNumber}</div>
                {row.storeName ? <div className="text-xs font-normal text-slate-500">{row.storeName}</div> : null}
              </td>
              <td className="px-3 py-3 text-slate-400">{row.district ?? "--"}</td>
              <td className="px-3 py-3 text-slate-300">
                {row.daysCounted} / {row.daysAvailable}
                <span className="ml-2 text-xs text-slate-500">{row.daysAvailable ? percentFormatter.format(ratio) : "--"}</span>
              </td>
              {CATEGORY_ORDER.map((category) => (
                <td key={category} className="px-3 py-3 text-slate-300">
                  <div className="text-xs text-slate-500">{row.categories[category].qty.toFixed(0)} qty</div>
                  <div className="font-semibold">{formatVariance(row.categories[category].value)}</div>
                </td>
              ))}
              <td className="px-3 py-3 font-semibold text-white">{formatVariance(row.totalVariance)}</td>
              <td className="px-3 py-3">
                <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${status.tone}`}>
                  <span className="h-2 w-2 rounded-full bg-current" />
                  {status.label}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function DistrictSummaryTable({ rows, thresholds }: { rows: DistrictInventorySummary[]; thresholds: InventoryThresholdConfig }) {
  if (!rows.length) {
    return <p className="text-sm text-slate-400">No district summaries yet. Upload an inventory export.</p>;
  }
  return (
    <table className="min-w-full text-sm text-slate-200">
      <thead className="bg-slate-900/60 text-xs uppercase text-slate-400">
        <tr>
          <th className="px-3 py-2 text-left">District</th>
          <th className="px-3 py-2 text-left">Region</th>
          {CATEGORY_ORDER.map((category) => (
            <th key={category} className="px-3 py-2 text-left">
              {INVENTORY_CATEGORY_LABELS[category]} +/-
            </th>
          ))}
          <th className="px-3 py-2 text-left">Adjustment variance</th>
          <th className="px-3 py-2 text-left">On-time counts</th>
          <th className="px-3 py-2 text-left">Target</th>
          <th className="px-3 py-2 text-left">Compliance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const status = complianceStatus(row.countCompliance ?? 0, thresholds);
          return (
            <tr key={`${row.region}-${row.district}`} className="border-b border-slate-900/50">
              <td className="px-3 py-3 font-semibold text-white">{row.district}</td>
              <td className="px-3 py-3 text-slate-400">{row.region}</td>
              {CATEGORY_ORDER.map((category) => (
                <td key={category} className="px-3 py-3">
                  <div className="text-xs text-slate-500">{row[category].qty.toFixed(0)} qty</div>
                  <div className="font-semibold">{formatVariance(row[category].value)}</div>
                </td>
              ))}
              <td className="px-3 py-3 font-semibold text-white">{formatVariance(row.adjustmentVarianceValue)}</td>
              <td className="px-3 py-3">{row.onTimeCounts}</td>
              <td className="px-3 py-3">{row.totalCountTarget.toFixed(0)}</td>
              <td className="px-3 py-3">
                <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${status.tone}`}>
                  <span className="h-2 w-2 rounded-full bg-current" />
                  {percentFormatter.format(row.countCompliance ?? 0)}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ShopDetailDrawer({ store, history, onClose }: { store: ShopAggregate; history: ShopDayInventoryStatus[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end bg-black/20 backdrop-blur-sm">
      <div className="h-full w-full max-w-lg rounded-l-3xl border-l border-slate-900/60 bg-slate-950/95 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-900/70 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Shop Detail</p>
            <h3 className="text-2xl font-semibold text-white">Store #{store.storeNumber}</h3>
            {store.storeName ? <p className="text-sm text-slate-300">{store.storeName}</p> : null}
            <p className="text-sm text-slate-400">{store.district ?? "--"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-800 p-2 text-slate-400">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-6 overflow-y-auto pr-2">
          <section>
            <h4 className="text-sm font-semibold text-white">Category variance</h4>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {CATEGORY_ORDER.map((category) => (
                <div key={category} className="rounded-2xl border border-slate-900/70 bg-slate-900/40 p-3 text-sm">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{INVENTORY_CATEGORY_LABELS[category]}</p>
                  <p className="text-lg font-semibold text-white">{formatVariance(store.categories[category].value)}</p>
                  <p className="text-xs text-slate-500">{store.categories[category].qty.toFixed(0)} qty</p>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h4 className="text-sm font-semibold text-white">Last counts</h4>
            <div className="space-y-2 text-sm">
              {history.map((row) => (
                <div key={`${row.date}-${row.storeNumber}`} className="flex items-center justify-between rounded-2xl border border-slate-900/70 bg-slate-900/40 px-3 py-2">
                  <div>
                    <p className="font-semibold text-white">{new Date(row.date).toLocaleDateString()}</p>
                    <p className="text-xs text-slate-500">{row.didCount ? "Count logged" : "Missing count"}</p>
                  </div>
                  <div className={`text-sm font-semibold ${row.didCount ? "text-emerald-300" : "text-rose-300"}`}>
                    {formatVariance(row.adjustmentVarianceValue)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
