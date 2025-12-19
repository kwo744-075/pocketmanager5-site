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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cadence_templates' AND policyname = 'Allow select to authenticated'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Allow select to authenticated" ON cadence_templates
        FOR SELECT
        USING (auth.role() = 'authenticated');
    $policy$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cadence_templates' AND policyname = 'Allow insert by RD_VP_DM'
  ) THEN
    -- Policies are added after alignment_memberships is created (see 20251206124000_normalize_alignment.sql)
  END IF;
END
$$;
