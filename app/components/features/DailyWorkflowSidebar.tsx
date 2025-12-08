"use client";

import Link from "next/link";

export const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"] as const;

type DailyTask = {
  id: string | number;
  label: string;
  linkHref?: string;
  external?: boolean;
};

export function DailyWorkflowSidebar({ activeDay, setActiveDay, tasks }: { activeDay: string; setActiveDay: (d: string) => void; tasks?: Record<string, DailyTask[]> }) {
  return (
    <aside className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-white">Daily Workflow</div>
        <div className="text-xs text-slate-400">Quick checklist for the selected day</div>
      </div>

      <div className="mb-3 flex gap-1 flex-wrap">
        {DAYS.map((d) => (
          <button key={d} onClick={() => setActiveDay(d)} className={`px-2 py-1 text-xs rounded-md ${activeDay === d ? 'bg-emerald-600/40' : 'bg-slate-800/30'}`}>
            {d.slice(0,3)}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {(tasks?.[activeDay] ?? []).map((task) => (
          <div key={task.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-800/40 bg-slate-950/30 p-2 text-sm">
            <div className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4" />
              <div>{task.label}</div>
            </div>
            <div>
              {task.linkHref ? (
                task.external ? (
                  <a href={task.linkHref} target="_blank" rel="noreferrer" className="text-xs text-emerald-300">Open</a>
                ) : (
                  <Link href={task.linkHref} className="text-xs text-emerald-300">Open</Link>
                )
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default DailyWorkflowSidebar;
