-- ============================================================================
-- Migration: 007_agent_config
-- Purpose: Ensure agent_config table exists for Phase 2 agent operations
-- ============================================================================

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
