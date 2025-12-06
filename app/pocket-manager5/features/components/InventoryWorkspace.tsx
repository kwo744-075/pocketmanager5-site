import Link from "next/link";
import { ClipboardList, Droplets, Boxes, Wind, GlassWater, Package, ArrowUpRight } from "lucide-react";
import type { FeatureMeta } from "../../featureRegistry";
import type { FormConfig } from "../../forms/formRegistry";
import type { CSSProperties } from "react";
import type { InventoryPreview } from "@/lib/inventoryPreview";

export type InventoryWorkspaceProps = {
  feature: FeatureMeta;
  docUrl?: string;
  relatedForms: FormConfig[];
  shopNumber: string | null;
  preview: InventoryPreview;
};

const categoryIcon = (name: string) => {
  switch (name) {
    case "Oils":
      return Droplets;
    case "Oil Filters":
      return Boxes;
    case "Air Filters":
      return Wind;
    case "Wipers":
      return GlassWater;
    case "Cabin Filters":
      return Package;
    default:
      return ClipboardList;
  }
};

const varianceTone = (variance: number) => {
  if (variance > 0) return "text-emerald-200";
  if (variance < 0) return "text-amber-200";
  return "text-slate-200";
};

const formatNumber = (value: number) => value.toLocaleString("en-US");

export function InventoryWorkspace({ feature, docUrl, relatedForms, shopNumber, preview }: InventoryWorkspaceProps) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-12 space-y-10">
        <Link
          href="/pocket-manager5"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 transition hover:text-emerald-100"
        >
          <span aria-hidden>↩</span> Back to Pocket Manager5
        </Link>

        <section className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-8 shadow-2xl shadow-black/40 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Inventory workspace</p>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-semibold text-white">{feature.title}</h1>
                <span className="rounded-full border border-slate-800/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
                  {feature.status}
                </span>
              </div>
              <p className="text-lg text-slate-300 max-w-2xl">{feature.summary}</p>
              <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                <div className="rounded-xl border border-slate-800/70 bg-slate-900/70 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Native route</p>
                  <p className="mt-1 font-mono text-emerald-200">{feature.platformRoute}</p>
                </div>
                <div className="rounded-xl border border-slate-800/70 bg-slate-900/70 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Shop</p>
                  <p className="mt-1 font-semibold text-white">{shopNumber ?? "Any"}</p>
                  <p className="text-xs text-slate-400">Aligns with the Expo inventory view.</p>
                </div>
                <div className="rounded-xl border border-slate-800/70 bg-slate-900/70 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Last sync</p>
                  <p className="mt-1 font-semibold text-white">{preview.lastSync}</p>
                  <p className="text-xs text-slate-400">Pulled from inventory counts.</p>
                </div>
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-200">Export</p>
                  <Link
                    href={`/pocket-manager5/api/inventory/export?shop=${shopNumber ?? ""}`}
                    className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-emerald-100 underline-offset-4 transition hover:text-white hover:underline"
                  >
                    Download Excel (CSV)
                    <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <p className="text-[11px] text-emerald-200/80">Uses live counts and catalog mapping.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 text-sm text-slate-300">
              {docUrl ? (
                <Link
                  href={docUrl}
                  className="inline-flex items-center justify-between gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 font-semibold text-emerald-100 transition hover:border-emerald-400/70 hover:text-white"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  View spec <ArrowUpRight className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
              {relatedForms.length > 0 ? (
                <div className="rounded-xl border border-slate-800/70 bg-slate-900/70 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Forms</p>
                  <div className="mt-2 flex flex-col gap-2">
                    {relatedForms.map((form) => (
                      <Link
                        key={form.slug}
                        href={`/pocket-manager5/forms/${form.slug}${shopNumber ? `?shop=${shopNumber}` : ""}`}
                        className="inline-flex items-center gap-2 text-emerald-200 underline-offset-4 transition hover:text-emerald-100 hover:underline"
                      >
                        {form.title} ↗
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="SKUs tracked" value={formatNumber(preview.totals.skuCount)} detail="Includes oils, filters, and wipers." />
            <StatCard label="Storage units" value={formatNumber(preview.totals.storageUnits)} detail="Floor + storage counts (non-oils)." />
            <StatCard label="Oil units" value={formatNumber(preview.totals.oilUnits)} detail="5W30, 0W20, 0W16 blends." />
            <StatCard label="Variance" value={formatNumber(preview.totals.variance)} detail="On-hand totals from counts." tone={preview.totals.variance <= 0 ? "neutral" : "positive"} />
          </div>

          {preview.alerts.length > 0 ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <p className="font-semibold">Live alerts</p>
              <ul className="mt-2 space-y-1 list-disc pl-5">
                {preview.alerts.map((alert) => (
                  <li key={alert}>{alert}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {preview.categories.map((category) => {
              const Icon = categoryIcon(category.name);
              const tileStyle: CSSProperties = {
                background: `linear-gradient(145deg, ${category.color}22, ${category.color}44)`
              };
              return (
                <article
                  key={category.name}
                  className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4 shadow-lg shadow-black/30"
                  style={tileStyle}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="rounded-xl bg-slate-950/50 p-2 ring-1 ring-white/10">
                        <Icon className="h-5 w-5 text-white" aria-hidden />
                      </span>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-200">{category.name}</p>
                        <p className="text-2xl font-semibold text-white">{formatNumber(category.skuCount)} items</p>
                      </div>
                    </div>
                    <span className={`rounded-full border border-white/10 px-3 py-1 text-xs font-semibold ${varianceTone(category.variance)}`}>
                      {category.variance > 0 ? "+" : ""}
                      {category.variance}
                      <span className="text-[11px] uppercase tracking-[0.2em] text-slate-200"> qty</span>
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-200">
                    Matches mobile tiles with the same color scheme. Counts mirror the Expo inventory list for the selected shop.
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-200/90">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-white/80" aria-hidden />
                      <p>Variance reflects the latest import.</p>
                    </div>
                    <Link
                      className="text-emerald-100 underline-offset-4 transition hover:text-white hover:underline"
                      href={`/pocket-manager5/features/inventory/${encodeURIComponent(category.name)}`}
                    >
                      Open category
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          <section className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/70 pb-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Storage vs oil</p>
                <p className="text-lg font-semibold text-white">Catalog balance</p>
              </div>
              <div className="flex gap-2 text-xs text-slate-300">
                <Badge label="Mobile parity" />
                <Badge label="Color matched" />
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <SummaryRow label="On hold" value={formatNumber(preview.totals.onHold)} />
              <SummaryRow label="Total units" value={formatNumber(preview.totals.variance)} tone={preview.totals.variance <= 0 ? "neutral" : "positive"} />
              <SummaryRow label="Oil units" value={formatNumber(preview.totals.oilUnits)} />
              <SummaryRow label="Storage units" value={formatNumber(preview.totals.storageUnits)} />
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail?: string; tone?: "neutral" | "positive" }) {
  const toneClass = tone === "positive" ? "text-emerald-200" : "text-slate-100";
  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {detail ? <p className="text-sm text-slate-400">{detail}</p> : null}
    </div>
  );
}

function SummaryRow({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "positive" }) {
  const toneClass = tone === "positive" ? "text-emerald-200" : "text-slate-200";
  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{label}</p>
      <p className={`text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return <span className="rounded-full border border-slate-800/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-300">{label}</span>;
}
