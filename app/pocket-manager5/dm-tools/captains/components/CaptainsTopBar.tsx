"use client";

import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";
import { RetailPills } from "@/app/components/RetailPills";

interface CaptainsTopBarProps {
  title: string;
  description?: string;
  backHref?: string;
  homeHref?: string;
}

export function CaptainsTopBar({
  title,
  description,
  backHref = "/pocket-manager5#dm-tools",
  homeHref = "/pocket-manager5",
}: CaptainsTopBarProps) {
  return (
    <header className="mb-8 border-b border-slate-800/60 pb-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 rounded-full border border-slate-700/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-slate-200 transition hover:border-emerald-400/70 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> DM Tools
            </Link>
            <Link
              href={homeHref}
              className="inline-flex items-center gap-1 rounded-full border border-slate-700/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-slate-200 transition hover:border-emerald-400/70 hover:text-white"
            >
              <Home className="h-3.5 w-3.5" /> PM5 Home
            </Link>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.5em] text-slate-500">Captains Portal</p>
            <h1 className="text-3xl font-semibold text-white lg:text-4xl">{title}</h1>
          </div>
          {description ? <p className="max-w-3xl text-sm text-slate-300">{description}</p> : null}
        </div>
        <RetailPills />
      </div>
    </header>
  );
}
