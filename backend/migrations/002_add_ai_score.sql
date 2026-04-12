alter table if exists leads
  add column if not exists ai_score integer;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_name = 'leads' and column_name = 'score'
  ) then
    execute 'update leads set ai_score = coalesce(ai_score, score)';
  end if;
end $$;

alter table if exists leads
  alter column ai_score type integer using ai_score::integer;

alter table if exists leads
  drop constraint if exists leads_ai_score_check;

alter table if exists leads
  add constraint leads_ai_score_check check (ai_score is null or (ai_score >= 1 and ai_score <= 10));

update leads
set status = case
  when lower(trim(status)) = 'new' then 'new'
  when lower(trim(status)) = 'contacted' then 'contacted'
  when lower(trim(status)) = 'replied' then 'replied'
  when replace(lower(trim(status)), ' ', '_') = 'meeting_booked' then 'meeting_booked'
  when lower(trim(status)) = 'client' then 'client'
  when lower(trim(status)) = 'converted' then 'converted'
  else 'new'
end;

alter table if exists leads
  drop constraint if exists leads_status_check;

alter table if exists leads
  add constraint leads_status_check
  check (status in ('new', 'contacted', 'replied', 'meeting_booked', 'client', 'converted'));
