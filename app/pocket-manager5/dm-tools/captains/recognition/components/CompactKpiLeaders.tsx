"use client";

import { useState } from "react";
import { RECOGNITION_METRICS } from "@/lib/recognition-captain/config";
import { formatRecognitionMetricValue } from "@/lib/recognition-captain/config";
import type { RecognitionDatasetRow } from "@/lib/recognition-captain/types";
import { ChevronDown } from "lucide-react";

export default function CompactKpiLeaders({
  getTopEmployeeLeaders,
  getTopShopLeaders,
  defaultOpen = false,
  qualifiedEmployeesCount = 0,
  qualifiedShopsCount = 0,
}: {
  getTopEmployeeLeaders: (metricKey: string, limit?: number) => RecognitionDatasetRow[];
  getTopShopLeaders: (metricKey: string, limit?: number) => RecognitionDatasetRow[];
  defaultOpen?: boolean;
  qualifiedEmployeesCount?: number;
  qualifiedShopsCount?: number;
}) {
  const [openMetric, setOpenMetric] = useState<string | null>(defaultOpen ? RECOGNITION_METRICS[0]?.key ?? null : null);

  return (
    <div className="mt-6 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-3 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Compact leaderboards</p>
          <p className="text-sm font-semibold text-white">Top 10 per KPI</p>
        </div>
        <div className="hidden sm:grid sm:grid-cols-3 sm:gap-2">
          <div className="rounded-md border border-slate-800/60 bg-slate-950/60 px-3 py-2 text-center">
            <p className="text-[10px] uppercase text-slate-400">Employees</p>
            <p className="text-sm font-semibold text-white">{qualifiedEmployeesCount}</p>
          </div>
          <div className="rounded-md border border-slate-800/60 bg-slate-950/60 px-3 py-2 text-center">
            <p className="text-[10px] uppercase text-slate-400">Shops</p>
            <p className="text-sm font-semibold text-white">{qualifiedShopsCount}</p>
          </div>
          <div className="rounded-md border border-slate-800/60 bg-slate-950/60 px-3 py-2 text-center">
            <p className="text-[10px] uppercase text-slate-400">Top</p>
            <p className="text-sm font-semibold text-white">Top 10</p>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {RECOGNITION_METRICS.map((metric) => {
          const emp = getTopEmployeeLeaders(metric.key, 10);
          const shop = getTopShopLeaders(metric.key, 10);
          const isOpen = openMetric === metric.key;
          return (
            <div key={metric.key} className="rounded-lg border border-slate-800/60 bg-slate-950/50">
              <button
                type="button"
                onClick={() => setOpenMetric(isOpen ? null : metric.key)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{metric.label}</p>
                  <p className="text-sm font-semibold text-white">Top {Math.max(emp.length, shop.length) || 0}</p>
                </div>
                <span className={`rounded-full p-2 text-slate-400`}>
                  <ChevronDown className={`h-4 w-4 transition ${isOpen ? "-rotate-180 text-emerald-200" : ""}`} />
                </span>
              </button>

              {isOpen ? (
                <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                  <div>
                    <p className="text-xs text-slate-400">Employees</p>
                    <ol className="mt-2 space-y-1 text-sm">
                      {emp.length ? (
                        emp.map((row, idx) => (
                          <li key={`e-${metric.key}-${row.shopNumber}-${idx}`} className="flex items-center justify-between">
                            <div className="truncate pr-2">
                              <p className="text-sm text-white">#{idx + 1} · {row.managerName ?? `#${row.shopNumber}`}</p>
                              <p className="text-xs text-slate-400 truncate">{row.shopNumber ? `Shop #${row.shopNumber}` : "—"}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-mono text-emerald-200">{formatRecognitionMetricValue(metric.key, row.metrics[metric.key])}</p>
                            </div>
                          </li>
                        ))
                      ) : (
                        <li className="text-xs text-slate-400">No qualified employees</li>
                      )}
                    </ol>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Shops</p>
                    <ol className="mt-2 space-y-1 text-sm">
                      {shop.length ? (
                        shop.map((row, idx) => (
                          <li key={`s-${metric.key}-${row.shopNumber}-${idx}`} className="flex items-center justify-between">
                            <div className="truncate pr-2">
                              <p className="text-sm text-white">#{idx + 1} · {row.shopNumber}</p>
                              <p className="text-xs text-slate-400 truncate">{row.managerName ?? "—"}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-mono text-emerald-200">{formatRecognitionMetricValue(metric.key, row.metrics[metric.key])}</p>
                            </div>
                          </li>
                        ))
                      ) : (
                        <li className="text-xs text-slate-400">No qualified shops</li>
                      )}
                    </ol>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
