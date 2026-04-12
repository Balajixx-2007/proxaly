create extension if not exists "uuid-ossp";

create table if not exists schema_version (
  version text primary key,
  applied_at timestamptz default now()
);

create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  business_type text,
  city text,
  address text,
  phone text,
  website text,
  rating text,
  email text,
  source text default 'google_maps',
  source_url text,
  summary text,
  outreach_message text,
  ai_score integer check (ai_score >= 1 and ai_score <= 10),
  score_reason text,
  enriched_at timestamptz,
  status text default 'new',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table leads enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'leads' and policyname = 'leads_select') then
    create policy "leads_select" on leads for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'leads' and policyname = 'leads_insert') then
    create policy "leads_insert" on leads for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'leads' and policyname = 'leads_update') then
    create policy "leads_update" on leads for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'leads' and policyname = 'leads_delete') then
    create policy "leads_delete" on leads for delete using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists idx_leads_user_id on leads(user_id);
create index if not exists idx_leads_status on leads(user_id, status);
create index if not exists idx_leads_created on leads(user_id, created_at desc);

create table if not exists campaigns (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table campaigns enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'campaigns' and policyname = 'campaigns_all') then
    create policy "campaigns_all" on campaigns for all using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists idx_campaigns_user_id on campaigns(user_id);

create table if not exists campaign_leads (
  campaign_id uuid references campaigns(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  added_at timestamptz default now(),
  primary key (campaign_id, lead_id)
);

alter table campaign_leads enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'campaign_leads' and policyname = 'campaign_leads_all') then
    create policy "campaign_leads_all" on campaign_leads for all
      using (exists (
        select 1
        from campaigns
        where campaigns.id = campaign_leads.campaign_id
          and campaigns.user_id = auth.uid()
      ));
  end if;
end $$;

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'leads_updated_at') then
    create trigger leads_updated_at before update on leads for each row execute function update_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'campaigns_updated_at') then
    create trigger campaigns_updated_at before update on campaigns for each row execute function update_updated_at();
  end if;
end $$;