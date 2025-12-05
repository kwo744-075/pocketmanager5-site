import Link from "next/link";
import { notFound } from "next/navigation";
import { FEATURE_LOOKUP } from "../../featureRegistry";
import { FormRenderer, type FieldValue } from "../FormRenderer";
import { FORM_LOOKUP, FORM_REGISTRY, type FormSlug } from "../formRegistry";

export function generateStaticParams() {
  return FORM_REGISTRY.map((form) => ({ slug: form.slug }));
}

export default async function PocketManagerFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: FormSlug }>;
  searchParams: Promise<{ date?: string | string[]; shop?: string | string[] }>;
}) {
  const { slug } = await params;
  const form = FORM_LOOKUP[slug];

  if (!form) {
    notFound();
  }

  const feature = FEATURE_LOOKUP[form.feature];
  const resolvedSearch = await searchParams;
  const initialValues: Record<string, FieldValue> = {};

  const resolvedDateParam = typeof resolvedSearch?.date === "string" ? resolvedSearch.date : undefined;
  if (resolvedDateParam) {
    initialValues.visitDate = resolvedDateParam;
  }

  const resolvedShopParam = typeof resolvedSearch?.shop === "string" ? resolvedSearch.shop : undefined;
  if (resolvedShopParam) {
    initialValues.shopNumber = resolvedShopParam;
  }

  const selectedDateLabel = resolvedDateParam
    ? new Date(resolvedDateParam).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
    : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-8">
        <Link
          href="/pocket-manager5"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 transition hover:text-emerald-100"
        >
          <span aria-hidden>↩</span> Pocket Manager5
        </Link>
        <section className="rounded-3xl border border-slate-900/70 bg-slate-950/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Form workspace</p>
              <h1 className="mt-1 text-3xl font-semibold text-white">{form.title}</h1>
              <p className="mt-2 text-sm text-slate-300">{form.description}</p>
            </div>
            <div className="space-y-2 text-right text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
              <p className="text-slate-300">Feature · {feature?.title ?? form.feature}</p>
              {form.supabaseTable && <p className="text-emerald-200">Supabase · {form.supabaseTable}</p>}
            </div>
          </div>
        </section>

        <FormRenderer
          form={form}
          initialValues={Object.keys(initialValues).length ? initialValues : undefined}
          sectionHeaderBadges={
            selectedDateLabel && form.slug === "dm-visit-plan"
              ? { "Visit details": selectedDateLabel }
              : undefined
          }
        />
      </div>
    </main>
  );
}
