-- Migration: create cadence_templates table for storing editable daily cadence templates

CREATE TABLE cadence_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'company', -- company | region | district | shop
  scope_id text NULL,
  day text NOT NULL,
  tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_cadence_templates_scope_day ON cadence_templates (scope, scope_id, day);

-- RLS policies are intentionally omitted here; adapt to your project's auth model before enabling RLS.

-- Enable Row Level Security and create policies
-- Select: allow authenticated users to read templates
ALTER TABLE cadence_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select to authenticated" ON cadence_templates
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Inserts/Updates/Deletes: allow only users who are RD/VP/DM according to `alignment_memberships`.
-- This assumes an `alignment_memberships` table with `user_id` and `role` columns.
CREATE POLICY "Allow insert by RD_VP_DM" ON cadence_templates
  FOR INSERT
  USING (EXISTS (
    SELECT 1 FROM alignment_memberships am
    WHERE am.user_id = auth.uid()
      AND lower(am.role) IN ('rd', 'vp', 'dm')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM alignment_memberships am
    WHERE am.user_id = auth.uid()
      AND lower(am.role) IN ('rd', 'vp', 'dm')
  ));

CREATE POLICY "Allow update by RD_VP_DM" ON cadence_templates
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM alignment_memberships am
    WHERE am.user_id = auth.uid()
      AND lower(am.role) IN ('rd', 'vp', 'dm')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM alignment_memberships am
    WHERE am.user_id = auth.uid()
      AND lower(am.role) IN ('rd', 'vp', 'dm')
  ));

CREATE POLICY "Allow delete by RD_VP_DM" ON cadence_templates
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM alignment_memberships am
    WHERE am.user_id = auth.uid()
      AND lower(am.role) IN ('rd', 'vp', 'dm')
  ));
