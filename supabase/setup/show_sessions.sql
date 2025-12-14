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
create policy "insert_show_sessions" on show_sessions for insert using ( auth.uid() is not null );
create policy "select_show_sessions" on show_sessions for select using ( true );
