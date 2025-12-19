-- show_state: stores live show state (current slide, segment, etc.)
create table if not exists show_state (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references show_sessions(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table show_state enable row level security;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'show_state' AND policyname = 'select_show_state'
  ) THEN
    EXECUTE $$CREATE POLICY "select_show_state" ON show_state FOR SELECT USING ( true );$$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'show_state' AND policyname = 'update_show_state'
  ) THEN
    EXECUTE $$CREATE POLICY "update_show_state" ON show_state FOR UPDATE USING ( auth.uid() is not null );$$;
  END IF;
END $$;
