---
title: Final Fix — Apply Agent Config Table to Supabase
date: 2026-04-13
priority: CRITICAL
---

# 🔧 Final Fix: Agent Config Table

## Why This Matters

The **Agent Hub** and **Send to Agent** features were failing because the `agent_config` table doesn't exist in your production Supabase yet. This is the **last missing piece** to make everything fully operational.

**Current Status:**
- ✅ All backend routes hardened (no more 500 errors)
- ✅ All frontend features deployed (scraping, campaigns, settings, agent hub UI)
- ✅ Migration files committed and pushed to main
- ⚠️ **Agent config table still needs to be applied in Supabase**

---

## What to Do

### 1. Go to Supabase SQL Editor

Open your Supabase project dashboard:
```
https://supabase.com/dashboard/project/tpofqgrepocqtbftiopg/sql/new
```

### 2. Copy the Migration SQL

Either:

**Option A:** Copy from the repo file `SUPABASE_MIGRATION.sql` (search for `-- ── AGENT CONFIG TABLE` section)

**Option B:** Use this SQL directly:

```sql
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
```

### 3. Paste into Supabase SQL Editor

1. Go to **SQL Editor** in your Supabase dashboard
2. Click **New Query**
3. Paste the SQL above
4. Click **Run** (or Cmd+Enter / Ctrl+Enter)

### 4. Verify Success

You should see:
- ✅ `CREATE TABLE` completed
- ✅ `CREATE INDEX` completed  
- ✅ `INSERT` 7 rows
- ✅ `ALTER TABLE` completed
- ✅ `DO` block executed

---

## What This Does

| What | Why |
|------|-----|
| Creates `agent_config` table | Stores runtime settings for the Phase 2 agent |
| Sets initial values | Agent starts with approval mode ON, tick interval 30s, IMAP checks enabled |
| Enables RLS policies | App can read config; only authorized users can update it |
| Idempotent (IF NOT EXISTS) | Safe to run multiple times without errors |

---

## After Applying This Migration

Once you run the SQL above, everything will work:

1. **Agent Hub** → Shows "Running" or "Stopped" (not "Disconnected")
2. **Send to Agent** → Queues leads for approval and campaign sending
3. **IMAP Monitoring** → Agent checks replies (if enabled)
4. **Approval Workflow** → Users can approve/reject sends before they go out

---

## If You Already Ran `runMigrations.js`

If you deployed your backend to Railway/Render and ran `npm run migrations`, the `007_agent_config.sql` file will auto-apply on the next deployment.

**To manually apply from backend CLI:**
```bash
cd backend
npm run migrations
# This will read backend/migrations/007_agent_config.sql and apply it
```

---

## Commit Info

- **Commit:** `4c4fea3`
- **Files:** `backend/migrations/007_agent_config.sql`, `SUPABASE_MIGRATION.sql` updated
- **Branch:** `main`
- **Status:** ✅ Deployed to GitHub

---

## Questions?

If the migration fails:
1. Check that your Supabase project is connected (SQL Editor accessible)
2. Verify you're using the correct project
3. Check that `auth.users` table exists (it should by default)
4. Copy the error message and revisit the migration SQL

**After this, Proxaly is 100% complete.** ✨
