"use client";

import SchedulerGridEditor from "@/app/pocket-manager5/features/components/SchedulerGridEditor";
import EmployeeSchedulingTable from "@/app/pocket-manager5/features/components/EmployeeSchedulingTable";
import { usePocketHierarchy } from "@/hooks/usePocketHierarchy";
import { useState } from "react";

export default function EmployeeSchedulingPage() {
  const { needsLogin, shopMeta, hierarchy, hierarchyLoading } = usePocketHierarchy();

  const shopNumber = shopMeta?.shop_number ? String(shopMeta.shop_number) : null;
  const [view, setView] = useState<"editor" | "table">("editor");

  return (
    <main className="px-6 pb-10">
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Employee Scheduling</h1>
            <p className="text-sm text-slate-400">Week rosters & coverage — editing schedules for your assigned shop.</p>

            {/* District / Region context */}
            <div className="mt-2 text-sm text-slate-400">
              {hierarchyLoading ? (
                <span>Loading scope…</span>
              ) : (
                <span>
                  {hierarchy?.district_name ? (
                    <span className="mr-4">District: <strong className="text-white">{hierarchy?.district_name}</strong></span>
                  ) : null}
                  {hierarchy?.region_name ? (
                    <span>Region: <strong className="text-white">{hierarchy?.region_name}</strong></span>
                  ) : null}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setView("editor")}
              className={`rounded-md px-3 py-1 text-sm ${view === "editor" ? "bg-emerald-500/10 border border-emerald-400/60 text-emerald-100" : "border border-slate-700/70 text-slate-200"}`}
            >
              Editor
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={`rounded-md px-3 py-1 text-sm ${view === "table" ? "bg-emerald-500/10 border border-emerald-400/60 text-emerald-100" : "border border-slate-700/70 text-slate-200"}`}
            >
              Table
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6">
        {needsLogin ? (
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 text-sm text-slate-300">
            Please sign in to access scheduling for your shop.
          </div>
        ) : view === "editor" ? (
          <SchedulerGridEditor shopNumber={shopNumber} />
        ) : (
          <EmployeeSchedulingTable />
        )}
      </section>
    </main>
  );
}
