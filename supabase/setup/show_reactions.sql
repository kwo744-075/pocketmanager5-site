-- show_reactions: audience reactions to live shows
create table if not exists show_reactions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references show_sessions(id) on delete cascade,
  user_id uuid not null,
  reaction_type text not null,
  payload jsonb,
  created_at timestamptz default now()
);

alter table show_reactions enable row level security;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'show_reactions' AND policyname = 'insert_reaction'
  ) THEN
    EXECUTE $$CREATE POLICY "insert_reaction" ON show_reactions FOR INSERT USING ( auth.uid() is not null );$$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'show_reactions' AND policyname = 'select_reaction'
  ) THEN
    EXECUTE $$CREATE POLICY "select_reaction" ON show_reactions FOR SELECT USING ( true );$$;
  END IF;
END $$;
