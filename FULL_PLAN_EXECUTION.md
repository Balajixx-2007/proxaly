# Complete Execution Plan: Proxaly Single-Project Integration

## Document Index

This folder now contains your complete roadmap for the Proxaly + Marketing Agent integration:

1. **THIS FILE** - Executive overview and quick-start guide
2. **PHASE_1_DEPLOYMENT.md** - Production deployment checklist for unified Agent Hub
3. **PHASE_2_ARCHITECTURE.md** - In-process agent integration design and implementation roadmap

---

## Executive Summary

You have a **single strategic goal**: Merge the Marketing Agent into the Proxaly project so users have one unified interface instead of two separate services/tabs.

**Current State:** Phase 1 ✅ **COMPLETE & READY TO DEPLOY**
- Backend Agent Hub routes written and tested locally
- Frontend Agent Hub page built and linked into navigation  
- Code committed to main branch
- **Blocker:** Production environment not configured

**Next Immediate Action:** Follow PHASE_1_DEPLOYMENT.md to go live

---

## Phase Timeline

```
┌────────────────────────────────────────────────────────────────────┐
│  PHASE 1: Deploy Unified Agent Hub (Week 1)                       │
├────────────────────────────────────────────────────────────────────┤
│  Status: ✅ CODE COMPLETE                                         │
│  Blockers: ⚠️ Environment config                                  │
│  Effort: ~30 min (just env config + redeploy)                    │
│  Outcome: Users see Agent Hub in sidebar, can manage agent from   │
│           Proxaly without switching to your-agent-service.example.com             │
│  Success: Agent Hub loads, send-to-agent works, approvals queue   │
└────────────────────────────────────────────────────────────────────┘
        ↓
┌────────────────────────────────────────────────────────────────────┐
│  PHASE 2: In-Process Integration (Week 2-5, Optional)             │
├────────────────────────────────────────────────────────────────────┤
│  Status: 🔄 ARCHITECTURE DOCUMENTED                               │
│  Blockers: None (clear design ready)                              │
│  Effort: ~2-3 weeks (3-4 engineers) or ~5-6 weeks (solo)         │
│  Outcome: Single backend service, no external agent dependency    │
│  Success: Same functionality, faster, simpler deployment          │
└────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### For Phase 1 Deployment (Do First)

**Time Estimate:** 30 minutes to 1 hour

1. Open **PHASE_1_DEPLOYMENT.md**
2. Follow sections in order:
   - Configure MARKETING_AGENT_URL env var in Railway
   - Trigger backend redeploy
   - Trigger frontend redeploy
   - Run 4 manual tests
3. Verify all tests pass
4. **Done!** Users now have unified Agent Hub

### For Phase 2 Planning (Do Later)

**Time Estimate:** 2-8 hours for planning, 2-6 weeks for implementation

1. Open **PHASE_2_ARCHITECTURE.md**
2. Review sections 1-7 to understand the design
3. Answer the "Questions to Answer Before Starting" (section 8)
4. If proceeding:
   - Break into 5-week sprints (section 6)
   - Prototype core tick loop (week 2)
   - Integrate with backend (week 3)
   - Test and deploy (weeks 4-5)

---

## What Just Happened (Recent Work)

In the last phase of integration, the following was completed:

### Code Changes Committed
```
Commit 4ff7f2d: "Add unified Agent Hub routes and in-app approvals UI"

Files Changed:
├── backend/routes/agent.js          ← NEW: Proxy routes for agent operations
├── backend/index.js                 ← Updated: Registered agent router
├── frontend/src/pages/AgentHub.jsx  ← NEW: Agent Hub UI component
├── frontend/src/App.jsx             ← Updated: Added /agent route
├── frontend/src/components/Layout.jsx ← Updated: Added sidebar menu item
└── frontend/src/lib/api.js          ← Updated: Agent API client methods
```

### Validation Completed
- ✅ Frontend lint: Zero errors
- ✅ Frontend build: 629 KB gzipped production bundle
- ✅ Backend smoke tests: 32/32 passing
- ✅ New routes tested locally (working)
- ✅ Git commit pushed to origin/main

### Known Issues Resolved
1. **Send-to-Agent Failure** → Root cause: Missing MARKETING_AGENT_URL env var
2. **Row-Level Send Bypass** → Fixed: Added offline guard
3. **Email Delivery Delay** → Root cause: Approval mode queueing (working as designed)

---

## Architecture Overview

### Phase 1: External Agent Service
```
┌─────────────────────────────────┐
│     Proxaly Frontend (React)    │
│  https://proxaly.vercel.app     │
│                                 │
│  Agent Hub page at /agent       │
└─────────────────────────────────┘
              ↓ HTTP
┌─────────────────────────────────┐
│    Proxaly Backend (Express)    │
│    Railway                      │
│                                 │
│  /api/agent/* routes (proxies)  │
│  All other Proxaly routes       │
└─────────────────────────────────┘
              ↓ HTTP via MARKETING_AGENT_URL
┌─────────────────────────────────┐
│   Marketing Agent Service       │
│   (External service endpoint)    │
│                                 │
│   Lead queueing, approvals,     │
│   email sending, reply detection│
└─────────────────────────────────┘
```

### Phase 2: In-Process Agent (Target)
```
┌─────────────────────────────────┐
│     Proxaly Frontend (React)    │
│  https://proxaly.vercel.app     │
│                                 │
│  Agent Hub page at /agent       │
└─────────────────────────────────┘
              ↓ HTTP
┌─────────────────────────────────────────┐
│    Proxaly Backend (Express + Agent)    │
│    Railway (Single container)           │
│                                         │
│  /api/agent/* routes                    │
│  All other Proxaly routes               │
│  Agent tick loop (built-in)             │
│  Agent config (Supabase)                │
│  Lead queue (Supabase)                  │
│  Approvals queue (Supabase)             │
│  Email sending, reply detection         │
└─────────────────────────────────────────┘
              ↓ HTTP
┌─────────────────────────────────┐
│      Supabase (Data Layer)      │
│                                 │
│  All agent state stored here    │
│  Multi-instance compatible      │
└─────────────────────────────────┘
```

---

## Critical Files Reference

| File | Purpose | Status |
|------|---------|--------|
| backend/routes/agent.js | Proxy routes to agent | ✅ Ready |
| frontend/src/pages/AgentHub.jsx | Agent Hub UI | ✅ Ready |
| backend/routes/leads.js | Send lead to agent (line 383, 479) | ✅ Sends to MARKETING_AGENT_URL |
| frontend/src/lib/api.js | Agent API client | ✅ Wired up |
| backend/index.js | App entry point | ✅ Routes registered |
| PHASE_1_DEPLOYMENT.md | Production deployment steps | ✅ This doc |
| PHASE_2_ARCHITECTURE.md | Phase-2 design docs | ✅ This doc |

---

## Success Metrics

### Phase 1 (After Deployment)
- [ ] `/api/agent/status` returns 200 (not 404) on production
- [ ] `/agent` page loads in browser with no errors
- [ ] Users see Agent Hub in sidebar
- [ ] Can send lead to agent with success toast
- [ ] Lead appears in Agent Hub approvals list
- [ ] Can approve/reject and email sends appropriately
- [ ] Agent start/stop buttons work

### Phase 2 (After Implementation, If Pursuing)
- [ ] Single backend service (no external agent needed)
- [ ] Same email throughput as phase 1
- [ ] Reply detection working
- [ ] Approvals UI unchanged
- [ ] All 32 smoke tests passing
- [ ] No environment variables for agent URL needed
- [ ] 48-hour production stability test passes

---

## Decision Flowchart

```
                  Phase 1 Deployed?
                        ↓
                   YES ← → NO
                   ↓        ↓
                   ✓    Follow PHASE_1_DEPLOYMENT.md
                   ↓    (30 min to 1 hour)
                   ↓
         Ready for Phase 2?
                   ↓
           YES ←  → NO
           ↓         ↓
           ↓         STOP (Use phase 1 long-term)
           ↓
    Team capacity for 2-6 weeks?
           ↓
      YES ← → NO
      ↓        ↓
      ↓        STOP (Don't start phase 2 yet)
      ↓
   Begin Phase 2
   (Follow PHASE_2_ARCHITECTURE.md)
```

---

## FAQ

**Q: Do I need to deploy anything manually right now?**
A: Yes! Follow PHASE_1_DEPLOYMENT.md. The code is ready, but the environment needs one variable set (MARKETING_AGENT_URL). Without it, send-to-agent will keep failing.

**Q: How long will phase 1 deployment take?**
A: ~30 minutes to 1 hour including manual testing.

**Q: Do I have to do phase 2?**
A: No. Phase 1 is a complete solution. Phase 2 is an optional optimization for better performance and simpler operations. You can use phase 1 indefinitely.

**Q: When should I do phase 2?**
A: After phase 1 is stable and you want to eliminate the external agent service dependency. Good timing would be when you're scaling to multiple backend instances.

**Q: What if phase 1 fails to deploy?**
A: Refer to "Troubleshooting" section in PHASE_1_DEPLOYMENT.md. Most issues are env var typos or agent service not reachable.

**Q: Can I rollback if something breaks?**
A: Yes. PHASE_1_DEPLOYMENT.md has rollback steps for each failure mode.

**Q: Who needs to do this work?**
A: For phase 1: DevOps/SRE (just env config + redeploy, ~30 min). For phase 2: Backend engineers (2-6 weeks).

---

## Communication Template

### To Your Team

**Subject: Proxaly + Marketing Agent Single-Project Integration - Deployment Ready**

```
We've completed phase 1 of the strategic merge: Proxaly + Marketing Agent are now unified.

✅ COMPLETE:
- Backend Agent Hub routes (proxies to marketing agent)
- Frontend Agent Hub page (new /agent route in sidebar)
- Navigation wired
- Full validation (lint, build, smoke tests)

⏳ PENDING:
- Production deployment (30 min task)
- Set MARKETING_AGENT_URL environment variable on Railway
- Redeploy backend + frontend
- Manual testing in production

📋 ACTION ITEMS:
1. DevOps: Set MARKETING_AGENT_URL env var in Railway and redeploy
2. QA: Test Agent Hub page loads and send-to-agent works
3. All: Watch production for 24 hours for any issues

🎯 NEXT PHASE (Optional):
If you approve, phase 2 will move agent into same backend process 
(eliminates external service dependency, faster, simpler deploy).
Discussion needed on resource commitment (2-6 weeks).

See PHASE_1_DEPLOYMENT.md for full details.
```

### To Your Users (After Phase 1 Goes Live)

```
🎉 NEW: Unified Agent Hub

You now have an Agent control panel directly in Proxaly!

OLD WAY:
- Use Proxaly to send leads to marketing agent
- Switch to https://your-agent-service.example.com to manage agent and approvals
- Two separate tabs, two separate UIs

NEW WAY:
- Use Proxaly to send leads to marketing agent (same)
- Click "Agent Hub" in the sidebar to manage agent and approvals (NEW!)
- Everything in one interface

HOW TO USE:
1. Go to Proxaly
2. Click "Agent Hub" in left sidebar
3. You'll see:
   - Current agent status (running/stopped)
   - Pending approvals list
   - Start/Stop buttons

APPROVALS WORKFLOW:
1. Send lead(s) via Leads tab (same as before)
2. Lead(s) appear in Agent Hub approvals
3. Review and click ✓ Approve or ✗ Reject
4. Approved leads send via email immediately

Questions? Refer to the Agent Hub help in-app.
```

---

## Next Steps (In Priority Order)

1. **READ:** PHASE_1_DEPLOYMENT.md (5 min)
2. **EXECUTE:** Phase 1 steps (30-60 min)
3. **VALIDATE:** Run 4 manual tests (10 min)
4. **MONITOR:** Check production for 24 hours
5. **DECIDE:** Do you want phase 2? (Requires team discussion)
6. **PLAN:** If yes, start phase 2 sprint planning using PHASE_2_ARCHITECTURE.md

---

## Support & Escalation

**If phase 1 deployment gets stuck:**
- Check PHASE_1_DEPLOYMENT.md troubleshooting section
- Most issues: MARKETING_AGENT_URL typo or agent service not reachable
- Verify: curl $MARKETING_AGENT_URL/health works locally

**If you decide to do phase 2:**
- Review PHASE_2_ARCHITECTURE.md section 8 (Questions to Answer)
- Schedule tech spec review with backend team
- Assign one engineer to prototype core loop
- Track 5-week sprint schedule

**For other issues:**
- Check conversation summary in chat (links to all files modified)
- Review commit 4ff7f2d diff on GitHub
- Run smoke tests locally: `node scripts/api-smoke.js`

---

## Files in This Directory That Are New

```
e:\ai leads\
├── PHASE_1_DEPLOYMENT.md          ← Phase 1: Production deployment
├── PHASE_2_ARCHITECTURE.md        ← Phase 2: In-process integration design
├── THIS_FILE                      ← Execution plan overview
├── backend/routes/agent.js        ← NEW: Agent proxy routes
├── backend/index.js               ← UPDATED: Registered agent router
├── frontend/src/pages/AgentHub.jsx ← NEW: Agent Hub UI
├── frontend/src/App.jsx           ← UPDATED: /agent route
├── frontend/src/components/Layout.jsx ← UPDATED: Sidebar menu
└── frontend/src/lib/api.js        ← UPDATED: Agent API client
```

**All code is committed to commit 4ff7f2d, pushed to origin/main.**

---

## Success is...

✅ When users see "Agent Hub" in the left sidebar of Proxaly
✅ When they click it and see approvals
✅ When they send a lead and it appears in approvals
✅ When they approve it and email arrives within 30 seconds
✅ When they can start/stop the agent without leaving Proxaly
✅ When send-to-agent works (all 32 smoke tests passing)

Everything else is bonus. 🚀

---

**Version:** 1.0  
**Last Updated:** 2026-04-12  
**Status:** Ready for Phase 1 Deployment  
