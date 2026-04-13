create extension if not exists "uuid-ossp";

create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  business_name text default '',
  niche text default '',
  plan text default 'starter',
  notes text default '',
  portal_token text not null unique,
  status text default 'active',
  leads_sent integer default 0,
  meetings_booked integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table if exists clients
  add column if not exists business_name text default '',
  add column if not exists niche text default '',
  add column if not exists plan text default 'starter',
  add column if not exists notes text default '',
  add column if not exists portal_token text,
  add column if not exists status text default 'active',
  add column if not exists leads_sent integer default 0,
  add column if not exists meetings_booked integer default 0,
  add column if not exists updated_at timestamptz default now();

alter table clients enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'clients' and policyname = 'clients_all') then
    create policy "clients_all" on clients for all using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists idx_clients_user_id on clients(user_id, created_at desc);
create index if not exists idx_clients_token on clients(portal_token);

create table if not exists branding_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  agency_name text default 'Your Agency',
  agency_tagline text default '',
  logo_url text default '',
  primary_color text default '#8b5cf6',
  secondary_color text default '#22d3ee',
  accent_color text default '#f59e0b',
  footer_text text default '',
  updated_at timestamptz default now()
);

alter table if exists branding_settings
  add column if not exists agency_name text default 'Your Agency',
  add column if not exists agency_tagline text default '',
  add column if not exists logo_url text default '',
  add column if not exists primary_color text default '#8b5cf6',
  add column if not exists secondary_color text default '#22d3ee',
  add column if not exists accent_color text default '#f59e0b',
  add column if not exists footer_text text default '',
  add column if not exists updated_at timestamptz default now();

alter table branding_settings enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'branding_settings' and policyname = 'branding_settings_all') then
    create policy "branding_settings_all" on branding_settings for all using (auth.uid() = user_id);
  end if;
end $$;

create table if not exists agent_queue (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  lead_id uuid,
  payload jsonb not null,
  retries int default 0,
  status text default 'pending',
  created_at timestamptz default now()
);

alter table if exists agent_queue
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists lead_id uuid,
  add column if not exists payload jsonb,
  add column if not exists retries int default 0,
  add column if not exists status text default 'pending',
  add column if not exists created_at timestamptz default now();

update agent_queue set payload = '{}'::jsonb where payload is null;
alter table agent_queue alter column payload set not null;

create index if not exists idx_agent_queue_status_created
  on agent_queue(status, created_at asc);

create index if not exists idx_agent_queue_lead_id
  on agent_queue(lead_id);

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

create table if not exists email_sequences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  steps jsonb not null,
  created_at timestamptz default now()
);

alter table if exists email_sequences
  add column if not exists name text,
  add column if not exists steps jsonb,
  add column if not exists created_at timestamptz default now();

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

alter table if exists email_logs
  add column if not exists campaign_id uuid,
  add column if not exists sequence_id uuid references email_sequences(id) on delete set null,
  add column if not exists step int,
  add column if not exists status text default 'pending',
  add column if not exists subject text,
  add column if not exists body text,
  add column if not exists provider_message_id text,
  add column if not exists scheduled_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists error_text text,
  add column if not exists retry_count int default 0,
  add column if not exists created_at timestamptz default now();

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