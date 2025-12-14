-- Add kind column to jeopardy_show_state and make unique per (year, period, kind)
alter table if exists jeopardy_show_state add column if not exists kind text default 'A';
-- update existing rows to have kind 'A' where null
update jeopardy_show_state set kind = 'A' where kind is null;
-- drop old unique constraint if exists and add new one
do $$
begin
  begin
    alter table jeopardy_show_state drop constraint if exists jeopardy_show_state_unique;
  exception when others then
    null;
  end;
  alter table jeopardy_show_state add constraint jeopardy_show_state_unique unique (year, period, kind);
end;
$$;
