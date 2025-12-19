 "use client";

import Link from "next/link";
import addToShow from "@/lib/show/addToShow";
import type { LucideIcon } from "lucide-react";

export type CaptainLandingCard = {
  title: string;
  description: string;
  status: string;
  icon: LucideIcon;
  badge?: string;
  badgeTone?: string;
  href?: string;
  disabled?: boolean;
  actionLabel?: string;
};

export type CaptainLandingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  cards: CaptainLandingCard[];
  onAddToShow?: (cardId: string, awardKey?: string) => void;
  onEnterSlide?: (cardId: string, awardKey?: string) => void;
};

export function CaptainLanding({ eyebrow = "Captain hub", title, description, cards }: CaptainLandingProps) {
  return (
    <section className="rounded-3xl border border-slate-900/70 bg-slate-950/70 p-6">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-[0.4em] text-slate-500">{eyebrow}</p>
        <h3 className="text-2xl font-semibold text-white">{title}</h3>
        {description ? <p className="text-sm text-slate-300">{description}</p> : null}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {cards.map((card) => {
          // Replace CSI with NPS for display on this page
          const displayTitle = card.title.replace(/CSI/gi, "NPS");
          const displayDescription = card.description?.replace(/CSI/gi, "NPS");
          const displayBadge = card.badge?.replace(/CSI/gi, "NPS");
          return (
            <article key={card.title} className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
                <card.icon className="h-4 w-4 text-emerald-200" />
                {card.status}
              </div>
              {card.badge ? (
                <span
                  className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] ${card.badgeTone ?? "text-slate-200 border-slate-600"}`}
                >
                  {displayBadge}
                </span>
              ) : null}
            </div>
            <h4 className="mt-3 text-xl font-semibold text-white">{displayTitle}</h4>
            <p className="mt-2 text-sm text-slate-400">{displayDescription}</p>
            <div className="mt-4">
              {card.disabled || !card.href ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-slate-700/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Coming soon
                </span>
              ) : (
                <Link
                  href={card.href}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100 transition hover:border-emerald-300"
                >
                  {card.actionLabel ?? "Open"}
                </Link>
              )}
            </div>
            {/* Award quick actions */}
            <div className="mt-3 flex items-center gap-2">
              <select
                aria-label="Award type"
                defaultValue="district-mvp"
                className="rounded-md bg-slate-900/60 px-2 py-1 text-xs text-slate-200"
                id={`award-select-${card.title.replace(/\s+/g, "-")}`}
              >
                <option value="district-mvp">District MVP</option>
                <option value="car-count-crusher">Car Count Crusher</option>
                <option value="ticket-hawk">Ticket Hawk</option>
                <option value="csi-guardian">NPS Champions</option>
              </select>
              <button
                type="button"
                className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                onClick={async () => {
                  const sel = document.getElementById(`award-select-${card.title.replace(/\s+/g, "-")}`) as HTMLSelectElement | null;
                  const awardKey = sel?.value;
                  try {
                    if (typeof addToShow === "function") {
                      await addToShow({ title: card.title, awardKey });
                      console.info('Added to show via helper', card.title, awardKey);
                    } else {
                      // Safely call window-level hook if present and properly typed
                      const w = window as unknown as { __onAddToShow?: (title: string, awardKey?: string) => Promise<void> };
                      if (typeof w.__onAddToShow === 'function') {
                        await w.__onAddToShow(card.title, awardKey);
                        console.info('Added to show via window hook', card.title, awardKey);
                      }
                    }
                  } catch (err) {
                    console.error('Add to show failed', err);
                  }
                }}
              >
                Add to Show
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200"
                onClick={() => {
                  const sel = document.getElementById(`award-select-${card.title.replace(/\s+/g, "-")}`) as HTMLSelectElement | null;
                  const awardKey = sel?.value;
                  const w = window as unknown as { __onEnterSlide?: (title: string, awardKey?: string) => void };
                  if (typeof w.__onEnterSlide === 'function') {
                    w.__onEnterSlide(card.title, awardKey);
                  }
                }}
              >
                Edit Slide
              </button>
            </div>
          </article>
          );
        })}
      </div>
    </section>
  );
}
