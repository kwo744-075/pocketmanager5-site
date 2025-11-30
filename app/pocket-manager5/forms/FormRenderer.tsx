"use client";

import { useMemo, useState } from "react";
import { usePocketHierarchy } from "@/hooks/usePocketHierarchy";
import type { FormConfig, FormField } from "./formRegistry";

type FormStatus = "idle" | "saving" | "saved" | "error";
export type FieldValue = string | number | string[] | null | undefined;

const baseInputClasses =
  "w-full rounded-2xl border border-slate-800/60 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500";

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

function getDefaultValue(field: FormField): FieldValue {
  if (field.type === "checklist") {
    return [];
  }
  return "";
}

type FormRendererProps = {
  form: FormConfig;
  initialValues?: Record<string, FieldValue>;
  storageKey?: string;
  persistLocally?: boolean;
  contextPath?: string;
  onAfterSubmit?: (payload: { values: Record<string, FieldValue>; savedAt: string | null }) => void;
  hideStatusPanel?: boolean;
  submitLabelOverride?: string;
};

export function FormRenderer({
  form,
  initialValues,
  storageKey,
  persistLocally = true,
  contextPath,
  onAfterSubmit,
  hideStatusPanel = false,
  submitLabelOverride,
}: FormRendererProps) {
  const resolvedStorageKey = storageKey ?? `pm-form-${form.slug}`;
  const { loginEmail, hierarchy, shopMeta, storedShopName } = usePocketHierarchy(contextPath ?? `/pocket-manager5/forms/${form.slug}`);
  const readStoredPayload = () => {
    if (!persistLocally || typeof window === "undefined") {
      return null;
    }
    try {
      const raw = window.localStorage.getItem(resolvedStorageKey);
      if (!raw) return null;
      return JSON.parse(raw) as { data?: Record<string, FieldValue>; savedAt?: string };
    } catch (error) {
      console.warn("Unable to hydrate form state", error);
      return null;
    }
  };

  const stored = readStoredPayload();
  const [values, setValues] = useState<Record<string, FieldValue>>(stored?.data ?? initialValues ?? {});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [lastSaved, setLastSaved] = useState<string | null>(stored?.savedAt ?? null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const mergedValues = useMemo(() => {
    const filled: Record<string, FieldValue> = {};
    for (const section of form.sections) {
      for (const field of section.fields) {
        const current = values[field.name];
        filled[field.name] = current ?? getDefaultValue(field);
      }
    }
    return filled;
  }, [form.sections, values]);

  const handleChange = (name: string, newValue: FieldValue) => {
    setValues((prev) => ({ ...prev, [name]: newValue }));
    setStatus("idle");
  };

  const handleChecklistToggle = (name: string, itemId: string) => {
    const current = (mergedValues[name] as string[]) ?? [];
    const isChecked = current.includes(itemId);
    const nextValue = isChecked ? current.filter((id) => id !== itemId) : [...current, itemId];
    handleChange(name, nextValue);
  };

  const persistDraft = () => {
    const savedAt = new Date().toISOString();
    if (persistLocally && typeof window !== "undefined") {
      const payload = { form: form.slug, feature: form.feature, savedAt, data: mergedValues };
      window.localStorage.setItem(resolvedStorageKey, JSON.stringify(payload));
    }
    setLastSaved(savedAt);
    return savedAt;
  };

  const syncToSupabase = async () => {
    const response = await fetch("/api/pocket-manager/forms/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slug: form.slug,
        data: mergedValues,
        context: {
          loginEmail,
          storedShopName,
          shopId: shopMeta?.id ?? null,
          shopNumber: shopMeta?.shop_number ?? null,
          shopName: shopMeta?.shop_name ?? null,
          hierarchy,
        },
      }),
    });

    let payload: { message?: string; error?: string } = {};
    try {
      payload = (await response.json()) as typeof payload;
    } catch (error) {
      console.warn("Unable to parse Supabase response", error);
    }

    if (!response.ok) {
      throw new Error(payload?.error ?? "Supabase sync failed.");
    }

    return payload.message ?? "Synced to Supabase.";
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("saving");
    setServerMessage(null);
    setServerError(null);

    let savedAt: string | null = null;

    try {
      savedAt = persistDraft();

      if (!form.supabaseTable) {
        setStatus("saved");
        setServerMessage(form.successMessage ?? "Saved locally.");
        onAfterSubmit?.({ values: mergedValues, savedAt });
        return;
      }

      try {
        const message = await syncToSupabase();
        setStatus("saved");
        setServerMessage(message);
        onAfterSubmit?.({ values: mergedValues, savedAt });
      } catch (error) {
        console.error("Supabase sync failed", error);
        setStatus("error");
        setServerError(
          error instanceof Error
            ? `Draft saved locally, but Supabase sync failed: ${error.message}`
            : "Draft saved locally, but Supabase sync failed."
        );
      }
    } catch (error) {
      console.error("Unable to save form", error);
      setStatus("error");
      setServerError(error instanceof Error ? error.message : "Unable to save form.");
    }
  };

  const handleCopy = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(mergedValues, null, 2));
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2500);
    } catch (error) {
      console.warn("Unable to copy", error);
    }
  };

  const statusLabel =
    status === "saving"
      ? "Saving…"
      : status === "saved"
      ? form.successMessage ?? "Saved"
      : status === "error"
      ? "Unable to save — try again"
      : lastSaved
      ? `Last saved ${new Date(lastSaved).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : "Not saved";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {form.sections.map((section) => (
        <section key={section.title} className="rounded-3xl border border-slate-900/70 bg-slate-950/70 p-6 shadow-2xl shadow-black/30">
          <header className="mb-5">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{form.title}</p>
            <h2 className="text-2xl font-semibold text-white">{section.title}</h2>
            {section.description && <p className="mt-2 text-sm text-slate-400">{section.description}</p>}
          </header>
          <div className="space-y-5">
            {section.fields.map((field) => (
              <FieldRenderer
                key={field.name}
                field={field}
                value={mergedValues[field.name]}
                onChange={(value) => handleChange(field.name, value)}
                onChecklistToggle={(itemId) => handleChecklistToggle(field.name, itemId)}
              />
            ))}
          </div>
        </section>
      ))}

      {hideStatusPanel ? (
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-5 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
          >
            {submitLabelOverride ?? form.submitLabel ?? "Save"}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-900/70 bg-slate-950/80 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Status</p>
            <p className="text-sm text-slate-200">{statusLabel}</p>
            {serverMessage && <p className="text-xs text-emerald-300">{serverMessage}</p>}
            {serverError && <p className="text-xs text-rose-300">{serverError}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-full border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-emerald-400/60 hover:text-emerald-100"
            >
              {copyState === "copied" ? "Copied ✓" : "Copy JSON"}
            </button>
            <button
              type="submit"
              className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-5 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
            >
              {submitLabelOverride ?? form.submitLabel ?? "Save"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
  onChecklistToggle,
}: {
  field: FormField;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  onChecklistToggle: (itemId: string) => void;
}) {
  if (field.type === "checklist") {
    const selected = (value as string[]) ?? [];
    return (
      <div>
        <label className="text-sm font-semibold text-white">{field.label}</label>
        {field.helpText && <p className="text-xs text-slate-500">{field.helpText}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {field.items.map((item) => {
            const active = selected.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChecklistToggle(item.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition",
                  active
                    ? "border-emerald-400/70 bg-emerald-500/10 text-emerald-100"
                    : "border-slate-800/70 text-slate-300 hover:border-slate-600"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div>
        <label className="text-sm font-semibold text-white">{field.label}</label>
        {field.helpText && <p className="text-xs text-slate-500">{field.helpText}</p>}
        <select
          className={cn(baseInputClasses, "bg-slate-950/80")}
          value={(value as string) ?? ""}
          required={field.required}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{field.placeholder ?? "Select"}</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const inputProps = {
    className: baseInputClasses,
    placeholder: field.placeholder,
    required: field.required,
    value: (value as string | number | undefined) ?? "",
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
  };

  if (field.type === "textarea") {
    return (
      <div>
        <label className="text-sm font-semibold text-white">{field.label}</label>
        {field.helpText && <p className="text-xs text-slate-500">{field.helpText}</p>}
        <textarea {...inputProps} rows={4} className={cn(baseInputClasses, "min-h-[120px]")} />
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <div>
        <label className="text-sm font-semibold text-white">{field.label}</label>
        <input
          {...inputProps}
          type="date"
          className={cn(baseInputClasses, "pr-3")}
        />
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div>
        <label className="text-sm font-semibold text-white">{field.label}</label>
        {field.helpText && <p className="text-xs text-slate-500">{field.helpText}</p>}
        <input
          {...inputProps}
          type="number"
          min={field.min}
          max={field.max}
          step={field.step}
        />
      </div>
    );
  }

  return (
    <div>
      <label className="text-sm font-semibold text-white">{field.label}</label>
      <input {...inputProps} type="text" />
    </div>
  );
}
