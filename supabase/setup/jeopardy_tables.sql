-- Jeopardy tables for Awards workflow
-- Run in Supabase DB

create table if not exists jeopardy_sets (
  id bigserial primary key,
  year integer not null,
  period text not null,
  kind text not null, -- 'A' | 'B' | 'FINAL'
  payload jsonb not null,
  created_at timestamptz default now(),
  constraint jeopardy_sets_unique unique (year, period, kind)
);

create table if not exists jeopardy_show_state (
  id bigserial primary key,
  year integer not null,
  period text not null,
  used_clue_ids jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint jeopardy_show_state_unique unique (year, period)
);
