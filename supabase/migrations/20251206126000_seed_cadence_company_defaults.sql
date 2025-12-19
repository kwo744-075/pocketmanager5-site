-- Seed company-scoped cadence defaults into cadence_templates
-- Run after cadence_templates table exists

INSERT INTO cadence_templates (id, scope, scope_id, day, tasks, created_by, updated_at)
VALUES
  (gen_random_uuid(), 'company', NULL, 'Monday', $$["All Shops Open","Labor Verification","KPI's & #'s Communication to Team","Deposit Verification","Car Defecit Report","Corrigo","WorkVivo","Workday - check applications","Zendesk Follow-up","Update 5-8 Tracker","Daily Check-ins 12, 2:30, 5","Training Reports & Communication","Inventory Report & Communication","Validation of Previous Week Supplemental Orders","Achievers Recognition & Boosting","Regional Meeting - Goal Setting & AORs","District Meeting","People Review & Schedule Interviews for Week","Update Expense Report"]$$::jsonb, NULL, now()),
  (gen_random_uuid(), 'company', NULL, 'Tuesday', $$["All Shops Open","Labor Verification","KPI's & #'s Communication to Team","Deposit Verification","Car Defecit Report","Corrigo","WorkVivo","Workday - check applications","Zendesk Follow-up","Visit Prep","Update 5-8 Tracker","Daily Check-ins 12, 2:30, 5","Schedule Review & Posting (Before you leave the house/office)","Fleet Dashboard","Shop Visits","Prep for Tomorrow Claims Call"]$$::jsonb, NULL, now()),
  (gen_random_uuid(), 'company', NULL, 'Wednesday', $$["All Shops Open","Labor Verification (OT)","KPI's & #'s Communication to Team","Deposit Verification","Car Defecit Report","Corrigo","WorkVivo","Workday - check applications","Zendesk Follow-up","Visit Prep","Update 5-8 Tracker","Daily Check-ins 12, 2:30, 5","Claims Call","NPS Comment Review","Training Reports & Communication","Overtime Notes","Shop Visits"]$$::jsonb, NULL, now()),
  (gen_random_uuid(), 'company', NULL, 'Thursday', $$["All Shops Open","Labor Verification (OT)","KPI's & #'s Communication to Team","Deposit Verification","Car Defecit Report","Corrigo","WorkVivo","Workday - check applications","Zendesk Follow-up","Visit Prep","Update 5-8 Tracker","Daily Check-ins 12, 2:30, 5","Labor Comments added by Noon","Training Reports & Communication","Training Validation - Meet & Greet","Shop Visits"]$$::jsonb, NULL, now()),
  (gen_random_uuid(), 'company', NULL, 'Friday', $$["All Shops Open","Labor Verification (OT)","KPI's & #'s Communication to Team","Deposit Verification","Car Defecit Report","Corrigo","WorkVivo","Workday - check applications","Zendesk Follow-up","Visit Prep","Update 5-8 Tracker","Daily Check-ins 12, 2:30, 5","Full Throttle Friday Visits"]$$::jsonb, NULL, now()),
  (gen_random_uuid(), 'company', NULL, 'Saturday', $$["All Shops Open","Labor Verification (OT)","KPI's & #'s Communication to Team","Update 5-8 Tracker","Daily Check-ins 12, 2:30, 5","Visit Prep if Weekend Visit Day"]$$::jsonb, NULL, now())
ON CONFLICT (scope, scope_id, day) DO UPDATE
  SET tasks = EXCLUDED.tasks,
      updated_at = now();

-- Note: Adjust apostrophes/characters if your DB collation or tooling mangles Unicode. This migration seeds company-level defaults.
