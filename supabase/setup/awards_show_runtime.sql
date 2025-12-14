-- supabase/setup/awards_show_runtime.sql
create table if not exists public.awards_show_runtime (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  period_no int not null,
  status text not null default 'draft', -- draft|live|ended
  theme_id text not null default 'theme1',
  current_slide_index int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  constraint awards_show_runtime_year_period_key unique (year, period_no)
);

create table if not exists public.awards_show_reactions (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  period_no int not null,
  created_at timestamptz not null default now(),
  reaction text not null,
  created_by uuid null
);

create index if not exists idx_awards_show_runtime_year_period
  on public.awards_show_runtime (year, period_no);

create index if not exists idx_awards_show_reactions_year_period_time
  on public.awards_show_reactions (year, period_no, created_at);

-- RLS policies should be added by DBA to match existing admin patterns.