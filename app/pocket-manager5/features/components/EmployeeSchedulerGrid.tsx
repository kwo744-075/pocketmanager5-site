"use client";

import React from "react";
import type { EmployeeSchedulingPreview } from "@/lib/peopleFeatureData";

export default function EmployeeSchedulerGrid({ preview }: { preview: EmployeeSchedulingPreview }) {
  const days = preview.simpleScheduler.dailyCoverage ?? [];
  const employees = preview.simpleScheduler.employees ?? [];

  return (
    <section className="mt-4 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Week grid (summary)</p>
          <p className="text-lg font-semibold text-white">Daily coverage & teammates</p>
        </div>
        <div className="text-sm text-slate-400">Week: {preview.weekStartISO} → {preview.weekEndISO}</div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs uppercase tracking-[0.2em] text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Employee</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-right">Shifts</th>
              <th className="px-3 py-2 text-right">Hours</th>
              {days.map((d) => (
                <th key={d.date} className="px-3 py-2 text-center">
                  <div className="text-slate-300">{d.date.split("-").slice(1).join("-")}</div>
                  <div className="text-xs text-slate-400">{Math.round(d.hours * 10) / 10}h</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {employees.length ? (
              employees.map((emp) => (
                <tr key={emp.id}>
                  <td className="px-3 py-2 font-semibold text-white">{emp.name}</td>
                  <td className="px-3 py-2">{emp.role ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{emp.shifts}</td>
                  <td className="px-3 py-2 text-right">{emp.hours}</td>
                  {days.map((d) => (
                    <td key={`${emp.id}-${d.date}`} className="px-3 py-2 text-center">—</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4 + days.length} className="px-3 py-4 text-sm text-slate-400">
                  No teammates scheduled this week.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
