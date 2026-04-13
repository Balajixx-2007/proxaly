# Phase 2: In-Process Agent Integration (Architecture)

## Executive Summary

**Goal:** Move Marketing Agent logic into the same Proxaly backend process, eliminating the need for a separate external service.

**Current State (Phase 1):**
```
Proxaly Backend (Railway) → HTTP calls → Marketing Agent Service (your-agent-service.example.com or external)
```

**Target State (Phase 2):**
```
Proxaly Backend (single Railway instance)
├── Core API routes (/api/leads, /api/campaigns, etc.)
├── Agent service (built-in, same process)
│   ├── Tick loop (runs periodically)
│   ├── Lead queue (in Supabase)
│   ├── Approval queue (in Supabase)
│   ├── Email sending (Brevo API)
│   └── Reply detection (IMAP monitoring)
└── Agent Hub API (/api/agent/*)
```

**Benefits:**
| Metric | Phase 1 | Phase 2 |
|--------|---------|----------|
| Services | 2 | 1 |
| Deploy complexity | Medium | Low |
| API latency | ~100ms (HTTP hop) | ~5ms (direct call) |
| UX | Switch between tabs | Single unified tab |
| Scaling | Manual service ops | Horizontal scale single container |
| Failure points | Network between services | Single service reliability |

---

## Architecture Deep Dive

### 1. Data Model Migration (JSON → Supabase)

#### Current (Phase 1 - Agent Service)
```
Marketing Agent Service
├── data/leads.json         ← All lead progress tracked here
├── data/approvals.json     ← Pending outreach approvals
├── data/config.json        ← Agent settings (approval mode, tick interval, etc.)
└── logs/                   ← Text-based logs
```

#### Target (Phase 2 - Proxaly Backend)
```sql
-- Supabase Tables (New)

-- agent_leads: Mirror of leads sent to agent + their status
CREATE TABLE IF NOT EXISTS agent_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id),
  status TEXT DEFAULT 'pending' -- pending, approved, sent, failed, replied
  created_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  sent_at TIMESTAMP,
  failed_at TIMESTAMP,
  reply_received_at TIMESTAMP,
  reply_content TEXT,
  metadata JSONB -- stores agent-specific enrichment data
);

-- agent_approvals: Outreach approvals queue
CREATE TABLE IF NOT EXISTS agent_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_lead_id UUID REFERENCES agent_leads(id),
  status TEXT DEFAULT 'pending' -- pending, approved, rejected
  created_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  rejected_at TIMESTAMP,
  approved_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT
);

-- agent_config: Agent service settings
CREATE TABLE IF NOT EXISTS agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE, -- approval_mode, tick_interval, max_daily_sends
  value TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- agent_logs: Structured event logs (replaces text files)
CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT, -- lead_queued, approval_pending, email_sent, reply_detected
  lead_id UUID,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Benefits of Supabase:**
- Multi-instance support (can run multiple Proxaly instances)
- Real-time subscriptions (approvals update in browser instantly)
- Audit trail (every state change is logged)
- Easy reporting/analytics
- No file I/O, better performance

---

### 2. Code Structure After Phase 2

```
backend/
├── routes/
│   ├── leads.js              ← UNCHANGED (still sends to agent)
│   ├── agent.js              ← UPDATED (calls service directly, not HTTP)
│   └── ...
├── services/
│   ├── automation.js         ← UNCHANGED
│   ├── supabase.js           ← UNCHANGED
│   ├── agentService.js       ← NEW: Core agent logic
│   ├── agentQueue.js         ← NEW: Lead intake & queueing
│   ├── agentApprovals.js     ← NEW: Approval management
│   ├── agentEmail.js         ← NEW: Email sending via Brevo
│   ├── agentIMAP.js          ← NEW: Reply detection
│   └── agentTick.js          ← NEW: Main agent loop
├── agent/
│   ├── index.js              ← Spawns agent tick loop process
│   ├── loop.js               ← Tick loop worker (can be separate process or same)
│   └── config.js             ← Agent configuration defaults
└── index.js                  ← UPDATED (starts agent service on app boot)
```

**Key Migrations:**
- `agentService.js`: Main orchestrator (expose getStatus, start, stop, etc.)
- `agentQueue.js`: Replaces `leads.json` - Supabase-backed queue
- `agentApprovals.js`: Replaces `approvals.json` - approval management
- `agentEmail.js`: Replaces agent's email sending logic (reuse Brevo config)
- `agentIMAP.js`: Replaces agent's IMAP monitoring (reuse email settings)
- `agentTick.js`: Main loop - pulls from queue → checks approvals → sends emails → detects replies

---

### 3. Agent Tick Loop (Core Logic)

**Current (Phase 1 - Marketing Agent Service):**
```javascript
// Pseudocode
setInterval(() => {
  // 1. Load leads from JSON
  const leads = JSON.parse(fs.readFileSync('data/leads.json'))
  
  // 2. Find those pending approval (if approval mode is enabled)
  const pending = leads.filter(l => l.status === 'pending_approval')
  
  // 3. For approved leads, send email via Brevo
  for (let lead of pending) {
    if (lead.approved) {
      sendEmail(lead)
      lead.status = 'sent'
    }
  }
  
  // 4. Check for replies via IMAP
  checkInboxForReplies()
  
  // 5. Write back to JSON
  fs.writeFileSync('data/leads.json', JSON.stringify(leads))
}, TICK_INTERVAL)
```

**Target (Phase 2 - Proxaly Backend Service):**
```javascript
// agentTick.js - Pseudocode
async function agentTick() {
  try {
    // 1. Load config from Supabase
    const config = await agentConfig.getAll()
    
    // 2. Query pending leads from Supabase
    const pending = await db
      .from('agent_leads')
      .select('*, agent_approvals(*)')
      .eq('status', 'pending')
    
    // 3. For each lead, check if approved
    for (let agentLead of pending) {
      const approval = agentLead.agent_approvals?.[0]
      
      if (approval?.status === 'approved') {
        // Send email
        await agentEmail.send(agentLead)
        
        // Update status in Supabase
        await db
          .from('agent_leads')
          .update({ status: 'sent', sent_at: new Date() })
          .eq('id', agentLead.id)
      }
    }
    
    // 4. Check for replies via IMAP
    const replies = await agentIMAP.checkInbox()
    for (let reply of replies) {
      await updateLeadWithReply(reply)
    }
    
    // 5. Log agent tick
    await db.from('agent_logs').insert({
      event_type: 'tick_complete',
      metadata: { processed: pending.length }
    })
    
  } catch (err) {
    captureException(err)
  }
}

// Start loop in backend/services/agentService.js
setInterval(agentTick, config.tickInterval || 30000) // 30s default
```

**Key Differences:**
- Supabase replaces all file I/O
- Real-time capable (WebSocket subscriptions for frontend)
- Better error handling and logging
- Horizontally scalable (multiple backends can coordinate via Supabase)

---

### 4. Frontend Changes (Minimal)

**Phase 1 → Phase 2:**
- ✅ No changes needed to Agent Hub UI (already built for backend routes)
- ✅ `/api/agent/*` routes work the same way
- ✅ Approvals still display and approve/reject flows unchanged
- ⚠️ Latency improves (~100ms → ~5ms)
- 🆕 Optional: Add real-time approvals updates via Supabase subscriptions

**Optional Enhancement (Phase 2.5):**
```typescript
// frontend/src/lib/agentSubscription.ts
// Real-time approvals list updates using Supabase subscriptions
import { supabase } from './supabase'

export function subscribeToApprovals(callback) {
  const subscription = supabase
    .channel('approvals')
    .on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'agent_approvals' 
      },
      callback
    )
    .subscribe()
  
  return subscription
}
```

---

### 5. Deployment Changes

**Phase 1:**
```yaml
Services: 2
  - proxaly-backend (Railway)    ← Proxaly
  - marketing-agent (external)   ← Marketing Agent
Environment: 
  - MARKETING_AGENT_URL must point to agent service
```

**Phase 2:**
```yaml
Services: 1
  - proxaly-backend (Railway)    ← Proxaly + Agent
Environment:
  - MARKETING_AGENT_URL no longer needed
  - Agent config stored in Supabase, not .env
```

**Railway Deployment:**
```dockerfile
# Proxaly backend Dockerfile-phase2
FROM node:18-alpine
WORKDIR /app
COPY backend ./
RUN npm ci --only=production
EXPOSE 3001
CMD ["npm", "start"]
# Backend starts Express server AND agent tick loop in same process
```

---

### 6. Implementation Roadmap

#### Week 1: Foundation
- [ ] Create Supabase tables (agent_leads, agent_approvals, agent_config, agent_logs)
- [ ] Create agentQueue.js (Supabase-backed lead queue)
- [ ] Create agentApprovals.js (approval management)
- [ ] Create agentEmail.js (Brevo integration)
- [ ] Unit tests for each service

#### Week 2: Core Loop
- [ ] Create agentTick.js (main loop)
- [ ] Create agentIMAP.js (reply detection)
- [ ] Create agentService.js (orchestrator)
- [ ] Integration tests (end-to-end: lead → queue → approval → send → reply)

#### Week 3: Backend Integration
- [ ] Update backend/routes/agent.js to use local service (not HTTP calls)
- [ ] Remove dependency on MARKETING_AGENT_URL environment variable
- [ ] Start agent tick loop on app boot
- [ ] Error handling and graceful shutdown

#### Week 4: Testing & Cleanup
- [ ] Load testing (multiple concurrent approvals)
- [ ] Failure recovery (what happens if agent service crashes?)
- [ ] Remove Marketing Agent service dependency
- [ ] Documentation and runbooks
- [ ] Smoke tests (32 API tests still pass)

#### Week 5: Deployment
- [ ] Deploy to Railway
- [ ] Monitor agent tick loop for errors
- [ ] Verify email throughput unchanged
- [ ] Verify reply detection still working
- [ ] Announce single-project era to users 🎉

---

### 7. Risk Mitigation

**Risk: Agent Tick Loop Hangs/Crashes**
- Mitigation: Wrap tick loop in try/catch, log errors, monitoring dashboards
- Fallback: Can still access approvals via API even if loop is down (just won't process new sends)

**Risk: Supabase Connection Lost**
- Mitigation: Queue mechanism with retry logic, automatic reconnect
- Fallback: Agent can tolerate brief outages and resume when connection restored

**Risk: Email Queue Backlog**
- Mitigation: Monitor queue depth in real-time via Supabase queries
- Fallback: Can manually batch-process approvals if loop is under-resourced

**Risk: IMAP Credentials Expire**
- Mitigation: Store credentials securely in Supabase encrypted column
- Mitigation: Refresh tokens automatically, alert on  refresh failures

**Risk: Horizontal Scaling Issues (Multiple Proxaly Instances)**
- Problem: Two instances running agent tick loop = duplicate sends
- Solution: Add leader election or use Supabase queue with atomic operations
- Solution: Or run agent tick loop in dedicated backend instance (later optimization)

---

### 8. Success Criteria for Phase 2

- ✅ All leads sent via in-process agent (not external service)
- ✅ Email throughput same or better than phase 1
- ✅ Reply detection working with same accuracy
- ✅ Approvals tab in Agent Hub works identically
- ✅ Zero additional environment variables needed
- ✅ 32/32 smoke tests passing
- ✅ Single Docker container deployment
- ✅ Production stable for 48 hours with no manual interventions

---

## Next Steps

**If you decide to do Phase 2:**

1. **Plan Sprint:** 
   - Estimate team capacity and timeline
   - Break into 5-week chunks
   - Assign engineers

2. **Create Supabase Tables:**
   - Copy schema from section 4.1 above
   - Run migrations in production test environment first

3. **Prototype Core Loop:**
   - Create agentTick.js in isolation
   - Test locally against actual Supabase
   - Get approval/send/reply flow working

4. **Integrate into Backend:**
   - Wire agentService into backend/index.js
   - Update routes/agent.js to call service directly
   - Remove HTTP dependency

5. **Deploy to Staging:**
   - Railway staging environment
   - Run smoke tests
   - Manual testing with real leads

6. **Deploy to Production:**
   - Blue-green deployment strategy
   - Monitor for errors
   - Have rollback plan ready

---

## Questions to Answer Before Starting Phase 2

1. **Team Capacity:** How many engineers? How many weeks?
2. **Data Migration:** Migrate historical leads from JSON to Supabase, or fresh start?
3. **Marketing Agent Service:** After phase 2, deprecate or keep as backup?
4. **Horizontal Scaling:** Will you run multiple backend instances? If yes, need leader election.
5. **Agent Configuration:** Keep in Supabase or move back to backend `.env`?

---

## Glossary

| Term | Definition |
|------|-----------|
| **Tick Loop** | The agent's main loop that runs every N seconds to process approvals |
| **Lead Queue** | Supabase table of leads pending agent processing |
| **Approval Mode** | When enabled, leads must be approved before email send (prevents spam) |
| **Agent Service** | Backend code that handles queueing, approvals, email, and replies |
| **Brevo API** | Third-party email service (current Mail provider, will remain same in phase 2) |
| **IMAP** | Protocol for monitoring email inbox to detect replies |

