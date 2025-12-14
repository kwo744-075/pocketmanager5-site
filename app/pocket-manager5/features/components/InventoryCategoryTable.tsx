"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { InventoryCategoryItem } from "@/lib/inventoryPreview";

export function InventoryCategoryTable({ category, shopNumber, lastSync, items }: { category: string; shopNumber: string | null; lastSync: string; items: InventoryCategoryItem[] }) {
  const [showFloor, setShowFloor] = useState(true);
  const [showStorage, setShowStorage] = useState(true);
  const columns = [
    { key: "item", label: "Item" },
    ...(showFloor ? [{ key: "floor", label: "Floor" as const }] : []),
    ...(showStorage ? [{ key: "storage", label: "Storage" as const }] : []),
    { key: "total", label: "Total" },
    { key: "lastChanged", label: "Last Changed" },
  ];

  return (
    <section className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6 shadow-2xl shadow-black/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{shopNumber ? `Shop ${shopNumber}` : "Any shop"}</p>
          <h1 className="text-3xl font-semibold text-white">{category}</h1>
          <p className="text-sm text-slate-400">Live counts from inventory worksheet and counts.</p>
          <p className="mt-1 text-xs text-slate-500">Last sync: {lastSync}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-200">
          <button
            type="button"
            onClick={() => setShowFloor((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1 transition hover:border-emerald-400/60"
          >
            {showFloor ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            Floor
          </button>
          <button
            type="button"
            onClick={() => setShowStorage((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1 transition hover:border-emerald-400/60"
          >
            {showStorage ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            Storage
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-800/70 bg-slate-950/60">
        <table className="min-w-full text-sm text-slate-100">
          <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-[0.2em] text-slate-400">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-400" colSpan={columns.length}>
                  No items in this category yet.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.item} className="border-t border-slate-800/70 text-slate-200">
                  <td className="px-4 py-3 font-mono text-xs sm:text-sm">{item.item}</td>
                  {showFloor ? <td className="px-4 py-3">{item.floor}</td> : null}
                  {showStorage ? <td className="px-4 py-3">{item.storage}</td> : null}
                  <td className="px-4 py-3 font-semibold text-emerald-100">{item.total}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{item.lastChanged ?? "--"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
