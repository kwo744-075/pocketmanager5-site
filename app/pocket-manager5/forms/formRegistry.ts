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
      type: "hidden";
      name: string;
      defaultValue?: string;
      required?: boolean;
    }
  | {
      type: "select";
      name: string;
      label: string;
      options?: Array<{ label: string; value: string }>;
      optionsSource?: "alignedShops";
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
  | "people-phone-sheet"
  | "employee-meetings"
  | "training-checklist"
  | "dm-verbal-checklist"
  | "performance-report"
  | "dm-cadence"
  | "claims-form"
  | "turnover-log";

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
        title: "Visit details",
        description: "Date is locked from the calendar — just choose the visit focus and aligned shop.",
        fields: [
          { type: "hidden", name: "visitDate", required: true },
          {
            type: "select",
            name: "visitType",
            label: "Visit type",
            required: true,
            options: DM_VISIT_TYPES.map((label) => ({ label, value: label })),
          },
          {
            type: "select",
            name: "shopNumber",
            label: "Aligned shop",
            placeholder: "Select shop",
            helpText: "Pulled from your district alignment.",
            required: true,
            optionsSource: "alignedShops",
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
      {
        title: "Celebration profile (optional)",
        description:
          "Optional birthday + celebration cues for future Recognition automations. Fill it out when you have details, otherwise skip it for now.",
        fields: [
          {
            type: "date",
            name: "dateOfBirth",
            label: "Date of birth",
            helpText: "Feeds the Recognition Captain birthdays list after Supabase wiring lands.",
          },
          {
            type: "text",
            name: "favoriteTreat",
            label: "Favorite treat",
            placeholder: "Brownies, Dr Pepper, etc.",
            helpText: "Optional extra context for celebration planning.",
          },
          {
            type: "textarea",
            name: "celebrationNotes",
            label: "Celebration notes",
            placeholder: "Recognition preferences, family shoutouts, surprise ideas…",
            helpText: "Recognition Captain will surface this alongside DOB once the pipeline is active.",
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
  {
    slug: "employee-meetings",
    title: "Employee Meetings",
    feature: "employee-management",
    description: "Capture meeting details, attendees, and agenda for shop meetings.",
    supabaseTable: "employee_meetings",
    submitLabel: "Save meeting",
    successMessage: "Meeting saved successfully.",
    sections: [
      {
        title: "Meeting details",
        description: "Date, time, type, attendees and agenda.",
        fields: [
          { type: "select", name: "meetingType", label: "Meeting type", required: true, options: [
              { label: "Shop Manager Lead Meeting", value: "shop_manager_lead" },
              { label: "Newsletter Meeting", value: "newsletter" },
              { label: "Monthly Planner", value: "monthly_planner" },
              { label: "General Training", value: "general_training" },
            ] },
          { type: "date", name: "meetingDate", label: "Meeting date", required: true },
          { type: "text", name: "meetingTime", label: "Meeting time" },
          { type: "textarea", name: "agendaText", label: "Agenda" },
          { type: "hidden", name: "shopNumber", required: true },
        ],
      },
    ],
  },
  {
    slug: "training-checklist",
    title: "Training Checklist",
    feature: "training-tracker",
    description: "Certified training checklist (CTT) and training completion tracking.",
    supabaseTable: "employee_training",
    submitLabel: "Save checklist",
    successMessage: "Training checklist saved.",
    sections: [
      {
        title: "Checklist",
        description: "CTT checklist items and completion notes.",
        fields: [
          { type: "date", name: "completedDate", label: "Completion date" },
          { type: "text", name: "trainer", label: "Trainer name" },
          { type: "textarea", name: "notes", label: "Notes" },
        ],
      },
    ],
  },
  {
    slug: "dm-verbal-checklist",
    title: "DM Verbal Checklist",
    feature: "training-tracker",
    description: "DM verbal checklist form used during coaching visits.",
    supabaseTable: "dm_verbal_checklists",
    submitLabel: "Save checklist",
    successMessage: "DM verbal checklist saved.",
    sections: [
      {
        title: "Checklist",
        description: "Quick verbal checklist items.",
        fields: [
          { type: "date", name: "date", label: "Date" },
          { type: "select", name: "result", label: "Result", options: [{ label: "Pass", value: "pass" }, { label: "Fail", value: "fail" }] },
        ],
      },
    ],
  },
  {
    slug: "performance-report",
    title: "Performance Report",
    feature: "training-tracker",
    description: "Performance report / evaluation for employees.",
    supabaseTable: "employee_performance_reports",
    submitLabel: "Save report",
    successMessage: "Performance report saved.",
    sections: [
      {
        title: "Report",
        fields: [
          { type: "text", name: "employeeId", label: "Employee ID", required: true },
          { type: "number", name: "score", label: "Score" },
          { type: "textarea", name: "summary", label: "Summary" },
        ],
      },
    ],
  },
  // Auto-stubbed mobile forms
  {
    slug: "dm-cadence",
    title: "DM Cadence Checklist",
    feature: "dm-schedule",
    description: "Weekly DM cadence checklist adapted from the mobile app.",
    submitLabel: "Save cadence",
    successMessage: "Cadence saved.",
    sections: [
      {
        title: "Cadence items",
        description: "Checklist items for the weekly cadence.",
        fields: [{ type: "checklist", name: "items", label: "Items", items: [{ id: "placeholder", label: "Placeholder item" }] }],
      },
    ],
  },
  {
    slug: "claims-form",
    title: "Claims Form",
    feature: "claims",
    description: "Capture claim details and attachments from the mobile claims workflow.",
    submitLabel: "Submit claim",
    successMessage: "Claim submitted.",
    sections: [
      {
        title: "Claim details",
        fields: [
          { type: "text", name: "claimReference", label: "Reference" },
          { type: "date", name: "claimDate", label: "Date" },
          { type: "textarea", name: "description", label: "Description" },
        ],
      },
    ],
  },
  {
    slug: "performance-report",
    title: "Performance Report",
    feature: "employee-management",
    description: "Employee performance report form (mobile-origin).",
    submitLabel: "Save report",
    successMessage: "Report saved.",
    sections: [
      {
        title: "Report",
        fields: [
          { type: "text", name: "employeeId", label: "Employee ID" },
          { type: "number", name: "score", label: "Score" },
          { type: "textarea", name: "notes", label: "Notes" },
        ],
      },
    ],
  },
  {
    slug: "turnover-log",
    title: "Turnover Log",
    feature: "employee-management",
    description: "Log for staff turnover events pulled from mobile.",
    submitLabel: "Log turnover",
    successMessage: "Turnover logged.",
    sections: [
      {
        title: "Turnover details",
        fields: [
          { type: "text", name: "staffName", label: "Staff name" },
          { type: "date", name: "endDate", label: "End date" },
          { type: "textarea", name: "reason", label: "Reason" },
        ],
      },
    ],
  },
];

export const FORM_LOOKUP: Record<AllFormSlug, FormConfig> = FORM_REGISTRY.reduce((acc, form) => {
  acc[form.slug] = form;
  return acc;
}, {} as Record<AllFormSlug, FormConfig>);

export const DM_FORM_SLUGS: FormSlug[] = [
  "dm-visit-plan",
  "dm-30-60-90",
  "dm-visit-log",
  "dm-action-plan",
];

export const PEOPLE_FORM_SLUGS: FormSlug[] = ["people-employee-profile", "people-phone-sheet"];
