import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSubmissionPlan,
  SubmissionValidationError,
  type SubmissionContext,
} from "../app/api/pocket-manager/forms/submit/mapper";

type Profile = { user_id: string; email: string; full_name?: string | null };

const contextBase: SubmissionContext = {
  loginEmail: "dm@example.com",
  shopNumber: "447",
  shopId: "shop-447",
  shopName: "Shop 447",
};

const profile: Profile = {
  user_id: "dm-user-1",
  email: "dm@example.com",
  full_name: "Pocket DM",
};

test("dm-30-60-90 maps to dm_visit_playbooks", async () => {
  const data = {
    shopNumber: "447",
    sponsor: "RD Example",
    startDate: "2024-11-20",
    thirtyFocus: "Stabilize staffing",
    thirtyMilestones: "Hire 2 techs",
    sixtyFocus: "Drive cadence",
    sixtyMilestones: "Complete 4 audits",
    ninetyFocus: "Prep for handoff",
    ninetyMilestones: "Bench strong GM",
    risks: "Hiring pipeline",
  };

  const plan = await buildSubmissionPlan("dm-30-60-90", data, contextBase, profile);
  assert.ok(plan, "plan should be generated");
  assert.equal(plan?.table, "dm_visit_playbooks");

  const payload = plan?.payload as Record<string, unknown>;
  assert.equal(payload.shop_number, "447");
  assert.equal(payload.start_date, "2024-11-20");
  assert.equal(payload.stage_thirty_focus, "Stabilize staffing");
  assert.deepEqual(payload.plan_json, data);
});

test("dm-action-plan maps to dm_action_plans", async () => {
  const data = {
    shopNumber: "447",
    owner: "GM Example",
    dueDate: "2024-12-15",
    priority: "high",
    workstream: "operations",
    actions: "Schedule daily huddles",
    checkpoints: "Weekly DM follow up",
    risks: "Turnover",
    successSignal: "Sustain 90% cadence completion",
  };

  const plan = await buildSubmissionPlan("dm-action-plan", data, contextBase, profile);
  assert.ok(plan, "plan should be generated");
  assert.equal(plan?.table, "dm_action_plans");

  const payload = plan?.payload as Record<string, unknown>;
  assert.equal(payload.owner_name, "GM Example");
  assert.equal(payload.due_date, "2024-12-15");
  assert.equal(payload.priority, "high");
  assert.deepEqual(payload.plan_json, data);
});

test("dm-action-plan enforces owner", async () => {
  const data = {
    shopNumber: "447",
    dueDate: "2024-12-15",
  };

  await assert.rejects(
    () => buildSubmissionPlan("dm-action-plan", data, contextBase, profile),
    SubmissionValidationError
  );
});

test("people-employee-profile maps to shop_staff", async () => {
  const data = {
    staffName: "Jordan Sample",
    phoneNumber: "555-123-4567",
    hireDate: "2024-05-01",
  };

  const plan = await buildSubmissionPlan("people-employee-profile", data, contextBase, null);
  assert.ok(plan);
  assert.equal(plan?.table, "shop_staff");

  const payload = plan?.payload as Record<string, unknown>;
  assert.equal(payload.shop_id, "shop-447");
  assert.equal(payload.shop_number, "447");
  assert.equal(payload.staff_name, "Jordan Sample");
  assert.equal(payload.employee_phone_number, "555-123-4567");
  assert.equal(payload.date_of_hired, "2024-05-01");
});

test("people-employee-profile enforces name", async () => {
  await assert.rejects(
    () => buildSubmissionPlan("people-employee-profile", { phoneNumber: "555-0000" }, contextBase, null),
    SubmissionValidationError
  );
});

test("people-phone-sheet maps to contacts", async () => {
  const data = {
    contactName: "Tow Vendor",
    company: "Metro Towing",
    contactType: "vendor",
    phoneNumber: "555-987-6543",
    email: "dispatch@metrotow.com",
    notes: "Available 24/7",
  };

  const plan = await buildSubmissionPlan("people-phone-sheet", data, contextBase, profile);
  assert.ok(plan);
  assert.equal(plan?.table, "contacts");

  const payload = plan?.payload as Record<string, unknown>;
  assert.equal(payload.shop_id, "447");
  assert.equal(payload.name, "Tow Vendor");
  assert.equal(payload.company, "Metro Towing");
  assert.equal(payload.contact_type, "vendor");
  assert.equal(payload.phone, "555-987-6543");
  assert.equal(payload.email, "dispatch@metrotow.com");
  assert.equal(payload.notes, "Available 24/7");
  assert.equal(payload.created_by, profile.user_id);
});

test("people-phone-sheet validates contact data", async () => {
  await assert.rejects(
    () =>
      buildSubmissionPlan(
        "people-phone-sheet",
        { company: "Vendor" },
        { ...contextBase, shopNumber: null },
        profile
      ),
    SubmissionValidationError
  );

  await assert.rejects(
    () => buildSubmissionPlan("people-phone-sheet", { company: "Vendor" }, contextBase, profile),
    SubmissionValidationError
  );

  await assert.rejects(
    () =>
      buildSubmissionPlan(
        "people-phone-sheet",
        { contactName: "Vendor" },
        contextBase,
        profile
      ),
    SubmissionValidationError
  );
});
