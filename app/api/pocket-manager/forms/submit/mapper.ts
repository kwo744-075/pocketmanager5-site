import type { FormSlug } from "@/app/pocket-manager5/forms/formRegistry";
import type { HierarchySummary } from "@/hooks/usePocketHierarchy";

export type SubmissionContext = {
  loginEmail?: string | null;
  storedShopName?: string | null;
  shopId?: string | null;
  shopNumber?: string | number | null;
  shopName?: string | null;
  hierarchy?: HierarchySummary | null;
};

export type ProfileRow = {
  user_id: string;
  email: string;
  full_name?: string | null;
};

export type SubmissionPlan = {
  table: string;
  payload: Record<string, unknown>;
};

export class SubmissionValidationError extends Error {}

export async function buildSubmissionPlan(
  slug: FormSlug,
  data: Record<string, unknown>,
  context: SubmissionContext,
  profile: ProfileRow | null
): Promise<SubmissionPlan | null> {
  if (slug === "dm-visit-plan") {
    return buildVisitPlanSubmission(data, context, profile);
  }

  if (slug === "dm-visit-log") {
    return buildVisitLogSubmission(data, context);
  }

  if (slug === "dm-30-60-90") {
    return buildPlaybookSubmission(data, context, profile);
  }

  if (slug === "dm-action-plan") {
    return buildActionPlanSubmission(data, context, profile);
  }

  if (slug === "people-employee-profile") {
    return buildEmployeeProfileSubmission(data, context);
  }

  if (slug === "people-phone-sheet") {
    return buildPhoneSheetSubmission(data, context, profile);
  }

  return null;
}

function buildVisitPlanSubmission(
  data: Record<string, unknown>,
  context: SubmissionContext,
  profile: ProfileRow | null
): SubmissionPlan | null {
  const dmId = profile?.user_id;
  const date = stringValue(data["visitDate"]);
  const visitType = stringValue(data["visitType"]);
  const shopNumberField = stringValue(data["shopNumber"]) ?? normalizeShopNumber(context.shopNumber);

  if (!dmId) {
    throw new SubmissionValidationError("Unable to resolve DM profile for visit plan submission.");
  }

  if (!date) {
    throw new SubmissionValidationError("Visit date is required.");
  }

  if (!visitType) {
    throw new SubmissionValidationError("Visit type is required.");
  }

  if (!shopNumberField) {
    throw new SubmissionValidationError("Shop number is required for visit plan submissions.");
  }

  const prepChecklist = Array.isArray(data["prepChecklist"]) ? (data["prepChecklist"] as string[]) : [];
  const details = [
    data["visitWindow"] ? `Window: ${data["visitWindow"]}` : null,
    prepChecklist.length ? `Prep checklist: ${prepChecklist.join(", ")}` : null,
    data["prepNotes"] ? `Prep notes: ${data["prepNotes"]}` : null,
    data["peopleFocus"] ? `People: ${data["peopleFocus"]}` : null,
    data["operationsFocus"] ? `Operations: ${data["operationsFocus"]}` : null,
    data["growthFocus"] ? `Growth: ${data["growthFocus"]}` : null,
    data["successMetrics"] ? `Success metrics: ${data["successMetrics"]}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    table: "dm_schedule",
    payload: pruneUndefined({
      dm_id: dmId,
      date,
      location_id: shopNumberField,
      location_text: context.shopName ?? shopNumberField,
      visit_type: visitType,
      notes: details || null,
      created_by: dmId,
    }),
  };
}

function buildVisitLogSubmission(data: Record<string, unknown>, context: SubmissionContext): SubmissionPlan | null {
  const shopNumber = stringValue(data["shopNumber"]) ?? normalizeShopNumber(context.shopNumber);

  if (!shopNumber) {
    throw new SubmissionValidationError("Shop number is required for log submissions.");
  }

  const logDate = stringValue(data["logDate"]) ?? new Date().toISOString().slice(0, 10);
  const scoreValue = numericValue(data["score"]);
  const logType = stringValue(data["logType"]) ?? "dm_visit";

  const formData = {
    visitType: stringValue(data["visitType"]) ?? null,
    headline: stringValue(data["headline"]) ?? null,
    coachingNotes: stringValue(data["coachingNotes"]) ?? null,
    followUps: stringValue(data["followUps"]) ?? null,
    attachments: stringValue(data["attachments"]) ?? null,
    raw: data,
  };

  return {
    table: "dm_logbook",
    payload: pruneUndefined({
      log_type: logType,
      log_date: logDate,
      shop_number: shopNumber,
      shop_id: context.shopId ?? null,
      submitted_by: context.storedShopName ?? context.loginEmail ?? "PocketManager5",
      scoring_percentage: scoreValue,
      immediate_fixes_required: stringValue(data["immediateFixes"]) ?? null,
      visit_type: stringValue(data["visitType"]) ?? null,
      form_data: formData,
    }),
  };
}

function buildPlaybookSubmission(
  data: Record<string, unknown>,
  context: SubmissionContext,
  profile: ProfileRow | null
): SubmissionPlan {
  const shopNumber = stringValue(data["shopNumber"]) ?? normalizeShopNumber(context.shopNumber);
  const startDate = stringValue(data["startDate"]);

  if (!shopNumber) {
    throw new SubmissionValidationError("Shop or leader is required for 30-60-90 plans.");
  }

  if (!startDate) {
    throw new SubmissionValidationError("Start date is required for 30-60-90 plans.");
  }

  return {
    table: "dm_visit_playbooks",
    payload: pruneUndefined({
      shop_number: shopNumber,
      shop_id: context.shopId ?? null,
      sponsor: stringValue(data["sponsor"]) ?? profile?.full_name ?? profile?.email ?? null,
      start_date: startDate,
      stage_thirty_focus: stringValue(data["thirtyFocus"]),
      stage_thirty_milestones: stringValue(data["thirtyMilestones"]),
      stage_sixty_focus: stringValue(data["sixtyFocus"]),
      stage_sixty_milestones: stringValue(data["sixtyMilestones"]),
      stage_ninety_focus: stringValue(data["ninetyFocus"]),
      stage_ninety_milestones: stringValue(data["ninetyMilestones"]),
      risks: stringValue(data["risks"]),
      owner_id: profile?.user_id ?? null,
      created_by: profile?.user_id ?? null,
      plan_json: data,
    }),
  };
}

function buildActionPlanSubmission(
  data: Record<string, unknown>,
  context: SubmissionContext,
  profile: ProfileRow | null
): SubmissionPlan {
  const shopNumber = stringValue(data["shopNumber"]) ?? normalizeShopNumber(context.shopNumber);
  const owner = stringValue(data["owner"]) ?? stringValue(data["ownerName"]);

  if (!shopNumber) {
    throw new SubmissionValidationError("Shop number is required for action plans.");
  }

  if (!owner) {
    throw new SubmissionValidationError("Primary owner is required for action plans.");
  }

  return {
    table: "dm_action_plans",
    payload: pruneUndefined({
      shop_number: shopNumber,
      shop_id: context.shopId ?? null,
      owner_name: owner,
      owner_id: profile?.user_id ?? null,
      due_date: stringValue(data["dueDate"]),
      priority: stringValue(data["priority"]),
      workstream: stringValue(data["workstream"]),
      actions: stringValue(data["actions"]),
      checkpoints: stringValue(data["checkpoints"]),
      risks: stringValue(data["risks"]),
      success_signal: stringValue(data["successSignal"]),
      created_by: profile?.user_id ?? null,
      plan_json: data,
    }),
  };
}

function buildEmployeeProfileSubmission(data: Record<string, unknown>, context: SubmissionContext): SubmissionPlan {
  const staffName = stringValue(data["staffName"]);
  const shopNumber = normalizeShopNumber(context.shopNumber);
  const shopId = context.shopId ?? null;

  if (!shopNumber) {
    throw new SubmissionValidationError("Link a shop before creating employee profiles.");
  }

  if (!shopId) {
    throw new SubmissionValidationError("Shop link is still loading. Refresh and try again.");
  }

  if (!staffName) {
    throw new SubmissionValidationError("Employee name is required.");
  }

  return {
    table: "shop_staff",
    payload: pruneUndefined({
      shop_id: shopId,
      shop_number: shopNumber,
      staff_name: staffName,
      employee_phone_number: stringValue(data["phoneNumber"]),
      date_of_hired: stringValue(data["hireDate"]),
    }),
  };
}

function buildPhoneSheetSubmission(
  data: Record<string, unknown>,
  context: SubmissionContext,
  profile: ProfileRow | null
): SubmissionPlan {
  const contactName = stringValue(data["contactName"]);
  const company = stringValue(data["company"]);
  const shopNumber = normalizeShopNumber(context.shopNumber);

  if (!shopNumber) {
    throw new SubmissionValidationError("Link a shop before adding phone sheet contacts.");
  }

  if (!contactName) {
    throw new SubmissionValidationError("Contact name is required.");
  }

  if (!company) {
    throw new SubmissionValidationError("Company or team is required for contacts.");
  }

  const contactType = normalizeContactType(stringValue(data["contactType"]));

  return {
    table: "contacts",
    payload: pruneUndefined({
      shop_id: shopNumber,
      name: contactName,
      company,
      phone: stringValue(data["phoneNumber"]),
      email: stringValue(data["email"]),
      notes: stringValue(data["notes"]),
      contact_type: contactType,
      created_by: profile?.user_id ?? null,
    }),
  };
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeShopNumber(value: string | number | null | undefined): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

function normalizeContactType(value: string | null): "vendor" | "work" {
  if (!value) {
    return "work";
  }

  const normalized = value.toLowerCase();
  return normalized === "vendor" ? "vendor" : "work";
}

function pruneUndefined<T extends Record<string, unknown>>(payload: T): T {
  return Object.entries(payload).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key as keyof T] = value as T[keyof T];
    }
    return acc;
  }, {} as T);
}
