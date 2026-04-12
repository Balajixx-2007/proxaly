create table if not exists email_sequences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  steps jsonb not null,
  created_at timestamptz default now()
);

alter table email_sequences enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'email_sequences' and policyname = 'email_sequences_all') then
    create policy "email_sequences_all" on email_sequences for all using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists idx_email_sequences_user_created
  on email_sequences(user_id, created_at desc);

create table if not exists email_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  campaign_id uuid,
  sequence_id uuid references email_sequences(id) on delete set null,
  step int not null,
  status text not null default 'pending',
  subject text,
  body text,
  provider_message_id text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  error_text text,
  retry_count int default 0,
  created_at timestamptz default now()
);

alter table email_logs enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'email_logs' and policyname = 'email_logs_all') then
    create policy "email_logs_all" on email_logs for all using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists idx_email_logs_user_created
  on email_logs(user_id, created_at desc);

create index if not exists idx_email_logs_pending_schedule
  on email_logs(status, scheduled_at asc);

create index if not exists idx_email_logs_lead_step
  on email_logs(lead_id, step);
