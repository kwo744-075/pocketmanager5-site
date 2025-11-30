import type { FeatureSlug } from "../featureRegistry";

export type FormField =
  | {
      type: "text" | "textarea" | "date" | "number";
      name: string;
      label: string;
      placeholder?: string;
      helpText?: string;
      required?: boolean;
      min?: number;
      max?: number;
      step?: number;
    }
  | {
      type: "select";
      name: string;
      label: string;
      options: Array<{ label: string; value: string }>;
      placeholder?: string;
      helpText?: string;
      required?: boolean;
    }
  | {
      type: "checklist";
      name: string;
      label: string;
      items: Array<{ id: string; label: string }>;
      helpText?: string;
    };

export type FormSection = {
  title: string;
  description?: string;
  fields: FormField[];
};

export type FormConfig = {
  slug: FormSlug;
  title: string;
  feature: FeatureSlug;
  description: string;
  supabaseTable?: string;
  submitLabel?: string;
  successMessage?: string;
  sections: FormSection[];
};

export type FormSlug =
  | "dm-visit-plan"
  | "dm-30-60-90"
  | "dm-visit-log"
  | "dm-action-plan"
  | "people-employee-profile"
  | "people-phone-sheet";

const DM_VISIT_TYPES = [
  "Night Visit",
  "Plan To Win",
  "Standard Visit",
  "Quarterly Audit",
  "Training Visit",
  "1 on 1",
  "Admin",
  "Off",
  "Project Day",
  "Discussion Visit",
  "In Person",
  "Teams meet",
  "RDO Visit",
];

export const FORM_REGISTRY: FormConfig[] = [
  {
    slug: "dm-visit-plan",
    title: "Visit Plan",
    feature: "dm-schedule",
    description:
      "Plan an upcoming shop visit using the Driven Brands retail calendar cadence. Capture when, where, and what coaching focus you will take on site.",
    supabaseTable: "dm_schedule",
    submitLabel: "Save visit plan",
    successMessage: "Visit plan saved locally — push to Supabase when ready.",
    sections: [
      {
        title: "Visit overview",
        description: "Lock the date, shop, and visit focus before sharing with your district team.",
        fields: [
          { type: "date", name: "visitDate", label: "Visit date", required: true },
          {
            type: "select",
            name: "visitType",
            label: "Visit type",
            required: true,
            options: DM_VISIT_TYPES.map((label) => ({ label, value: label })),
          },
          {
            type: "text",
            name: "shopNumber",
            label: "Shop number",
            placeholder: "Shop 1245",
            required: true,
          },
          {
            type: "select",
            name: "visitWindow",
            label: "Visit window",
            options: [
              { label: "AM focus", value: "am" },
              { label: "PM focus", value: "pm" },
              { label: "Full day", value: "full-day" },
            ],
            placeholder: "Full day",
          },
        ],
      },
      {
        title: "Prep checklist",
        description: "Validate cadence and reporting touch-points ahead of the visit.",
        fields: [
          {
            type: "checklist",
            name: "prepChecklist",
            label: "Pre-visit confirmations",
            helpText: "Mark the items you have already reviewed.",
            items: [
              { id: "pulse", label: "Pulse totals & KPIs reviewed" },
              { id: "labor", label: "Labor plan vs actual pulled" },
              { id: "training", label: "Training tracker updated" },
              { id: "inventory", label: "Inventory & workbook notes captured" },
              { id: "ops", label: "OPS action log scrubbed" },
            ],
          },
          {
            type: "textarea",
            name: "prepNotes",
            label: "Additional prep notes",
            placeholder: "Key context, partner alignment, roadblocks…",
          },
        ],
      },
      {
        title: "Visit focus",
        description: "Outline the three systems you will drive during the visit.",
        fields: [
          {
            type: "textarea",
            name: "peopleFocus",
            label: "People / staffing focus",
            placeholder: "Pipeline gaps, coaching priorities, recruiting commitments…",
          },
          {
            type: "textarea",
            name: "operationsFocus",
            label: "Operations focus",
            placeholder: "Mix, compliance, playbook execution, facility needs…",
          },
          {
            type: "textarea",
            name: "growthFocus",
            label: "Growth + brand moments",
            placeholder: "Donations, CSI follow-up, marketing plays, partner visits…",
          },
          {
            type: "text",
            name: "successMetrics",
            label: "Success metrics",
            placeholder: "e.g., 2 coaching commitments, refreshed 30-60-90, logbook entry submitted",
          },
        ],
      },
    ],
  },
  {
    slug: "dm-30-60-90",
    title: "30-60-90 Plan",
    feature: "dm-schedule",
    description:
      "Document the staged plan for new leaders, challenged shops, or major projects following the 30/60/90 discipline.",
    supabaseTable: "dm_visit_playbooks",
    submitLabel: "Save 30-60-90",
    successMessage: "Plan staged locally — share or sync with your team when ready.",
    sections: [
      {
        title: "Plan snapshot",
        description: "Capture who the plan is for and when the clock starts.",
        fields: [
          { type: "text", name: "shopNumber", label: "Shop or leader", required: true },
          { type: "text", name: "sponsor", label: "Plan sponsor", placeholder: "DM, RD, or mentor" },
          { type: "date", name: "startDate", label: "Start date", required: true },
        ],
      },
      {
        title: "30 days",
        description: "Stabilize operations and set expectations.",
        fields: [
          {
            type: "textarea",
            name: "thirtyFocus",
            label: "30-day focus",
            placeholder: "Immediate fixes, compliance items, team introductions…",
          },
          {
            type: "textarea",
            name: "thirtyMilestones",
            label: "Milestones",
            placeholder: "List the outcomes or scorecard thresholds you expect by day 30.",
          },
        ],
      },
      {
        title: "60 days",
        description: "Drive consistency and leader-led routines.",
        fields: [
          {
            type: "textarea",
            name: "sixtyFocus",
            label: "60-day focus",
            placeholder: "Cadence ownership, pipeline, weekly visit rhythm, early wins…",
          },
          {
            type: "textarea",
            name: "sixtyMilestones",
            label: "Milestones",
            placeholder: "Benchmarks, adoption goals, training completions…",
          },
        ],
      },
      {
        title: "90 days",
        description: "Scale results and hand back ownership.",
        fields: [
          {
            type: "textarea",
            name: "ninetyFocus",
            label: "90-day focus",
            placeholder: "Growth lane, donation/CSI strategy, succession, next elevation…",
          },
          {
            type: "textarea",
            name: "ninetyMilestones",
            label: "Milestones",
            placeholder: "KPIs, leadership behaviors, overall readiness signal…",
          },
          {
            type: "textarea",
            name: "risks",
            label: "Risks & support needed",
            placeholder: "Resource needs, dependencies, partnership asks…",
          },
        ],
      },
    ],
  },
  {
    slug: "dm-visit-log",
    title: "DM Visit Log",
    feature: "dm-logbook",
    description: "Mirror the mobile DM logbook entry with scoring, notes, and immediate fixes.",
    supabaseTable: "dm_logbook",
    submitLabel: "Save visit log",
    successMessage: "Visit log captured locally — sync to Supabase when policies allow.",
    sections: [
      {
        title: "Visit metadata",
        description: "Items required for compliance and reporting.",
        fields: [
          {
            type: "select",
            name: "logType",
            label: "Log type",
            required: true,
            options: [
              { label: "DM Visit", value: "dm_visit" },
              { label: "DM Cadence", value: "dm_cadence" },
            ],
          },
          { type: "date", name: "logDate", label: "Visit date", required: true },
          { type: "text", name: "shopNumber", label: "Shop number", required: true },
          {
            type: "select",
            name: "visitType",
            label: "Visit type",
            options: DM_VISIT_TYPES.map((label) => ({ label, value: label })),
          },
          {
            type: "number",
            name: "score",
            label: "Completion score %",
            min: 0,
            max: 100,
            step: 5,
            placeholder: "85",
            helpText: "Mirror the cadence or audit score shared with the shop team.",
          },
        ],
      },
      {
        title: "Coaching notes",
        description: "Capture the story, wins, and required actions.",
        fields: [
          {
            type: "textarea",
            name: "headline",
            label: "Visit headline",
            placeholder: "Overall assessment, mood, quick read for RD…",
          },
          {
            type: "textarea",
            name: "coachingNotes",
            label: "Coaching notes",
            placeholder: "What we celebrated, coached, committed to…",
          },
          {
            type: "textarea",
            name: "immediateFixes",
            label: "Immediate fixes required",
            placeholder: "Non-compliance, safety gaps, escalations…",
          },
          {
            type: "textarea",
            name: "followUps",
            label: "Follow-ups & owners",
            placeholder: "List next steps with due dates and owners.",
          },
          {
            type: "text",
            name: "attachments",
            label: "Links / attachments",
            placeholder: "Paste shared drive links, photos, or doc URLs.",
          },
        ],
      },
    ],
  },
  {
    slug: "dm-action-plan",
    title: "Action Plan",
    feature: "dm-logbook",
    description: "Convert visit findings into an accountable action plan with owners and due dates.",
    supabaseTable: "dm_action_plans",
    submitLabel: "Save action plan",
    successMessage: "Action plan saved locally.",
    sections: [
      {
        title: "Plan details",
        description: "Anchor the plan to a shop, owner, and priority level.",
        fields: [
          { type: "text", name: "shopNumber", label: "Shop number", required: true },
          { type: "text", name: "owner", label: "Primary owner", required: true },
          { type: "date", name: "dueDate", label: "Target completion" },
          {
            type: "select",
            name: "priority",
            label: "Priority",
            options: [
              { label: "High", value: "high" },
              { label: "Medium", value: "medium" },
              { label: "Low", value: "low" },
            ],
          },
          {
            type: "select",
            name: "workstream",
            label: "Workstream",
            options: [
              { label: "Operations", value: "operations" },
              { label: "People", value: "people" },
              { label: "Growth", value: "growth" },
              { label: "Training", value: "training" },
              { label: "Safety / Compliance", value: "safety" },
            ],
          },
        ],
      },
      {
        title: "Actions",
        description: "Detail the steps, checkpoints, and risks.",
        fields: [
          {
            type: "textarea",
            name: "actions",
            label: "Key actions",
            placeholder: "List each action, owner, and due date.",
          },
          {
            type: "textarea",
            name: "checkpoints",
            label: "Checkpoints",
            placeholder: "When will you inspect progress? Weekly huddles, DM follow-up, etc.",
          },
          {
            type: "textarea",
            name: "risks",
            label: "Risks / blockers",
            placeholder: "Dependencies, vendor delays, staffing gaps…",
          },
          {
            type: "textarea",
            name: "successSignal",
            label: "Definition of done",
            placeholder: "What proof will show the plan is complete?",
          },
        ],
      },
    ],
  },
  {
    slug: "people-employee-profile",
    title: "Employee Profile",
    feature: "employee-management",
    description: "Capture core staff details to keep scheduling, training, and the phone sheet aligned.",
    supabaseTable: "shop_staff",
    submitLabel: "Save employee profile",
    successMessage: "Profile saved locally and synced to Supabase when available.",
    sections: [
      {
        title: "Identity & contact",
        description: "Match the same fields surfaced in the mobile Staff Management workflow.",
        fields: [
          { type: "text", name: "staffName", label: "Employee name", placeholder: "Jordan Sample", required: true },
          { type: "text", name: "phoneNumber", label: "Phone number", placeholder: "555-555-5555" },
          {
            type: "date",
            name: "hireDate",
            label: "Hire date",
            helpText: "Used for tenure math across the employee dashboards.",
          },
        ],
      },
    ],
  },
  {
    slug: "people-phone-sheet",
    title: "Phone Sheet",
    feature: "employee-management",
    description: "Add vendors and work contacts to power the split phone sheet view that pairs staff with partner numbers.",
    supabaseTable: "contacts",
    submitLabel: "Save contact",
    successMessage: "Contact saved locally and synced to Supabase when available.",
    sections: [
      {
        title: "Contact identity",
        description: "Match the Contact List modal used in the mobile app before the split Employees vs Contacts view loads.",
        fields: [
          {
            type: "text",
            name: "contactName",
            label: "Name",
            placeholder: "Tow vendor, RD, or partner",
            required: true,
          },
          {
            type: "text",
            name: "company",
            label: "Company / team",
            placeholder: "Vendor, partner, or crew label",
            required: true,
          },
          {
            type: "select",
            name: "contactType",
            label: "Contact type",
            options: [
              { label: "Work contact", value: "work" },
              { label: "Vendor / partner", value: "vendor" },
            ],
            placeholder: "Work contact",
          },
        ],
      },
      {
        title: "Reach channels",
        description: "Capture the same dialing + escalation details surfaced in the Expo phone sheet.",
        fields: [
          {
            type: "text",
            name: "phoneNumber",
            label: "Phone number",
            placeholder: "555-555-5555",
          },
          {
            type: "text",
            name: "email",
            label: "Email",
            placeholder: "contact@example.com",
          },
        ],
      },
      {
        title: "Notes",
        description: "Escalation instructions, after-hours coverage, or services offered.",
        fields: [
          {
            type: "textarea",
            name: "notes",
            label: "Notes",
            placeholder: "After-hours gates, service area, escalation order…",
          },
        ],
      },
    ],
  },
];

export const FORM_LOOKUP: Record<FormSlug, FormConfig> = FORM_REGISTRY.reduce((acc, form) => {
  acc[form.slug] = form;
  return acc;
}, {} as Record<FormSlug, FormConfig>);

export const DM_FORM_SLUGS: FormSlug[] = [
  "dm-visit-plan",
  "dm-30-60-90",
  "dm-visit-log",
  "dm-action-plan",
];

export const PEOPLE_FORM_SLUGS: FormSlug[] = ["people-employee-profile", "people-phone-sheet"];
