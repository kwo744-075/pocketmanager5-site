import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type FinancialRow = {
  id: string;
  label: string;
  budget: number | "";
  actual: number | "";
};

type KpiRow = {
  id: string;
  label: string;
  target: number | "";
  actual: number | "";
};

type PresenterFormData = {
  districtName: string;
  dmName: string;
  period: string;
  year: string;
  financials: FinancialRow[];
  kpis: KpiRow[];
  turnoverNotes: string;
  staffingNotes: string;
  talentSnapshot: string;
  regionNotes: string;
};

const defaultFinancials: FinancialRow[] = [
  { id: "sales", label: "Sales", budget: "", actual: "" },
  { id: "cars", label: "Cars", budget: "", actual: "" },
  { id: "labor", label: "Labor %", budget: "", actual: "" },
  { id: "profit", label: "Profit", budget: "", actual: "" },
];

const defaultKpis: KpiRow[] = [
  { id: "big4", label: "Big 4 %", target: "", actual: "" },
  { id: "aro", label: "ARO $", target: "", actual: "" },
  { id: "mobil1", label: "Mobil 1 %", target: "", actual: "" },
  { id: "coolants", label: "Coolants %", target: "", actual: "" },
  { id: "diffs", label: "Diffs %", target: "", actual: "" },
];

export default function MonthlyBizReviewPage() {
  const [loading, setLoading] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [form, setForm] = useState<PresenterFormData>({
    districtName: "",
    dmName: "",
    period: "",
    year: new Date().getFullYear().toString(),
    financials: defaultFinancials,
    kpis: defaultKpis,
    turnoverNotes: "",
    staffingNotes: "",
    talentSnapshot: "",
    regionNotes: "",
  });

  const updateField = (field: keyof PresenterFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateFinancial = (
    id: string,
    key: keyof Omit<FinancialRow, "id" | "label">,
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      financials: prev.financials.map((row) =>
        row.id === id ? { ...row, [key]: value === "" ? "" : Number(value) } : row
      ),
    }));
  };

  const updateKpi = (
    id: string,
    key: keyof Omit<KpiRow, "id" | "label">,
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      kpis: prev.kpis.map((row) =>
        row.id === id ? { ...row, [key]: value === "" ? "" : Number(value) } : row
      ),
    }));
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMessage("Uploading & parsing file…");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/presenter/upload-excel", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const json = await res.json();

      if (json.ok) {
        setForm((prev) => ({
          ...prev,
          financials: json.financials ?? prev.financials,
          kpis: json.kpis ?? prev.kpis,
        }));
        setMessage("File parsed and mapped into financials / KPIs.");
      } else {
        setMessage("Failed to map data.");
      }
    } catch (err) {
      console.error(err);
      setMessage("Error uploading file.");
    }
  };

  const loadDraft = useCallback(
    async (announce = false) => {
      if (!authUserId) {
        if (announce) {
          setMessage("You must be logged in to load drafts.");
        }
        return;
      }

      if (announce) {
        setLoadingDraft(true);
        setMessage("Loading latest draft…");
      }

      try {
        const params = new URLSearchParams();
        if (form.period) params.append("period", form.period);
        if (form.year) params.append("year", form.year);

        const query = params.toString();
        const res = await fetch(`/api/presenter/load-draft${query ? `?${query}` : ""}`);
        if (!res.ok) throw new Error("Load failed");
        const json = await res.json();

        if (json.ok && json.draft) {
          const draftValues = { ...json.draft };
          if ("userId" in draftValues) {
            delete (draftValues as Record<string, unknown>).userId;
          }
          setForm((prev) => ({ ...prev, ...(draftValues as Partial<PresenterFormData>) }));
          if (announce) {
            setMessage("Draft loaded.");
          }
        } else if (announce) {
          setMessage("No draft found for that selection.");
        }
      } catch (err) {
        console.error(err);
        if (announce) {
          setMessage("Error loading draft.");
        }
      } finally {
        if (announce) {
          setLoadingDraft(false);
        }
      }
    },
    [authUserId, form.period, form.year]
  );

  useEffect(() => {
    let isMounted = true;

    const hydrateSession = async () => {
      setAuthLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        if (!isMounted) return;
        const sessionUserId = data.session?.user?.id ?? null;
        setAuthUserId(sessionUserId);
        if (sessionUserId) {
          setMessage(null);
          loadDraft(false).catch((err) => console.error("auto load draft", err));
        } else {
          setMessage("Sign in to load and save Monthly Biz Review drafts.");
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    hydrateSession().catch((err) => console.error("auth session load", err));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      const sessionUserId = session?.user?.id ?? null;
      setAuthUserId(sessionUserId);
      if (sessionUserId) {
        setMessage(null);
        loadDraft(false).catch((err) => console.error("auto load draft", err));
      } else {
        setMessage("Sign in to load and save Monthly Biz Review drafts.");
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadDraft]);

  const handleSaveDraft = async () => {
    if (!authUserId) {
      setMessage("You must be logged in to save drafts.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/presenter/save-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Save failed");
      setMessage("Draft saved.");
    } catch (err) {
      console.error(err);
      setMessage("Error saving draft.");
    } finally {
      setSaving(false);
    }
  };

  const handleLoadDraft = async () => {
    await loadDraft(true);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/presenter/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Generate failed");

      // Expecting a blob (pptx or pdf)
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `DM_Monthly_Biz_Review_${form.districtName}_P${form.period}_${form.year}.pptx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setMessage("Presentation generated.");
    } catch (err) {
      console.error(err);
      setMessage("Error generating presentation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              DM Monthly Business Review Presenter
            </h1>
            <p className="text-sm text-slate-500">
              Build a district business review deck from your DM data.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleLoadDraft}
              disabled={loadingDraft || !authUserId || authLoading}
              className="rounded-md bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-300 disabled:opacity-60"
            >
              {loadingDraft ? "Loading…" : "Load Draft"}
            </button>
            <button
              onClick={handleSaveDraft}
              disabled={saving || !authUserId || authLoading}
              className="rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Draft"}
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {loading ? "Generating…" : "Generate Presentation"}
            </button>
          </div>
        </header>

        {message && (
          <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-slate-800">
            {message}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {/* LEFT: FORM */}
          <div className="md:col-span-2 space-y-4">
            {/* Header Info */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                District Info
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500">
                    District Name
                  </label>
                  <input
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    value={form.districtName}
                    onChange={(e) => updateField("districtName", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500">
                    DM Name
                  </label>
                  <input
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    value={form.dmName}
                    onChange={(e) => updateField("dmName", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500">
                    Period
                  </label>
                  <input
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    placeholder="8"
                    value={form.period}
                    onChange={(e) => updateField("period", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500">
                    Year
                  </label>
                  <input
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    value={form.year}
                    onChange={(e) => updateField("year", e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* Upload Section */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Upload Data (Optional)
              </h2>
              <p className="mb-2 text-xs text-slate-500">
                Upload your consolidated P&L, KPI export, or other Excel file to map
                into financials / KPI fields later.
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleExcelUpload}
                className="text-xs"
              />
            </section>

            {/* Financials */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Financial Results (Budget vs Actual)
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-2 py-2 font-semibold">Metric</th>
                      <th className="px-2 py-2 font-semibold">Budget</th>
                      <th className="px-2 py-2 font-semibold">Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.financials.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100">
                        <td className="px-2 py-1">{row.label}</td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            className="w-full rounded-md border border-slate-300 px-1 py-0.5 text-xs"
                            value={row.budget}
                            onChange={(e) =>
                              updateFinancial(row.id, "budget", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            className="w-full rounded-md border border-slate-300 px-1 py-0.5 text-xs"
                            value={row.actual}
                            onChange={(e) =>
                              updateFinancial(row.id, "actual", e.target.value)
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* KPI Breakdown */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                KPI Breakdown
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-2 py-2 font-semibold">KPI</th>
                      <th className="px-2 py-2 font-semibold">Target</th>
                      <th className="px-2 py-2 font-semibold">Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.kpis.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100">
                        <td className="px-2 py-1">{row.label}</td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            className="w-full rounded-md border border-slate-300 px-1 py-0.5 text-xs"
                            value={row.target}
                            onChange={(e) =>
                              updateKpi(row.id, "target", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            className="w-full rounded-md border border-slate-300 px-1 py-0.5 text-xs"
                            value={row.actual}
                            onChange={(e) =>
                              updateKpi(row.id, "actual", e.target.value)
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Notes sections */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <TextAreaField
                label="Turnover / Retention Notes"
                value={form.turnoverNotes}
                onChange={(value) => updateField("turnoverNotes", value)}
              />
              <TextAreaField
                label="Staffing & Bench Notes"
                value={form.staffingNotes}
                onChange={(value) => updateField("staffingNotes", value)}
              />
              <TextAreaField
                label="Talent Snapshot / Top Performers"
                value={form.talentSnapshot}
                onChange={(value) => updateField("talentSnapshot", value)}
              />
              <TextAreaField
                label="Additional Region Notes"
                value={form.regionNotes}
                onChange={(value) => updateField("regionNotes", value)}
              />
            </section>
          </div>

          {/* RIGHT: SIMPLE PREVIEW */}
          <aside className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Slide Preview (Summary)
              </h2>
              <div className="rounded-lg border border-slate-200 bg-slate-900 p-4 text-xs text-white">
                <div className="mb-3">
                  <p className="text-[10px] uppercase text-yellow-300">
                    DM Monthly Business Review
                  </p>
                  <p className="text-sm font-semibold">
                    {form.districtName || "District Name"}
                  </p>
                  <p className="text-[11px] text-slate-200">
                    {`DM: ${form.dmName || "Name"} • P${form.period || "?"} ${
                      form.year
                    }`}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="font-semibold text-[11px] text-red-300">
                    Financial Highlights
                  </p>
                  <ul className="space-y-1">
                    {form.financials.map((row) => {
                      const variance =
                        row.budget !== "" && row.actual !== ""
                          ? (row.actual as number) - (row.budget as number)
                          : null;
                      return (
                        <li key={row.id} className="flex justify-between">
                          <span>{row.label}</span>
                          <span>
                            {row.actual !== "" ? row.actual : "-"}{" "}
                            {variance !== null && (
                              <span
                                className={
                                  variance >= 0 ? "text-green-300" : "text-red-300"
                                }
                              >
                                ({variance >= 0 ? "+" : ""}
                                {variance})
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="mt-3">
                  <p className="font-semibold text-[11px] text-red-300">
                    KPI Snapshot
                  </p>
                  <ul className="space-y-1">
                    {form.kpis.map((row) => {
                      const diff =
                        row.target !== "" && row.actual !== ""
                          ? (row.actual as number) - (row.target as number)
                          : null;
                      return (
                        <li key={row.id} className="flex justify-between">
                          <span>{row.label}</span>
                          <span
                            className={
                              diff !== null
                                ? diff >= 0
                                  ? "text-green-300"
                                  : "text-red-300"
                                : ""
                            }
                          >
                            {row.actual !== "" ? row.actual : "-"}
                            {diff !== null && ` (${diff >= 0 ? "+" : ""}${diff})`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-sm">
              <p className="font-semibold mb-1">How this will work later</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Form data is sent to an API route.</li>
                <li>API uses pptxgenjs to clone your DM PPT template.</li>
                <li>Fields map into text boxes & charts on each slide.</li>
                <li>Returns a downloadable PPTX (and eventually PDF).</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

type TextAreaFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function TextAreaField({ label, value, onChange }: TextAreaFieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">
        {label}
      </label>
      <textarea
        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs min-h-[70px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
