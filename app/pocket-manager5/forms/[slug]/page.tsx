import Link from "next/link";
import { notFound } from "next/navigation";
import { FEATURE_LOOKUP } from "../../featureRegistry";
import { FormRenderer } from "../FormRenderer";
import { FORM_LOOKUP, FORM_REGISTRY, type FormSlug } from "../formRegistry";

export function generateStaticParams() {
  return FORM_REGISTRY.map((form) => ({ slug: form.slug }));
}

export default async function PocketManagerFormPage({ params }: { params: Promise<{ slug: FormSlug }> }) {
  const { slug } = await params;
  const form = FORM_LOOKUP[slug];

  if (!form) {
    notFound();
  }

  const feature = FEATURE_LOOKUP[form.feature];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
        <Link
          href="/pocket-manager5"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 transition hover:text-emerald-100"
        >
          <span aria-hidden>↩</span> Pocket Manager5
        </Link>

        <header className="rounded-3xl border border-slate-900/70 bg-slate-900/50 p-8 shadow-2xl shadow-black/40">
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Form workspace</p>
          <h1 className="mt-2 text-4xl font-semibold text-white">{form.title}</h1>
          <p className="mt-3 text-base text-slate-300">{form.description}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em]">
            <span className="rounded-full border border-slate-800/70 px-3 py-1 text-slate-300">
              Feature · {feature?.title ?? form.feature}
            </span>
            {form.supabaseTable && (
              <span className="rounded-full border border-emerald-500/40 px-3 py-1 text-emerald-200">
                Supabase · {form.supabaseTable}
              </span>
            )}
          </div>
        </header>

        <FormRenderer form={form} />
      </div>
    </main>
  );
}
