/**
 * fetch-service-key.js
 * Fetches the service role key using Supabase Management API
 * Requires a personal access token from https://supabase.com/dashboard/account/tokens
 * 
 * HOW TO USE:
 * 1. Go to https://supabase.com/dashboard/account/tokens
 * 2. Generate a new token, copy it
 * 3. Run: $env:SUPABASE_PAT="your-token"; node fetch-service-key.js
 */

require('dotenv').config()
const https = require('https')

const PROJECT_REF = 'tpofqgrepocqtbftiopg'
const PAT = process.env.SUPABASE_PAT

if (!PAT) {
  console.log(`
⚠️  Personal Access Token required!

Steps:
1. Go to: https://supabase.com/dashboard/account/tokens
2. Click "Generate new token"
3. Copy the token
4. Run this command in PowerShell:
   $env:SUPABASE_PAT="your-token-here"; node fetch-service-key.js
`)
  process.exit(0)
}

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.supabase.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${PAT}`,
        'Content-Type': 'application/json',
      }
    }

    if (body) {
      const data = JSON.stringify(body)
      options.headers['Content-Length'] = Buffer.byteLength(data)
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) })
        } catch {
          resolve({ status: res.statusCode, body: data })
        }
      })
    })

    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

async function main() {
  console.log('🔑 Fetching project API keys...\n')

  // Get API keys
  const keysRes = await makeRequest(`/v1/projects/${PROJECT_REF}/api-keys`)
  
  if (keysRes.status !== 200) {
    console.error('Failed to fetch keys:', keysRes.body)
    return
  }

  const keys = keysRes.body
  const serviceKey = keys.find(k => k.name === 'service_role')
  const anonKey = keys.find(k => k.name === 'anon')

  if (serviceKey) {
    console.log('✅ Service Role Key found!\n')
    console.log('Add to backend/.env:')
    console.log(`SUPABASE_SERVICE_ROLE_KEY=${serviceKey.api_key}\n`)
  }

  // Run the SQL schema
  console.log('📊 Running SQL schema...')
  const sqlRes = await makeRequest(
    `/v1/projects/${PROJECT_REF}/database/query`,
    'POST',
    {
      query: `
        create extension if not exists "uuid-ossp";

        create table if not exists leads (
          id uuid primary key default uuid_generate_v4(),
          user_id uuid not null references auth.users(id) on delete cascade,
          name text not null,
          business_type text, city text, address text, phone text,
          website text, rating text, email text,
          source text default 'google_maps', source_url text,
          summary text, outreach_message text, ai_score integer,
          score_reason text, enriched_at timestamptz,
          status text default 'new',
          notes text,
          created_at timestamptz default now(),
          updated_at timestamptz default now()
        );

        alter table leads enable row level security;

        create table if not exists campaigns (
          id uuid primary key default uuid_generate_v4(),
          user_id uuid not null references auth.users(id) on delete cascade,
          name text not null, description text default '',
          created_at timestamptz default now(),
          updated_at timestamptz default now()
        );

        alter table campaigns enable row level security;

        create table if not exists campaign_leads (
          campaign_id uuid references campaigns(id) on delete cascade,
          lead_id uuid references leads(id) on delete cascade,
          added_at timestamptz default now(),
          primary key (campaign_id, lead_id)
        );

        alter table campaign_leads enable row level security;
      `
    }
  )

  if (sqlRes.status === 200 || sqlRes.status === 201) {
    console.log('✅ Database schema created successfully!')
  } else {
    console.log('SQL result:', sqlRes.status, sqlRes.body)
  }
}

main().catch(console.error)
