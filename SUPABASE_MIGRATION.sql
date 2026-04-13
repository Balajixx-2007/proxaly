-- ══════════════════════════════════════════════════════════════════════════════
-- Proxaly — Full Database Migration
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/tpofqgrepocqtbftiopg/sql/new
-- 
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ══════════════════════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── LEADS TABLE ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  business_type   text,
  city            text,
  address         text,
  phone           text,
  website         text,
  rating          text,
  email           text,
  source          text DEFAULT 'google_maps',
  source_url      text,
  summary         text,
  outreach_message text,
  ai_score        integer,
  score_reason    text,
  enriched        boolean DEFAULT false,
  enriched_at     timestamptz,
  contacted_at    timestamptz,
  status          text DEFAULT 'new',
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'leads_select') THEN
    CREATE POLICY "leads_select" ON leads FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'leads_insert') THEN
    CREATE POLICY "leads_insert" ON leads FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'leads_update') THEN
    CREATE POLICY "leads_update" ON leads FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'leads_delete') THEN
    CREATE POLICY "leads_delete" ON leads FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(user_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(user_id, created_at DESC);


-- ── CAMPAIGNS TABLE ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text DEFAULT '',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaigns' AND policyname = 'campaigns_all') THEN
    CREATE POLICY "campaigns_all" ON campaigns FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);


-- ── CAMPAIGN_LEADS JUNCTION TABLE ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_leads (
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id     uuid REFERENCES leads(id) ON DELETE CASCADE,
  added_at    timestamptz DEFAULT now(),
  PRIMARY KEY (campaign_id, lead_id)
);

ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaign_leads' AND policyname = 'campaign_leads_all') THEN
    CREATE POLICY "campaign_leads_all" ON campaign_leads FOR ALL
      USING (EXISTS (
        SELECT 1 FROM campaigns
        WHERE campaigns.id = campaign_leads.campaign_id
          AND campaigns.user_id = auth.uid()
      ));
  END IF;
END $$;


-- ── CLIENTS TABLE ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  email           text NOT NULL,
  business_name   text DEFAULT '',
  niche           text DEFAULT '',
  plan            text DEFAULT 'starter',
  notes           text DEFAULT '',
  portal_token    text NOT NULL UNIQUE,
  status          text DEFAULT 'active',
  leads_sent      integer DEFAULT 0,
  meetings_booked integer DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clients' AND policyname = 'clients_all') THEN
    CREATE POLICY "clients_all" ON clients FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clients_user_created ON clients(user_id, created_at DESC);


-- ── AGENT QUEUE TABLE ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_queue (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id    uuid,
  payload    jsonb NOT NULL,
  retries    int DEFAULT 0,
  status     text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agent_queue ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_queue' AND policyname = 'agent_queue_all') THEN
    CREATE POLICY "agent_queue_all" ON agent_queue FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_queue_status ON agent_queue(status, created_at ASC);


-- ── EMAIL SEQUENCES TABLE ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_sequences (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  steps      jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_sequences' AND policyname = 'email_sequences_all') THEN
    CREATE POLICY "email_sequences_all" ON email_sequences FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;


-- ── EMAIL LOGS TABLE ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_logs (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id             uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  campaign_id         uuid,
  sequence_id         uuid REFERENCES email_sequences(id) ON DELETE SET NULL,
  step                int NOT NULL DEFAULT 1,
  status              text NOT NULL DEFAULT 'pending',
  subject             text,
  body                text,
  provider_message_id text,
  scheduled_at        timestamptz,
  sent_at             timestamptz,
  error_text          text,
  retry_count         int DEFAULT 0,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_logs' AND policyname = 'email_logs_all') THEN
    CREATE POLICY "email_logs_all" ON email_logs FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_logs_pending ON email_logs(status, scheduled_at ASC);
CREATE INDEX IF NOT EXISTS idx_email_logs_user ON email_logs(user_id, created_at DESC);


-- ── AUTO-UPDATE updated_at TRIGGER ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'leads_updated_at') THEN
    CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'campaigns_updated_at') THEN
    CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'clients_updated_at') THEN
    CREATE TRIGGER clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;


-- ── AGENT CONFIG TABLE ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  value_type TEXT DEFAULT 'string', -- string, boolean, number, json
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS agent_config_key ON agent_config(key);

-- Insert default configuration (safe on re-run due to ON CONFLICT DO NOTHING)
INSERT INTO agent_config (key, value, value_type, description) VALUES
  ('agent_status', 'stopped', 'string', 'Current agent status (running, stopped, error)'),
  ('approval_mode_enabled', 'true', 'boolean', 'Enable approval queue before sending emails'),
  ('tick_interval_ms', '30000', 'number', 'How often agent tick loop runs (milliseconds)'),
  ('max_daily_sends', '500', 'number', 'Maximum emails to send per day'),
  ('imap_check_enabled', 'true', 'boolean', 'Enable IMAP monitoring for replies'),
  ('imap_check_interval_ms', '60000', 'number', 'How often to check inbox for replies'),
  ('email_provider', 'brevo', 'string', 'Which email provider to use (brevo, smtp)')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS and create policies
ALTER TABLE agent_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_config' AND policyname = 'agent_config_select') THEN
    CREATE POLICY "agent_config_select" ON agent_config
      FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_config' AND policyname = 'agent_config_update') THEN
    CREATE POLICY "agent_config_update" ON agent_config
      FOR UPDATE USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ── DONE ──────────────────────────────────────────────────────────────────────
-- All tables created. Your Proxaly backend should now work fully.
-- Next: deploy backend to Railway/Render with these env vars in .env
