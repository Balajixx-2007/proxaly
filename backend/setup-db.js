/**
 * setup-db.js — Run this ONCE to create all Supabase tables
 * Usage: node setup-db.js
 * 
 * This uses the Supabase REST API to execute SQL directly.
 * Requires your service role key (or anon key for public queries).
 */

require('dotenv').config()
const https = require('https')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or key in .env')
  process.exit(1)
}

// Extract project ref from URL
const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0]
console.log(`📦 Project: ${projectRef}`)

const SQL = `
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- LEADS TABLE
create table if not exists leads (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  business_type   text,
  city            text,
  address         text,
  phone           text,
  website         text,
  rating          text,
  email           text,
  source          text default 'google_maps',
  source_url      text,
  summary         text,
  outreach_message text,
  ai_score        integer,
  score_reason    text,
  enriched_at     timestamptz,
  status          text default 'new',
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- RLS
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
create index if not exists idx_leads_created on leads(user_id, created_at desc);

-- CAMPAIGNS TABLE
create table if not exists campaigns (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text default '',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table campaigns enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'campaigns' and policyname = 'campaigns_all') then
    create policy "campaigns_all" on campaigns for all using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists idx_campaigns_user_id on campaigns(user_id);

-- CAMPAIGN_LEADS JUNCTION TABLE
create table if not exists campaign_leads (
  campaign_id uuid references campaigns(id) on delete cascade,
  lead_id     uuid references leads(id) on delete cascade,
  added_at    timestamptz default now(),
  primary key (campaign_id, lead_id)
);

alter table campaign_leads enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'campaign_leads' and policyname = 'campaign_leads_all') then
    create policy "campaign_leads_all" on campaign_leads for all
      using (exists (
        select 1 from campaigns
        where campaigns.id = campaign_leads.campaign_id
        and campaigns.user_id = auth.uid()
      ));
  end if;
end $$;

-- AUTO-UPDATE trigger
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
`

function runSQL(sql) {
  return new Promise((resolve, reject) => {
    const host = SUPABASE_URL.replace('https://', '')
    const body = JSON.stringify({ query: sql })

    const options = {
      hostname: host,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data })
      })
    })

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// Alternative: Use pg direct connection or Supabase SQL API
async function setupViaAPI() {
  console.log('🔌 Connecting to Supabase...')
  
  // Try using Supabase's undocumented SQL endpoint  
  const host = SUPABASE_URL.replace('https://', '')
  
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: SQL.trim() })

    const options = {
      hostname: host,
      path: '/rest/v1/rpc/exec',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Length': Buffer.byteLength(body),
        'Prefer': 'return=representation'
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ SQL executed successfully via REST API!')
          resolve(data)
        } else {
          console.log(`ℹ️  REST API returned ${res.statusCode}: ${data}`)
          console.log('\n📋 MANUAL SETUP REQUIRED')
          console.log('Copy and run this SQL in your Supabase SQL Editor:')
          console.log('https://supabase.com/dashboard/project/tpofqgrepocqtbftiopg/sql/new\n')
          console.log('─'.repeat(60))
          console.log(SQL)
          console.log('─'.repeat(60))
          resolve(null)
        }
      })
    })

    req.on('error', (err) => {
      console.error('Connection error:', err.message)
      reject(err)
    })

    req.write(body)
    req.end()
  })
}

// Also test if tables exist via the standard REST API
async function checkTablesExist() {
  const { createClient } = require('@supabase/supabase-js')
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
  })

  console.log('\n🔍 Checking if tables exist...')
  
  const checks = ['leads', 'campaigns', 'campaign_leads']
  
  for (const table of checks) {
    const { data, error } = await supabase.from(table).select('id').limit(1)
    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('does not exist') || error.code === '42P01') {
        console.log(`  ❌ Table "${table}" does NOT exist — needs creation`)
      } else if (error.code === 'PGRST301' || error.message.includes('JWT')) {
        console.log(`  ⚠️  Table "${table}" — auth required (table may exist)`)
      } else {
        console.log(`  ⚠️  Table "${table}": ${error.message} (code: ${error.code})`)
      }
    } else {
      console.log(`  ✅ Table "${table}" exists!`)
    }
  }
}

async function main() {
  console.log('🚀 Proxaly DB Setup\n')
  
  try {
    await checkTablesExist()
    await setupViaAPI()
  } catch (err) {
    console.error('Error:', err.message)
  }
  
  console.log('\n📌 Next steps:')
  console.log('1. Go to https://supabase.com/dashboard/project/tpofqgrepocqtbftiopg/sql/new')
  console.log('2. Paste the contents of E:\\ai leads\\supabase_schema.sql')
  console.log('3. Click Run')
  console.log('4. Go to Authentication > Providers > Email → disable "Confirm email"')
}

main()
