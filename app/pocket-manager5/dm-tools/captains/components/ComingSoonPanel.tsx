interface ComingSoonPanelProps {
  title: string;
  description: string;
  bullets: string[];
}

export function ComingSoonPanel({ title, description, bullets }: ComingSoonPanelProps) {
  return (
    <section className="mx-auto max-w-3xl rounded-3xl border border-slate-800/70 bg-slate-900/70 p-8 text-slate-300 shadow-2xl shadow-black/30">
      <p className="text-[11px] uppercase tracking-[0.5em] text-amber-300">In development</p>
      <h2 className="mt-2 text-3xl font-semibold text-white">{title}</h2>
      <p className="mt-3 text-sm text-slate-300">{description}</p>
      <ul className="mt-5 space-y-2 text-sm text-slate-200">
        {bullets.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
