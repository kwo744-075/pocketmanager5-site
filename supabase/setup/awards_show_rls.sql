-- supabase/setup/awards_show_rls.sql
-- Row Level Security policies for awards_show_runtime and awards_show_reactions
-- Adjust to match your existing profiles/roles table and admin semantics before applying.

-- NOTE: This file is PostgreSQL / Supabase SQL. The VS Code mssql language server
-- may report spurious syntax errors (for example around `IF EXISTS`, `auth.uid()`
-- or `DROP POLICY IF EXISTS`) because it expects T-SQL. This file is intended
-- to be executed using psql against a Postgres/Supabase database.

BEGIN;

-- Enable RLS
ALTER TABLE IF EXISTS public.awards_show_runtime ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.awards_show_reactions ENABLE ROW LEVEL SECURITY;

-- Runtime: allow authenticated users to SELECT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='awards_show_runtime' AND policyname='Authenticated can select runtime'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Authenticated can select runtime" ON public.awards_show_runtime FOR SELECT
      USING (auth.uid() IS NOT NULL);
    $policy$;
  END IF;
END
$$;

-- Runtime: allow admins to INSERT/UPDATE/DELETE (admin role checked via profiles.role = 'admin')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='awards_show_runtime' AND policyname='Admins can modify runtime'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can modify runtime" ON public.awards_show_runtime FOR ALL
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
      );
    $policy$;
  END IF;
END
$$;

-- Reactions: authenticated users can SELECT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='awards_show_reactions' AND policyname='Authenticated can select reactions'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Authenticated can select reactions" ON public.awards_show_reactions FOR SELECT
      USING (auth.uid() IS NOT NULL);
    $policy$;
  END IF;
END
$$;

-- Reactions: allow authenticated users to INSERT their own reaction (created_by must match auth.uid() or admin)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='awards_show_reactions' AND policyname='Authenticated can insert reactions'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Authenticated can insert reactions" ON public.awards_show_reactions FOR INSERT
      WITH CHECK (
        (created_by = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
      );
    $policy$;
  END IF;
END
$$;

-- Reactions: only admins can UPDATE/DELETE reactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='awards_show_reactions' AND policyname='Admins can modify reactions'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can modify reactions" ON public.awards_show_reactions FOR UPDATE, DELETE
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
      );
    $policy$;
  END IF;
END
$$;

COMMIT;

-- Note: This file assumes a `public.profiles` table with columns `user_id` (uuid) and `role` (text).
-- If your project uses a different schema for roles, adapt the policy queries accordingly.
