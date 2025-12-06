"use client";

import { useState } from "react";

type Item = {
  label: string;
  href?: string;
  onClick?: () => void;
  color?: string;
};

export default function AccordionBanner({ title, items, color, textColor }: { title: string; items: Item[]; color?: string; textColor?: string }) {
  const [open, setOpen] = useState(false);
  const accent = color ?? "#0ea5a4";
  const fg = textColor ?? "#fff";

  return (
    <div className="rounded-2xl overflow-hidden" style={{ borderRadius: 14 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ background: accent, color: fg }}
        aria-expanded={open}
      >
        <span className="font-semibold">{title}</span>
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="bg-slate-900/70 p-3">
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={`${it.label}-${idx}`}>
                {it.href ? (
                  <a
                    className="block rounded-md px-3 py-2 text-sm font-semibold text-slate-100"
                    href={it.href}
                    style={{ background: it.color ?? undefined }}
                  >
                    {it.label}
                  </a>
                ) : it.onClick ? (
                  <button
                    type="button"
                    onClick={it.onClick}
                    className="w-full text-left rounded-md px-3 py-2 text-sm font-semibold text-slate-100"
                    style={{ background: it.color ?? undefined }}
                  >
                    {it.label}
                  </button>
                ) : (
                  <div className="block rounded-md px-3 py-2 text-sm font-semibold text-slate-100" style={{ background: it.color ?? undefined }}>
                    {it.label}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
