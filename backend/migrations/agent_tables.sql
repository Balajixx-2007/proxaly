/**
 * PHASE 2: Supabase Table Schemas
 * 
 * Run this migration to set up the database structure for in-process agent.
 * 
 * Usage:
 *   1. Copy the SQL below into Supabase migration editor
 *   2. Or run: supabase migration new agent_tables
 */

-- ============================================================================
-- TABLE: agent_leads
-- Purpose: Track leads sent to marketing agent and their processing status
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  user_id UUID NOT NULL,
  
  -- Status: pending, queued, pending_approval, approved, sent, failed, replied, archived
  status TEXT DEFAULT 'queued' CHECK (status IN (
    'queued', 'pending_approval', 'approved', 'sent', 'failed', 'replied', 'archived'
  )),
  
  -- Lead details snapshot (for historical reference)
  email TEXT NOT NULL,
  lead_name TEXT,
  company TEXT,
  
  -- Processing timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  queued_at TIMESTAMP,
  approval_requested_at TIMESTAMP,
  approved_at TIMESTAMP,
  sent_at TIMESTAMP,
  failed_at TIMESTAMP,
  reply_received_at TIMESTAMP,
  archived_at TIMESTAMP,
  
  -- Error tracking
  failure_reason TEXT,
  failure_attempt_count INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP,
  
  -- Email metadata
  email_template_used TEXT,
  email_subject TEXT,
  email_body_preview TEXT,
  brevo_message_id TEXT,
  
  -- Reply detection
  reply_from TEXT,
  reply_body_preview TEXT,
  reply_received_timestamp TIMESTAMP,
  
  -- Agent enrichment data
  lead_enrichment JSONB,
  agent_metadata JSONB,
  
  created_at_index TIMESTAMP DEFAULT NOW() -- For efficient queries
);

CREATE INDEX IF NOT EXISTS agent_leads_user_id ON agent_leads(user_id);
CREATE INDEX IF NOT EXISTS agent_leads_status ON agent_leads(status);
CREATE INDEX IF NOT EXISTS agent_leads_email ON agent_leads(email);
CREATE INDEX IF NOT EXISTS agent_leads_created_at ON agent_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS agent_leads_status_created ON agent_leads(status, created_at DESC);

-- ============================================================================
-- TABLE: agent_approvals
-- Purpose: Approval queue for leads waiting for operator approval before send
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_lead_id UUID NOT NULL REFERENCES agent_leads(id) ON DELETE CASCADE,
  
  -- Status: pending, approved, rejected, expired
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'expired'
  )),
  
  -- Approval metadata
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days', -- Auto-expire after 7 days
  approved_at TIMESTAMP,
  rejected_at TIMESTAMP,
  
  -- Who approved/rejected
  approved_by UUID REFERENCES auth.users(id),
  rejected_by UUID REFERENCES auth.users(id),
  
  -- Rejection reason (optional)
  rejection_reason TEXT,
  
  -- UI display
  priority INTEGER DEFAULT 0, -- Higher = more urgent
  notes TEXT,
  
  -- Preview data for approval UI
  preview_content JSONB COMMENT 'Email preview, lead summary, etc.'
);

CREATE INDEX IF NOT EXISTS agent_approvals_status ON agent_approvals(status);
CREATE INDEX IF NOT EXISTS agent_approvals_agent_lead_id ON agent_approvals(agent_lead_id);
CREATE INDEX IF NOT EXISTS agent_approvals_created_at ON agent_approvals(created_at DESC);
CREATE INDEX IF NOT EXISTS agent_approvals_expires_at ON agent_approvals(expires_at);
CREATE INDEX IF NOT EXISTS agent_approvals_pending ON agent_approvals(status) WHERE status = 'pending';

-- ============================================================================
-- TABLE: agent_config
-- Purpose: Runtime configuration for agent service
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

-- Insert default configuration
INSERT INTO agent_config (key, value, value_type, description) VALUES
  ('approval_mode_enabled', 'true', 'boolean', 'Enable approval queue before sending emails'),
  ('tick_interval_ms', '30000', 'number', 'How often agent tick loop runs (milliseconds)'),
  ('max_daily_sends', '500', 'number', 'Maximum emails to send per day'),
  ('imap_check_enabled', 'true', 'boolean', 'Enable IMAP monitoring for replies'),
  ('imap_check_interval_ms', '60000', 'number', 'How often to check inbox for replies'),
  ('email_provider', 'brevo', 'string', 'Which email provider to use (brevo, smtp)'),
  ('agent_status', 'stopped', 'string', 'Current agent status (running, stopped, error)')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- TABLE: agent_logs
-- Purpose: Structured event logging for audit trail and debugging
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event type: lead_queued, approval_pending, approval_approved, approval_rejected,
  --             email_sent, email_failed, reply_detected, agent_tick, error, config_updated
  event_type TEXT NOT NULL,
  
  -- References
  agent_lead_id UUID REFERENCES agent_leads(id),
  deal_id UUID,
  user_id UUID,
  
  -- Event details
  message TEXT,
  metadata JSONB,
  error_stack TEXT,
  severity TEXT DEFAULT 'info', -- debug, info, warn, error
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  occurred_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_logs_event_type ON agent_logs(event_type);
CREATE INDEX IF NOT EXISTS agent_logs_agent_lead_id ON agent_logs(agent_lead_id);
CREATE INDEX IF NOT EXISTS agent_logs_created_at ON agent_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS agent_logs_severity ON agent_logs(severity);

-- ============================================================================
-- TABLE: agent_stats
-- Purpose: Real-time statistics for agent dashboard
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Count snapshots
  total_leads_sent TODAY INTEGER DEFAULT 0,
  total_leads_approved_today INTEGER DEFAULT 0,
  total_replies_today INTEGER DEFAULT 0,
  pending_approval_count INTEGER DEFAULT 0,
  queued_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  
  -- Performance metrics
  avg_time_to_send_ms INTEGER, -- Average time from queued → sent
  approval_rate_percent FLOAT, -- % of queued leads that get approved
  send_success_rate_percent FLOAT, -- % of approved that actually send
  
  -- Timestamps
  updated_at TIMESTAMP DEFAULT NOW(),
  day DATE DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS agent_stats_day ON agent_stats(day DESC);

-- ============================================================================
-- FUNCTION: update_agent_lead_status
-- Purpose: Audit trail for status changes
-- ============================================================================
CREATE OR REPLACE FUNCTION update_agent_lead_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO agent_logs (event_type, agent_lead_id, metadata, message)
    VALUES (
      'lead_status_changed',
      NEW.id,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
      'Lead status changed from ' || OLD.status || ' to ' || NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_lead_status_change ON agent_leads;
CREATE TRIGGER agent_lead_status_change
  AFTER UPDATE ON agent_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_lead_status();

-- ============================================================================
-- FUNCTION: clean_expired_approvals
-- Purpose: Archive or delete expired approvals (runs nightly)
-- ============================================================================
CREATE OR REPLACE FUNCTION clean_expired_approvals()
RETURNS void AS $$
BEGIN
  UPDATE agent_approvals
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < NOW();
  
  INSERT INTO agent_logs (event_type, metadata, message)
  SELECT 'approval_expired', 
         jsonb_build_object('expired_count', count(*) FILTER (WHERE status = 'expired')),
         'Cleaned up ' || count(*) || ' expired approvals'
  FROM agent_approvals WHERE status = 'expired' AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup function (requires pg_cron extension)
-- SELECT cron.schedule('clean-expired-approvals', '0 2 * * *', 'SELECT clean_expired_approvals()');

-- ============================================================================
-- POLICIES: Row-Level Security
-- ============================================================================

ALTER TABLE agent_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_stats ENABLE ROW LEVEL SECURITY;

-- Users can only see their own agent leads
CREATE POLICY agent_leads_select ON agent_leads
FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY agent_leads_insert ON agent_leads
FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY agent_leads_update ON agent_leads
FOR UPDATE USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

-- Approvals visible to user and admins
CREATE POLICY agent_approvals_select ON agent_approvals
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM agent_leads
    WHERE agent_leads.id = agent_approvals.agent_lead_id
    AND (agent_leads.user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin')
  )
);

-- Config readable by all authenticated users, writable by admins only
CREATE POLICY agent_config_select ON agent_config
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY agent_config_update ON agent_config
FOR UPDATE USING (auth.jwt() ->> 'role' = 'admin');

-- Logs readable by owner or admin
CREATE POLICY agent_logs_select ON agent_logs
FOR SELECT USING (
  auth.jwt() ->> 'role' = 'admin' OR
  user_id = auth.uid() OR
  (agent_lead_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM agent_leads
    WHERE agent_leads.id = agent_logs.agent_lead_id
    AND agent_leads.user_id = auth.uid()
  ))
);

-- ============================================================================
-- VIEWS: Useful queries for dashboard
-- ============================================================================

-- Current approval queue (pending approvals)
CREATE OR REPLACE VIEW approval_queue AS
SELECT
  al.id as lead_id,
  al.email,
  al.lead_name,
  al.company,
  aa.id as approval_id,
  aa.created_at as queued_at,
  aa.priority,
  aa.notes,
  aa.preview_content
FROM agent_approvals aa
JOIN agent_leads al ON aa.agent_lead_id = al.id
WHERE aa.status = 'pending'
ORDER BY aa.priority DESC, aa.created_at ASC;

-- Agent performance stats
CREATE OR REPLACE VIEW agent_performance AS
SELECT
  DATE(created_at) as date,
  (SELECT COUNT(*) FROM agent_leads WHERE status = 'sent' AND DATE(sent_at) = DATE(created_at)) as sends_today,
  (SELECT COUNT(*) FROM agent_leads WHERE status = 'failed' AND DATE(failed_at) = DATE(created_at)) as failures_today,
  (SELECT COUNT(*) FROM agent_leads WHERE status = 'replied' AND DATE(reply_received_at) = DATE(created_at)) as replies_today,
  (SELECT COUNT(*) FROM agent_approvals WHERE status = 'pending') as pending_approvals,
  (SELECT AVG(EXTRACT(EPOCH FROM (sent_at - created_at))) FROM agent_leads WHERE status = 'sent' AND DATE(sent_at) = DATE(created_at)) as avg_time_to_send_sec
FROM agent_leads
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;

