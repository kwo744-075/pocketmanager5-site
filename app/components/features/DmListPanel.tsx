"use client";

import * as React from "react";
import Link from "next/link";

type DmListItem = {
  id: string;
  createdAt: string;
  shopName: string;
  shopNumber: string;
  message: string;
  category: string;
  priority: string;
  status: string;
};

type Props = {
  items: DmListItem[];
  filter: "All" | "Open" | "Completed";
  setFilter: (f: "All" | "Open" | "Completed") => void;
  loading: boolean;
  error: string | null;
  onSelect: (item: any) => void;
  onRefresh: () => void;
  page: number;
  setPage: (n: number) => void;
};

export default function DmListPanel({ items, filter, setFilter, loading, error, onSelect, onRefresh, page, setPage }: Props) {
  return (
    <div className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">DM List – Incoming Requests</h3>
          <p className="text-sm text-slate-300">Quick asks submitted by shops from Pocket Manager 5.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className={`rounded-full px-3 py-1 text-sm ${filter === 'All' ? 'bg-emerald-600/40' : 'bg-slate-800/30'}`} onClick={() => setFilter('All')}>All</button>
          <button className={`rounded-full px-3 py-1 text-sm ${filter === 'Open' ? 'bg-emerald-600/40' : 'bg-slate-800/30'}`} onClick={() => setFilter('Open')}>Open</button>
          <button className={`rounded-full px-3 py-1 text-sm ${filter === 'Completed' ? 'bg-emerald-600/40' : 'bg-slate-800/30'}`} onClick={() => setFilter('Completed')}>Completed</button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-slate-400">{loading ? 'Loading…' : `${items.length} items`}</div>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} className="text-xs px-2 py-1 rounded-md border border-slate-700">Refresh</button>
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="text-xs px-2 py-1 rounded-md border border-slate-700">Prev</button>
          <button onClick={() => setPage(page + 1)} className="text-xs px-2 py-1 rounded-md border border-slate-700">Next</button>
        </div>
      </div>

      {error ? <div className="mt-2 text-sm text-rose-400">{error}</div> : null}

      <div className="mt-3 max-h-[72vh] overflow-auto">
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-md border border-slate-800/50 bg-slate-950/30 p-3 cursor-pointer" onClick={() => onSelect(item)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{item.shopName} <span className="text-xs text-slate-400">#{item.shopNumber}</span></div>
                  <div className="text-xs text-slate-300">{new Date(item.createdAt).toLocaleString()}</div>
                  <div className="mt-2 text-sm text-slate-200">{item.message}</div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="text-xs text-slate-400">{item.category}</div>
                  <div className={`mt-2 rounded-full px-2 py-1 text-xs ${item.priority === 'High' ? 'bg-rose-600/40' : 'bg-slate-800/30'}`}>{item.priority}</div>
                  <div className="mt-2 text-xs text-slate-300">{item.status}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
