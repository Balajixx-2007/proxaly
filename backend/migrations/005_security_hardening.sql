alter table if exists agent_queue
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table if exists agent_queue enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'agent_queue' and policyname = 'agent_queue_owner_all') then
    create policy "agent_queue_owner_all"
      on agent_queue
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

alter table if exists email_logs
  drop constraint if exists email_logs_status_check;

alter table if exists email_logs
  add constraint email_logs_status_check
  check (status in ('pending', 'sent', 'failed', 'processing'));
