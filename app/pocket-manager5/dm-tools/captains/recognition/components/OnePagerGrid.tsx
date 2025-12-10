"use client";

import { useEffect, useMemo, useState } from "react";
import { usePocketHierarchy } from "@/hooks/usePocketHierarchy";
import { RECOGNITION_METRICS } from "@/lib/recognition-captain/config";
import type { RecognitionDatasetRow } from "@/lib/recognition-captain/types";

type SourceKey = "employee" | "powerRanker" | "customRegion" | "nps" | "donations" | "none";

type OnePagerRow = {
  id: string;
  metricKey: string;
  metricLabel: string;
  employeeName?: string;
  employeeDistrict?: string;
  shopNumber?: number | null;
  shopManager?: string;
  confirmed?: boolean;
  manual?: boolean;
  empIndex?: number;
  shopIndex?: number;
  source?: SourceKey;
};

export default function OnePagerGrid({
  qualifierPreview,
  getTopEmployeeLeaders,
  getTopShopLeaders,
  initialConfirmations,
  onConfirmationsChange,
  fileMapper,
}: {
  qualifierPreview?: RecognitionDatasetRow | null;
  getTopEmployeeLeaders: (metricKey: string, limit?: number) => RecognitionDatasetRow[];
  getTopShopLeaders: (metricKey: string, limit?: number) => RecognitionDatasetRow[];
  initialConfirmations?: any[];
  onConfirmationsChange?: (rows: any[]) => void;
  fileMapper?: any;
}) {
  // Fixed, ordered KPI list for the Excel-style one-pager (matches the design image)
  const ONE_PAGER_KPIS: { key: string; label: string }[] = [
    { key: "overAll", label: "Over ALL (TOP TL)" },
    { key: "powerRanker1", label: "Power Ranker #1" },
    { key: "powerRanker2", label: "Power Ranker #2" },
    { key: "powerRanker3", label: "Power Ranker #3" },
    { key: "carsVsBudget", label: "Cars vs Budget" },
    { key: "carsVsComp", label: "Cars vs Comp" },
    { key: "salesVsBudget", label: "Sales vs Budget" },
    { key: "salesVsComp", label: "Sales vs Comp" },
    { key: "nps", label: "NPS" },
    { key: "emailCollection", label: "Email Collection" },
    { key: "pmix", label: "Pmix" },
    { key: "big4", label: "Big 4" },
    { key: "fuelFilters", label: "Fuel Filters" },
    { key: "netAro", label: "Net ARO" },
    { key: "coolants", label: "Coolants" },
    { key: "discounts", label: "Discounts" },
    { key: "differentials", label: "Differentials" },
    { key: "donations", label: "Donations" },
  ];

  const buildInitial = () => {
    const rows: OnePagerRow[] = ONE_PAGER_KPIS.map((m) => {
      const emp = getTopEmployeeLeaders(m.key, 10)[0];
      const shop = getTopShopLeaders(m.key, 10)[0];
      return {
        id: `kp-${m.key}`,
        metricKey: m.key,
        metricLabel: m.label,
        employeeName: emp?.managerName ?? "",
        employeeDistrict: emp?.districtName ?? "",
        shopNumber: shop?.shopNumber ?? null,
        shopManager: shop?.managerName ?? "",
        confirmed: false,
        manual: false,
        empIndex: 0,
        shopIndex: 0,
        source: (fileMapper?.perKpi?.[m.key] as SourceKey) ?? undefined,
      };
    });
    return rows;
  };

  const [rows, setRows] = useState<OnePagerRow[]>(() => buildInitial());
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRow, setNewRow] = useState<{ givenFor: string; employeeName: string; shopNumber?: number | null }>({ givenFor: "", employeeName: "", shopNumber: null });

  useEffect(() => {
    // If parent supplied initial confirmations, hydrate rows (best-effort)
    if (initialConfirmations && initialConfirmations.length) {
      // map to our row shape when ids match
      const mapped = rows.map((r) => {
        const found = initialConfirmations.find((c) => c.id === r.id);
        if (found) {
          return { ...r, employeeName: found.winnerName ?? r.employeeName, shopNumber: found.shopNumber ?? r.shopNumber, confirmed: Boolean(found.confirmed) };
        }
        return r;
      });
      setRows(mapped);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConfirmations]);

  const handleConfirmToggle = (idx: number) => {
    const next = [...rows];
    next[idx].confirmed = !next[idx].confirmed;
    setRows(next);
    onConfirmationsChange?.(next.map(mapToConfirmationRow));
  };

  const handleReassign = (idx: number) => {
    const r = rows[idx];
    const empCandidates = getTopEmployeeLeaders(r.metricKey, 20);
    const shopCandidates = getTopShopLeaders(r.metricKey, 20);
    const next = [...rows];
    // advance employee
    const nextEmpIndex = ((r.empIndex ?? 0) + 1) % Math.max(1, empCandidates.length);
    const nextShopIndex = ((r.shopIndex ?? 0) + 1) % Math.max(1, shopCandidates.length);
    if (empCandidates.length) {
      const emp = empCandidates[nextEmpIndex];
      next[idx].employeeName = emp?.managerName ?? "";
      next[idx].employeeDistrict = emp?.districtName ?? "";
      next[idx].empIndex = nextEmpIndex;
    }
    if (shopCandidates.length) {
      const shop = shopCandidates[nextShopIndex];
      next[idx].shopNumber = shop?.shopNumber ?? null;
      next[idx].shopManager = shop?.managerName ?? "";
      next[idx].shopIndex = nextShopIndex;
    }
    next[idx].confirmed = false;
    setRows(next);
    onConfirmationsChange?.(next.map(mapToConfirmationRow));
  };

  const mapToConfirmationRow = (r: OnePagerRow) => ({ id: r.id, winnerName: r.employeeName ?? "", shopNumber: r.shopNumber ?? undefined, metricKey: r.metricKey });

  const { hierarchy } = usePocketHierarchy();

  const addManualRow = () => {
    const id = `manual-${Date.now()}`;
    const added: OnePagerRow = {
      id,
      metricKey: `manualmetric-${Date.now()}`,
      metricLabel: newRow.givenFor ?? "Manual Award",
      employeeName: newRow.employeeName,
      employeeDistrict: hierarchy?.district_name ?? "",
      shopNumber: newRow.shopNumber ?? null,
      shopManager: "",
      confirmed: false,
      manual: true,
      empIndex: 0,
      shopIndex: 0,
    };
    const next = [...rows, added];
    setRows(next);
    setNewRow({ givenFor: "", employeeName: "", shopNumber: null });
    onConfirmationsChange?.(next.map(mapToConfirmationRow));
  };

  const handleAddManualFromModal = () => {
    addManualRow();
    setShowAddModal(false);
  };

  const handleRemove = (idx: number) => {
    const r = rows[idx];
    if (!r.manual) return;
    const next = [...rows];
    next.splice(idx, 1);
    setRows(next);
    onConfirmationsChange?.(next.map(mapToConfirmationRow));
  };

  return (
    <section style={{ borderRadius: 6, border: "1px solid rgba(148,163,184,0.06)", background: "transparent", padding: 0 }}>
      <div style={{ padding: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 1, color: "#94a3b8", textTransform: "uppercase" }}>Rankings one-pager</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Top KPI winners</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => { setShowAddModal(true); }}
            className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
          >
            Add Award
          </button>
        </div>
      </div>

      {/* inline add form removed; Add Award opens modal only */}

      {showAddModal ? (
        <div role="dialog" aria-modal style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 520, background: '#0b1220', padding: 16, borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Add Award</h3>
              <div>
                <button onClick={() => setShowAddModal(false)} className="rounded bg-rose-600/80 px-3 py-1 text-xs font-semibold text-white">Close</button>
              </div>
            </div>

            <div className="grid gap-3">
              <label className="text-sm text-slate-300">Given for (KPI)</label>
              <input value={newRow.givenFor} onChange={(e) => setNewRow({ ...newRow, givenFor: e.target.value })} placeholder="e.g. Sales vs Budget" className="rounded border bg-slate-900/40 p-2 text-sm" />

              <label className="text-sm text-slate-300">Employee name</label>
              <input value={newRow.employeeName} onChange={(e) => setNewRow({ ...newRow, employeeName: e.target.value })} placeholder="Employee name" className="rounded border bg-slate-900/40 p-2 text-sm" />

              <label className="text-sm text-slate-300">Shop #</label>
              <input value={newRow.shopNumber ?? ""} onChange={(e) => setNewRow({ ...newRow, shopNumber: e.target.value ? Number(e.target.value) : undefined })} placeholder="Shop #" className="rounded border bg-slate-900/40 p-2 text-sm" />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setShowAddModal(false)} className="rounded border px-3 py-1 text-xs text-slate-200">Cancel</button>
                <button onClick={() => handleAddManualFromModal()} className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Add Award</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <colgroup>
            <col style={{ width: "28%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "30%" }} />
            <col style={{ width: "30%" }} />
          </colgroup>
          <thead>
            <tr style={{ background: "#111827", color: "#cbd5e1", textTransform: "uppercase", fontSize: 11 }}>
              <th style={{ border: "1px solid #111", padding: 6, textAlign: "left" }}>KPI</th>
              <th style={{ border: "1px solid #111", padding: 6, textAlign: "left" }}>District</th>
              <th style={{ border: "1px solid #111", padding: 6, textAlign: "left" }}>Employee Top Spot</th>
              <th style={{ border: "1px solid #111", padding: 6, textAlign: "left" }}>Shop Top Spot</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.04)", color: "#e6eef8" }}>
                <td style={{ padding: 4, fontWeight: 600 }}>{r.metricLabel}</td>
                <td style={{ padding: 4 }}>{r.employeeDistrict ?? ""}</td>
                <td style={{ padding: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      style={{ flex: 1, padding: 6, fontSize: 12, borderRadius: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.04)", color: r.confirmed ? '#16a34a' : undefined }}
                      value={r.employeeName}
                      onChange={(e) => {
                        const next = [...rows];
                        next[idx].employeeName = e.target.value;
                        next[idx].confirmed = false;
                        setRows(next);
                        onConfirmationsChange?.(next.map(mapToConfirmationRow));
                      }}
                    />
                    {/* actions moved to final column (checkbox first, then Confirm, Reassign) */}
                  </div>
                </td>
                <td style={{ padding: 4 }}>{r.shopNumber ?? ""}</td>
                <td style={{ padding: 4 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                    <input type="checkbox" checked={Boolean(r.confirmed)} onChange={() => handleConfirmToggle(idx)} />
                    <button
                      type="button"
                      onClick={() => handleConfirmToggle(idx)}
                      className={`rounded-full px-2 py-1 text-xs ${r.confirmed ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-200'}`}
                    >
                      Confirm
                    </button>
                    <button type="button" onClick={() => handleReassign(idx)} className="rounded-full px-2 py-1 text-xs bg-slate-700 text-slate-200">Reassign</button>
                    {r.manual ? (
                      <button type="button" onClick={() => handleRemove(idx)} style={{ padding: "6px 8px", fontSize: 12, color: "#ff6b6b" }}>Remove</button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
