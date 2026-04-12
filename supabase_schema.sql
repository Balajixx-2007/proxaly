-- ══════════════════════════════════════════════════════════════════════════════
-- Antigravity — Supabase Database Schema
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/_/sql
-- ══════════════════════════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Migration tracking
create table if not exists schema_version (
  version text primary key,
  applied_at timestamptz default now()
);

-- ── LEADS TABLE ───────────────────────────────────────────────────────────────
create table if not exists leads (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,

  -- Business info
  name            text not null,
  business_type   text,
  city            text,
  address         text,
  phone           text,
  website         text,
  rating          text,
  email           text,

  -- Scraping metadata
  source          text default 'google_maps',
  source_url      text,

  -- AI enrichment
  summary         text,
  outreach_message text,
  ai_score        integer check (ai_score >= 1 and ai_score <= 10),
  score_reason    text,
  enriched_at     timestamptz,

  -- CRM
  status          text default 'new' check (status in ('new', 'contacted', 'converted')),
  notes           text,

  -- Timestamps
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- RLS: users can only see their own leads
alter table leads enable row level security;

create policy "Users can view own leads"
  on leads for select using (auth.uid() = user_id);

create policy "Users can insert own leads"
  on leads for insert with check (auth.uid() = user_id);

create policy "Users can update own leads"
  on leads for update using (auth.uid() = user_id);

create policy "Users can delete own leads"
  on leads for delete using (auth.uid() = user_id);

-- Indexes for performance
create index if not exists idx_leads_user_id on leads(user_id);
create index if not exists idx_leads_status on leads(user_id, status);
create index if not exists idx_leads_created on leads(user_id, created_at desc);


-- ── CAMPAIGNS TABLE ───────────────────────────────────────────────────────────
create table if not exists campaigns (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text default '',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table campaigns enable row level security;

create policy "Users can manage own campaigns"
  on campaigns for all using (auth.uid() = user_id);

create index if not exists idx_campaigns_user_id on campaigns(user_id);


-- ── CAMPAIGN_LEADS JUNCTION TABLE ─────────────────────────────────────────────
create table if not exists campaign_leads (
  campaign_id uuid references campaigns(id) on delete cascade,
  lead_id     uuid references leads(id) on delete cascade,
  added_at    timestamptz default now(),
  primary key (campaign_id, lead_id)
);

alter table campaign_leads enable row level security;

create policy "Users can manage own campaign_leads"
  on campaign_leads for all
  using (
    exists (
      select 1 from campaigns
      where campaigns.id = campaign_leads.campaign_id
      and campaigns.user_id = auth.uid()
    )
  );


-- ── AUTO-UPDATE updated_at ────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_updated_at
  before update on leads
  for each row execute function update_updated_at();

create trigger campaigns_updated_at
  before update on campaigns
  for each row execute function update_updated_at();


-- ── CLIENTS TABLE ────────────────────────────────────────────────────────────
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

alter table clients enable row level security;

create policy "Users can manage own clients"
  on clients for all using (auth.uid() = user_id);

create index if not exists idx_clients_user_created on clients(user_id, created_at desc);


-- ── AGENT QUEUE TABLE ───────────────────────────────────────────────────────
create table if not exists agent_queue (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  lead_id uuid,
  payload jsonb not null,
  retries int default 0,
  status text default 'pending',
  created_at timestamptz default now()
);

alter table agent_queue enable row level security;

create policy "Users can manage own agent queue"
  on agent_queue for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_agent_queue_status_created
  on agent_queue(status, created_at asc);


-- ── EMAIL OUTREACH TABLES ───────────────────────────────────────────────────
create table if not exists email_sequences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  steps jsonb not null,
  created_at timestamptz default now()
);

alter table email_sequences enable row level security;

create policy "Users can manage own email_sequences"
  on email_sequences for all using (auth.uid() = user_id);

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

create policy "Users can manage own email_logs"
  on email_logs for all using (auth.uid() = user_id);

create index if not exists idx_email_logs_pending_schedule
  on email_logs(status, scheduled_at asc);
