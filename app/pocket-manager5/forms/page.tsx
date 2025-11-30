import Link from "next/link";
import { FEATURE_LOOKUP } from "../featureRegistry";
import type { FormConfig } from "./formRegistry";
import { FORM_REGISTRY } from "./formRegistry";

export default function FormsLibraryPage() {
  const grouped = FORM_REGISTRY.reduce((acc, form) => {
    const key = form.feature;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(form);
    return acc;
  }, {} as Record<string, FormConfig[]>);

  const entries = Object.entries(grouped);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <Link
          href="/pocket-manager5"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 transition hover:text-emerald-100"
        >
          <span aria-hidden>↩</span> Back to Pocket Manager5
        </Link>

        <header className="mt-6 space-y-3">
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Form library</p>
          <h1 className="text-4xl font-semibold text-white">District manager forms</h1>
        </header>

        <div className="mt-10 space-y-8">
          {entries.map(([featureSlug, forms]) => {
            const feature = FEATURE_LOOKUP[featureSlug as keyof typeof FEATURE_LOOKUP];
            return (
              <section key={featureSlug} className="space-y-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{feature?.title ?? featureSlug}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {forms.map((form) => (
                    <Link
                      key={form.slug}
                      href={`/pocket-manager5/forms/${form.slug}`}
                      className="rounded-3xl border border-slate-900/70 bg-slate-900/40 p-5 transition hover:border-emerald-400/40 hover:bg-slate-900/60"
                    >
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{feature?.title ?? "Form"}</p>
                      <h2 className="mt-1 text-xl font-semibold text-white">{form.title}</h2>
                      <p className="mt-2 text-sm text-slate-400">{form.description}</p>
                      <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-emerald-200">
                        <span>Open form</span>
                        <span aria-hidden>↗</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
