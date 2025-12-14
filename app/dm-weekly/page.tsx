import SlidePreview from "./components/SlidePreview";
import KpiSummary from "./components/KpiSummary";
import KpiMapper from "./components/KpiMapper";

export const runtime = "edge";

export default function Page() {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">DM Weekly Presenter</h1>
        <div className="text-sm text-slate-400">Uses dark theme & site card styles</div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
            <h2 className="mb-3 text-lg font-medium">Slide Preview</h2>
            <SlidePreview />
          </div>
        </div>

        <div>
          <div className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-4 mb-4">
            <h2 className="mb-3 text-lg font-medium">KPI Summary</h2>
            <KpiSummary />
          </div>

          <div className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-4">
            <h2 className="mb-3 text-lg font-medium">KPI Mapper</h2>
            <KpiMapper />
          </div>
        </div>
      </div>
    </div>
  );
}
