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
create policy "insert_reaction" on show_reactions for insert using (
  auth.uid() is not null
);
create policy "select_reaction" on show_reactions for select using ( true );
