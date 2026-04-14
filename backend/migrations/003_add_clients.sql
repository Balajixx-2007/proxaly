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

alter table branding_settings enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'branding_settings' and policyname = 'branding_settings_all') then
    create policy "branding_settings_all" on branding_settings for all using (auth.uid() = user_id);
  end if;
end $$;

