import Link from "next/link";
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
        {cards.map((card) => (
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
                  {card.badge}
                </span>
              ) : null}
            </div>
            <h4 className="mt-3 text-xl font-semibold text-white">{card.title}</h4>
            <p className="mt-2 text-sm text-slate-400">{card.description}</p>
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
          </article>
        ))}
      </div>
    </section>
  );
}
