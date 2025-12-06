"use client";

import React from "react";

type Props = {
  label?: string;
  children?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  tintColor?: string;
  className?: string;
  disabled?: boolean;
  title?: string;
};

export default function Chip({
  label,
  children,
  active = false,
  onClick,
  tintColor,
  className = "",
  disabled = false,
  title,
}: Props) {
  const accent = tintColor ?? "#06b6d4"; // teal-400 fallback
  const textColor = active ? "#ffffff" : "#e6edf3"; // white vs light slate
  const borderStyle = active ? "border-transparent" : "border-slate-700/60";

  const style: React.CSSProperties = active
    ? { background: accent, color: textColor }
    : { background: "rgba(255,255,255,0.02)", color: textColor, borderColor: "rgba(148,163,184,0.12)" };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold transition-shadow disabled:opacity-50 ${borderStyle} ${className}`}
      style={style}
    >
      {children ?? label}
    </button>
  );
}
