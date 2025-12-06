import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { resolvePermittedShopNumber } from "@/lib/auth/alignment";
import { FEATURE_LOOKUP, getDocUrl } from "../../featureRegistry";
import { fetchInventoryCategoryItems } from "@/lib/inventoryPreview";
import { InventoryCategoryTable } from "../components/InventoryCategoryTable";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const getFirstParamValue = (value?: string | string[]) => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

const resolveShopParam = (search?: Record<string, string | string[] | undefined>) => {
  if (!search) return null;
  for (const key of ["shop", "shopId"]) {
    const value = getFirstParamValue(search[key]);
    if (value) return value;
  }
  return null;
};

export default async function InventoryCategoryPage({ params, searchParams }: CategoryPageProps) {
  const { category } = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const session = await getServerSession();
  const shopNumber = resolvePermittedShopNumber(session.alignment, resolveShopParam(resolvedSearch));

  const feature = FEATURE_LOOKUP["inventory"];
  if (!feature) notFound();

  const decodedCategory = decodeURIComponent(category);
  const { items, lastSync } = await fetchInventoryCategoryItems(shopNumber, decodedCategory);
  const docUrl = getDocUrl(feature);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-12 space-y-8">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/pocket-manager5" className="text-emerald-200 hover:text-emerald-100">
            Pocket Manager5
          </Link>
          <span className="text-slate-500">/</span>
          <Link href="/pocket-manager5/features/inventory" className="text-emerald-200 hover:text-emerald-100">
            Inventory
          </Link>
          <span className="text-slate-500">/</span>
          <span className="text-slate-300">{decodedCategory}</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Inventory category</p>
            <h1 className="text-4xl font-semibold text-white">{decodedCategory}</h1>
            <p className="text-sm text-slate-300">Showing live worksheet counts for the selected shop.</p>
          </div>
          {docUrl ? (
            <Link
              href={docUrl}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-100 transition hover:border-emerald-300/80"
              target="_blank"
              rel="noreferrer noopener"
            >
              View spec ↗
            </Link>
          ) : null}
        </div>

        <InventoryCategoryTable category={decodedCategory} shopNumber={shopNumber} lastSync={lastSync} items={items} />
      </div>
    </main>
  );
}
