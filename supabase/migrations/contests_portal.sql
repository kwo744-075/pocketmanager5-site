-- Contests Portal unified schema for Bingo / Blackout / Fighting Back
-- Safe to run multiple times

-- Helpers
create extension if not exists "uuid-ossp";

do $$
begin
  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'contest_sessions') then
    create table public.contest_sessions (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now(),
      created_by uuid,
      game_type text not null,
      scope text,
      district_name text,
      region_name text,
      title text,
      status text default 'active'
    );
  end if;

  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'contest_participants') then
    create table public.contest_participants (
      id uuid primary key default gen_random_uuid(),
      session_id uuid not null references public.contest_sessions(id) on delete cascade,
      shop_number text not null,
      district_name text,
      region_name text,
      invited_at timestamptz default now(),
      joined_at timestamptz
    );
  end if;

  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'bingo_squares') then
    create table public.bingo_squares (
      id uuid primary key default gen_random_uuid(),
      game_type text default 'bingo',
      label text not null,
      sort_order int default 0,
      meta jsonb default '{}'::jsonb
    );
  end if;

  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'bingo_marks') then
    create table public.bingo_marks (
      id uuid primary key default gen_random_uuid(),
      session_id uuid not null references public.contest_sessions(id) on delete cascade,
      shop_number text not null,
      square_id uuid not null references public.bingo_squares(id),
      marked_by_user_id uuid,
      marked_at timestamptz not null default now(),
      payload jsonb default '{}'::jsonb
    );
  end if;

  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'blackout_objectives') then
    create table public.blackout_objectives (
      id uuid primary key default gen_random_uuid(),
      game_type text default 'blackout',
      label text not null,
      sort_order int default 0,
      meta jsonb default '{}'::jsonb
    );
  end if;

  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'blackout_marks') then
    create table public.blackout_marks (
      id uuid primary key default gen_random_uuid(),
      session_id uuid not null references public.contest_sessions(id) on delete cascade,
      shop_number text not null,
      objective_id uuid not null references public.blackout_objectives(id),
      marked_by_user_id uuid,
      marked_at timestamptz not null default now(),
      payload jsonb default '{}'::jsonb
    );
  end if;

  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'fightback_objectives') then
    create table public.fightback_objectives (
      id uuid primary key default gen_random_uuid(),
      game_type text default 'fighting-back',
      label text not null,
      sort_order int default 0,
      meta jsonb default '{}'::jsonb
    );
  end if;

  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'fightback_marks') then
    create table public.fightback_marks (
      id uuid primary key default gen_random_uuid(),
      session_id uuid not null references public.contest_sessions(id) on delete cascade,
      shop_number text not null,
      objective_id uuid not null references public.fightback_objectives(id),
      marked_by_user_id uuid,
      marked_at timestamptz not null default now(),
      payload jsonb default '{}'::jsonb
    );
  end if;
end $$;

-- Indexes for realtime performance
create index if not exists idx_bingo_marks_session_shop on public.bingo_marks(session_id, shop_number);
create index if not exists idx_blackout_marks_session_shop on public.blackout_marks(session_id, shop_number);
create index if not exists idx_fightback_marks_session_shop on public.fightback_marks(session_id, shop_number);
create index if not exists idx_contest_participants_session_shop on public.contest_participants(session_id, shop_number);

-- Views for recap and leaderboard
create or replace view public.contest_shop_progress_vw as
select session_id, shop_number, count(*) as marks_count, min(marked_at) as first_marked_at, max(marked_at) as last_marked_at
from (
  select session_id, shop_number, marked_at from public.bingo_marks
  union all
  select session_id, shop_number, marked_at from public.blackout_marks
  union all
  select session_id, shop_number, marked_at from public.fightback_marks
) m
group by session_id, shop_number;

create or replace view public.contest_leaderboard_vw as
select session_id, shop_number, marks_count,
       row_number() over (partition by session_id order by marks_count desc, shop_number) as rank
from public.contest_shop_progress_vw;

-- Realtime publications
alter publication supabase_realtime add table public.bingo_marks;
alter publication supabase_realtime add table public.blackout_marks;
alter publication supabase_realtime add table public.fightback_marks;

-- RLS
alter table public.contest_sessions enable row level security;
alter table public.contest_participants enable row level security;
alter table public.bingo_marks enable row level security;
alter table public.blackout_marks enable row level security;
alter table public.fightback_marks enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'contest_sessions' and policyname = 'contest_sessions_access') then
    create policy contest_sessions_access on public.contest_sessions
      for all using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'contest_participants' and policyname = 'contest_participants_access') then
    create policy contest_participants_access on public.contest_participants
      for all using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'bingo_marks' and policyname = 'bingo_marks_participant') then
    create policy bingo_marks_participant on public.bingo_marks
      for all using (
        exists (
          select 1 from public.contest_participants cp
          where cp.session_id = bingo_marks.session_id
            and cp.shop_number = bingo_marks.shop_number
        )
      ) with check (
        exists (
          select 1 from public.contest_participants cp
          where cp.session_id = bingo_marks.session_id
            and cp.shop_number = bingo_marks.shop_number
        )
      );
  end if;

  if not exists (select 1 from pg_policies where tablename = 'blackout_marks' and policyname = 'blackout_marks_participant') then
    create policy blackout_marks_participant on public.blackout_marks
      for all using (
        exists (
          select 1 from public.contest_participants cp
          where cp.session_id = blackout_marks.session_id
            and cp.shop_number = blackout_marks.shop_number
        )
      ) with check (
        exists (
          select 1 from public.contest_participants cp
          where cp.session_id = blackout_marks.session_id
            and cp.shop_number = blackout_marks.shop_number
        )
      );
  end if;

  if not exists (select 1 from pg_policies where tablename = 'fightback_marks' and policyname = 'fightback_marks_participant') then
    create policy fightback_marks_participant on public.fightback_marks
      for all using (
        exists (
          select 1 from public.contest_participants cp
          where cp.session_id = fightback_marks.session_id
            and cp.shop_number = fightback_marks.shop_number
        )
      ) with check (
        exists (
          select 1 from public.contest_participants cp
          where cp.session_id = fightback_marks.session_id
            and cp.shop_number = fightback_marks.shop_number
        )
      );
  end if;
end $$;
