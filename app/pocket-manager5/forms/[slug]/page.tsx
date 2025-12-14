import Link from "next/link";
import { notFound } from "next/navigation";
import { FEATURE_LOOKUP } from "../../featureRegistry";
import { FormRenderer, type FieldValue } from "../FormRenderer";
import EmployeeProfileWizardClient from "../components/EmployeeProfileWizardClient";
import { FORM_LOOKUP, FORM_REGISTRY, type FormSlug } from "../formRegistry";
import { supabase } from "@/lib/supabaseClient";

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
  let initialValues: Record<string, FieldValue> = {};

  const resolvedDateParam = typeof resolvedSearch?.date === "string" ? resolvedSearch.date : undefined;
  if (resolvedDateParam) {
    initialValues.visitDate = resolvedDateParam;
  }

  const resolvedShopParam = typeof resolvedSearch?.shop === "string" ? resolvedSearch.shop : undefined;
  if (resolvedShopParam) {
    initialValues.shopNumber = resolvedShopParam;
  }

  // If a people employee profile id is provided, prefill the form with existing data.
  const resolvedId = typeof (resolvedSearch as any)?.id === "string" ? (resolvedSearch as any).id : undefined;
  if (form.slug === "people-employee-profile" && resolvedId) {
    try {
      const { data: staffRow, error } = await supabase.from("shop_staff").select("*").eq("id", resolvedId).maybeSingle();
      if (!error && staffRow) {
        initialValues = {
          staffName: staffRow.staff_name ?? "",
          phoneNumber: staffRow.employee_phone_number ?? "",
          hireDate: staffRow.date_of_hired ?? "",
          dateOfBirth: staffRow.birth_date ?? "",
          favoriteTreat: staffRow.celebration_profile_json?.favoriteTreat ?? "",
          celebrationNotes: staffRow.celebration_profile_json?.celebrationNotes ?? "",
          id: staffRow.id,
          shopNumber: resolvedShopParam ?? undefined,
        } as Record<string, FieldValue>;
      }
    } catch (err) {
      console.warn("Unable to prefill employee profile form", err);
    }
  }

  const selectedDateLabel = resolvedDateParam
    ? new Date(resolvedDateParam).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
    : null;

  // If `wizard=1` was passed for the people profile form, render the client-side wizard
  type SearchParamsShape = { wizard?: string };
  const resolvedSearchTyped = resolvedSearch as unknown as SearchParamsShape;
  const isWizard = form.slug === "people-employee-profile" && resolvedSearchTyped.wizard === "1";

  if (isWizard) {
    return <EmployeeProfileWizardClient shopNumber={resolvedShopParam ?? null} initialValues={Object.keys(initialValues).length ? initialValues : undefined} />;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-8">
        <Link
          href="/pocket-manager5"
          className="inline-flex items-center gap-2 text-sm font-semibold text-pm5-teal transition hover:text-pm5-teal"
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
              {form.supabaseTable && <p className="text-pm5-teal">Supabase · {form.supabaseTable}</p>}
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
