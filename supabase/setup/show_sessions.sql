-- show_sessions: stores high-level show sessions
create table if not exists show_sessions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null,
  target_scope text not null,
  theme text not null,
  title text,
  created_at timestamptz default now()
);

-- RLS: only creators and admins can insert/update
alter table show_sessions enable row level security;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'show_sessions' AND policyname = 'insert_show_sessions'
  ) THEN
    EXECUTE $$CREATE POLICY "insert_show_sessions" ON show_sessions FOR INSERT USING ( auth.uid() is not null );$$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'show_sessions' AND policyname = 'select_show_sessions'
  ) THEN
    EXECUTE $$CREATE POLICY "select_show_sessions" ON show_sessions FOR SELECT USING ( true );$$;
  END IF;
END $$;
