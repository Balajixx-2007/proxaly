# Phase 1: Deploy Unified Agent Hub

## Overview
This document guides you through deploying the newly integrated Agent Hub feature that unifies the Proxaly and Marketing Agent UIs into a single dashboard.

**What Changed:**
- ✅ Backend: New `/api/agent/*` proxy routes (already in code)
- ✅ Frontend: New Agent Hub page at `/agent` route (already in code)
- ✅ Navigation: Agent Hub menu item added to sidebar (already in code)
- ⚠️ **PENDING:** Production environment configuration

**Code Commits Ready:**
- `9806d44` - Stabilize frontend flows and harden API/config checks
- `4ff7f2d` - Add unified Agent Hub routes and in-app approvals UI

---

## Critical Blocker: MARKETING_AGENT_URL Environment Variable

### What Is It?
The backend needs to know where the Marketing Agent service is running in production. This is configured via the `MARKETING_AGENT_URL` environment variable.

### Current State
- ❌ **NOT SET** in Railway production backend
- ⚠️ Falls back to `http://localhost:3000` (unreachable from Railway container)
- 🔴 **This is why send-to-agent was failing**

### Required Action
Set the environment variable on Railway production backend to point to your live agent service:

**Option A: Marketing Agent is Self-Hosted**
```
MARKETING_AGENT_URL=https://your-agent-domain.com
```
Example: `https://agent.example.com` or `https://proxaly-agent.up.railway.app`

**Option B: Marketing Agent Still on Localhost (Development)**
```
MARKETING_AGENT_URL=http://localhost:3000
```
This won't work in production! Agent service must be reachable from Railway.

**Option C: Phase-2 Already Complete (In-Process Agent)**
```
# Not needed—agent code is now built into Proxaly backend
# Skip this step and proceed to next section
```

---

## Deployment Steps

### Step 1: Configure Environment Variable (Railway Dashboard)

1. **Go to Railway Dashboard**
   - URL: https://railway.app
   - Select your Proxaly project

2. **Navigate to Settings**
   - Click project → Settings tab
   - Go to "Environment" or "Variables" section

3. **Add/Update Variable**
   - Key: `MARKETING_AGENT_URL`
   - Value: `https://your-live-agent-url-here` (replace with actual URL)
   - **Save**

4. **Verify Variable Is Set**
   ```bash
   # From local terminal, check Railway backend sees it:
   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://proxaly-production.up.railway.app/api/agent/status
   
   # Should return 200 + agent status, NOT 503 "unreachable"
   ```

### Step 2: Trigger Backend Redeploy (Railway)

**Option A: Automatic Redeploy**
- Simply setting the env var in Railway **may automatically trigger redeploy**
- Check Railway dashboard for green checkmark on latest deployment

**Option B: Manual Redeploy**
1. Go to Railway project → Deployments tab
2. Click the latest commit (`4ff7f2d - Add unified Agent Hub routes...`)
3. Click "Redeploy" button
4. Wait for build to complete (~3-5 minutes)

**Verify Backend Is Live:**
```bash
# Test new /api/agent routes
curl https://proxaly-production.up.railway.app/api/agent/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 200 status with agent info or 503 if agent unreachable
# NOT 404 (which means routes not yet deployed)
```

### Step 3: Trigger Frontend Redeploy (Vercel)

1. **Go to Vercel Dashboard**
   - URL: https://vercel.com
   - Select Proxaly project

2. **Trigger Redeploy**
   - Click "Deployments" tab
   - Find commit `4ff7f2d` (or latest main)
   - Click the three dots → "Redeploy"
   - Wait for build to complete (~1-2 minutes)

**Verify Frontend Is Live:**
```bash
# Visit new Agent Hub page
https://proxaly.vercel.app/agent

# Expected: Loads Agent Hub with start/stop controls and approvals list
# Check browser console for errors
```

### Step 4: End-to-End Testing

#### Test 1: Agent Hub Page Loads
```
1. Go to https://proxaly.vercel.app
2. Look for "Agent Hub" in left sidebar (under Automation)
3. Click → Should load Agent Hub page
4. You should see:
   - Current agent status (running/stopped)
   - Approvals section with list of pending items
   - Start/Stop buttons
```

#### Test 2: Send Lead to Agent (With Approval Flow)
```
1. Go to Leads tab
2. Pick a test lead (or create new one)
3. Click "Send to Agent" button (row-level or bulk)
4. Expected: Success toast, lead queued
5. Go to Agent Hub → Approvals section
6. You should see the lead in pending approvals
7. Click "✓ Approve"
8. Lead should send via Brevo email immediately
9. Check your inbox within 30 seconds
```

#### Test 3: Approve/Reject Flow
```
1. In Agent Hub approvals list
2. Click ✓ Approve on an item → Should show success toast
3. Return to send lead again and approve another → Should email
4. Click ✗ Reject on an item → Should be removed from list
5. Verify no email is sent for rejected items
```

#### Test 4: Agent Start/Stop
```
1. Click "Stop Agent" button in Agent Hub
2. Agent status should change to "stopped"
3. Create a new lead or send existing lead to agent
4. It should still queue in approvals (approvals aren't dependent on agent running)
5. Click "Start Agent"
6. Agent status should return to "running"
```

---

## Rollback Plan (If Something Goes Wrong)

### If Frontend Breaks
```
1. Go to Vercel dashboard
2. Find previous working deployment (before 4ff7f2d)
3. Click "Promote to Production"
4. Frontend immediately reverts to previous version
```

### If Backend Routes Are 404
```
1. Backend deploy didn't pick up new routes
2. Option A: Manual redeploy from Railway dashboard
3. Option B: Push dummy commit to main to trigger redeploy
   git commit --allow-empty -m "trigger deploy"
   git push origin main
```

### If Agent Communication Fails (503 Errors)
```
1. Check MARKETING_AGENT_URL is set correctly in Railway env
2. Verify agent service is actually running at that URL
3. Check Railway backend logs for "unreachable" or "timeout" errors
4. If agent URL is wrong, update it in Railway dashboard and redeploy
```

---

## Troubleshooting

### Problem: Agent Hub page shows 404 (Routes not deployed)
**Solution:** Backend redeploy hasn't completed. Verify:
- [ ] env var MARKETING_AGENT_URL is set in Railway
- [ ] Railway deployment is showing green status
- [ ] (Manual) Trigger redeploy button in Railway Deployments tab

### Problem: Send button disabled / "Agent unreachable" message
**Solution:** Agent communication failing. Check:
- [ ] MARKETING_AGENT_URL is set correctly (typos?)
- [ ] Agent service is actually running at that URL
- [ ] Firewall/network allows Railway → agent URL
- [ ] Agent service is healthy (curl the status endpoint directly)

### Problem: Approvals list is empty but sends are working
**Solution:** Normal during phase-1. Approval mode may be disabled on agent:
- [ ] Check agent service config (data/config.json)
- [ ] Ensure `"approvalMode": true` is set
- [ ] Restart agent service

### Problem: After approve, email never sent
**Solution:** Likely Brevo API issue or IMAP/reply detection. Check:
- [ ] Agent service logs for email send errors
- [ ] Brevo API key is set in agent .env
- [ ] Email isn't in spam folder
- [ ] Check Marketing Agent UI directly for send errors

---

## Post-Deployment Checklist

- [ ] MARKETING_AGENT_URL configured in Railway production backend
- [ ] Backend redeploy completed and showing green status
- [ ] Frontend redeploy completed  
- [ ] Agent Hub page loads at `/agent` route
- [ ] Agent status shows correctly (running/stopped)
- [ ] Can send lead to agent and see it queue in approvals
- [ ] Can approve lead and email sends within 30 seconds
- [ ] Can reject lead and no email is sent
- [ ] Agent start/stop buttons work
- [ ] All tests pass in browser console (no errors)

---

## What's Next After Phase 1?

Once this is deployed and working, you have two options:

### Option A: Keep Current Architecture (External Agent Service)
- ✅ Simple, modular separation of concerns
- ✅ Can deploy/scale agent independently
- ❌ Requires agent service to be always reachable via URL
- ❌ Extra network hop for every agent operation

### Option B: Phase-2 In-Process Integration (Recommended)
- ✅ Single service, simpler deployment
- ✅ Faster performance (no HTTP hop)
- ✅ Easier to scale (horizontal scaling of one service)
- ❌ More code in backend, larger container
- See `FULL_PLAN.md` for phase-2 architecture details

---

## Support & Questions

If deployment gets stuck:
1. Check Railway backend logs for actual errors
2. Verify MARKETING_AGENT_URL is exactly correct (no typos, valid URL)
3. Test connectivity: `curl $MARKETING_AGENT_URL/health` from local machine
4. Review this checklist step-by-step—most issues are env var or networking related
