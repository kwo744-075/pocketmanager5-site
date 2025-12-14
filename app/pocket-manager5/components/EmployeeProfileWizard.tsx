"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormRenderer } from "../forms/FormRenderer";
import { FORM_LOOKUP } from "../forms/formRegistry";

type Props = {
  shopNumber?: string | null;
  initialValues?: Record<string, any>;
  onSaved?: (payload: { values: Record<string, any>; savedAt: string | null }) => void;
  onCancel?: () => void;
};

export default function EmployeeProfileWizard({ shopNumber, initialValues, onSaved, onCancel }: Props) {
  const form = FORM_LOOKUP["people-employee-profile"];
  const steps = form.sections.length;
  const [step, setStep] = useState(0);
  const formId = "employee-profile-wizard-form";
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  const isPeopleProfile = form.slug === "people-employee-profile";

  // Focus management: focus first focusable element when dialog mounts or step changes
  useEffect(() => {
    const root = dialogRef.current;
    if (!root) return;
    const focusable = root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    if (first) first.focus();

    // Simple focus trap
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = Array.from(root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      }
    };

    root.addEventListener("keydown", handleKey);
    return () => root.removeEventListener("keydown", handleKey);
  }, [step]);

  const onPrev = () => setStep((s) => Math.max(0, s - 1));
  const onNext = () => setStep((s) => Math.min(steps - 1, s + 1));

  const handleAfterSubmit = async (payload: { values: Record<string, any>; savedAt: string | null }) => {
    try {
      // Refresh server-rendered data on the page so roster preview updates
      try {
        router.refresh();
      } catch (err) {
        // ignore router refresh errors
      }
      onSaved?.(payload);
    } catch (err) {
      // swallow
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="employee-profile-title"
      className={`${onCancel ? '' : 'min-h-screen'} bg-slate-950 text-slate-100`}
    >
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          {onCancel ? (
            <button onClick={onCancel} className="text-sm text-slate-300">Close</button>
          ) : (
            <Link href="/pocket-manager5" className="text-sm text-slate-300">↩ Back</Link>
          )}
          {!isPeopleProfile && <div className="text-sm text-slate-400">Step {step + 1} of {steps}</div>}
        </div>

        <section className="rounded-3xl border border-slate-900/70 bg-slate-950/70 p-6">
          <h1 id="employee-profile-title" className="text-2xl font-semibold text-white">Employee profile</h1>
          <p className="mt-2 text-sm text-slate-300">Walk through the profile fields. You can save at any step.</p>

          <div className="mt-6">
            <FormRenderer
              form={form}
              initialValues={initialValues}
              hideStatusPanel={isPeopleProfile ? false : true}
              // For people profile we show the whole merged form on a single page
              renderSectionIndex={isPeopleProfile ? null : step}
              formId={formId}
              onAfterSubmit={handleAfterSubmit}
            />
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div>
              {(!isPeopleProfile && step > 0) && (
                <button onClick={onPrev} type="button" className="rounded-full border px-4 py-2 text-sm text-slate-200 hover:bg-slate-900/60">
                  ← Prev
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {(!isPeopleProfile && step < steps - 1) ? (
                <button onClick={onNext} type="button" className="rounded-full border pm5-teal-border pm5-teal-soft px-4 py-2 text-sm font-semibold text-pm5-teal transition hover:pm5-teal-soft">
                  Next →
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
