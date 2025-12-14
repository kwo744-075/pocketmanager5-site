"use client";

import { useState } from "react";
import OnePagerGrid from "./OnePagerGrid";

export default function OnePagerPreviewPill() {
  const [open, setOpen] = useState(false);

  // placeholder leader providers that return empty arrays so preview renders
  const getTopEmployeeLeaders = (_metricKey: string, _limit = 10) => [];
  const getTopShopLeaders = (_metricKey: string, _limit = 10) => [];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-3 py-1 text-xs font-semibold text-slate-200 bg-slate-800/30"
      >
        Preview One-Pager
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div style={{ width: "100%", maxWidth: 1100, maxHeight: "96vh", overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button
                onClick={() => setOpen(false)}
                className="rounded bg-rose-600/80 px-3 py-1 text-xs font-semibold text-white"
              >
                Close
              </button>
            </div>

            <OnePagerGrid
              qualifierPreview={null}
              getTopEmployeeLeaders={getTopEmployeeLeaders}
              getTopShopLeaders={getTopShopLeaders}
              initialConfirmations={[]}
              onConfirmationsChange={() => {}}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
