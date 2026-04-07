# Proxaly + Marketing Agent — Complete Integration Guide

## ✅ Integration Complete!

This document outlines the complete integration between **Proxaly** (AI Lead Generation) and **Marketing Agent** (AI Email Outreach Automation).

---

## 🎯 What Was Integrated

### 1. **Backend Integration (Proxaly)**

#### New Endpoints Added to `backend/routes/leads.js`:

**POST /api/leads/send-to-agent**
- Accepts: `{ leadIds: [...] }`
- Fetches leads from Supabase by ID
- Formats leads for Marketing Agent:
  ```javascript
  {
    name: lead.name,
    email: lead.email,
    company: lead.city || lead.address,
    phone: lead.phone,
    website: lead.website,
    observation: lead.ai_summary || lead.outreach_message || lead.notes
  }
  ```
- Sends each lead to `POST http://localhost:3000/api/leads`
- Automatically starts Marketing Agent via `POST http://localhost:3000/api/agent/start`
- Returns: `{ success, sent, failed, total, message }`
- Gracefully handles failures (continues with remaining leads if one fails)

**GET /api/agent/status**
- Proxies Marketing Agent status from `http://localhost:3000/api/agent/status`
- Returns: Agent running status, tick count, last run time, emails sent today
- Returns 503 if Marketing Agent is unreachable

#### Environment Variables Added:
- `MARKETING_AGENT_URL=http://localhost:3000` (added to `.env` and `.env.example`)
- Use for easy deployment config changes

### 2. **Frontend Integration (Proxaly)**

#### New API Methods (`frontend/src/lib/api.js`):
- `leadsApi.sendToAgent(leadIds)` — Send selected leads to Marketing Agent
- `leadsApi.getAgentStatus()` — Fetch Marketing Agent status

#### Updated **Leads Page** (`frontend/src/pages/Leads.jsx`):

**Send to Agent Button**
- Appears when leads are selected (purple/violet gradient)
- Shows: "Send 5 to Agent" (dynamic count)
- On click:
  - Shows loading spinner
  - Sends selected leads via API
  - Displays success toast: "✅ 5 leads sent to Marketing Agent!"
  - Auto-clears selection after success
  - Polls agent status to confirm execution

**Agent Status Indicator**
- Top-right of toolbar (green/red dot)
- Shows: "Agent Running (N ticks)" or "Agent Offline"
- Fetches status every 30 seconds
- Real-time visibility into agent state

**Quick Actions Dropdown** (per lead row)
- Click "⋮" menu on any lead
- Options:
  - "Send to Agent" — Send single lead
  - "Delete" — Remove lead
- Dropdown positioned above toolbar

#### Updated **Dashboard** (`frontend/src/pages/Dashboard.jsx`):

**New Marketing Agent Card**
- Location: Right sidebar (above Plan badge)
- Shows:
  - 🤖 Agent status (green/red indicator)
  - Current status text
  - 📧 Emails sent today
  - Last run time
  - "Open Dashboard" button → `http://localhost:3000`
- Polling: Updates agent status every 30 seconds
- Card styling: Gradient background matching Proxaly theme

### 3. **Marketing Agent Updates**

#### CORS Configuration (`server.js`):
```javascript
const cors = require('cors');

app.use(cors({
  origin: [
    'http://localhost:5173',  // Proxaly frontend
    'http://localhost:3001',  // Proxaly backend
    'http://localhost:3000',  // Marketing Agent itself
    'https://proxaly.app',    // Production domain
    /\.proxaly\.app$/,        // Subdomains
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
```

#### Package.json:
- Added: `cors: ^2.8.5`
- Run `npm install` to activate

---

## 🚀 Complete Workflow

### Step 1: Search Leads in Proxaly
```
1. Open Proxaly at http://localhost:5173
2. Click "Lead Finder"
3. Enter business type: "dental clinics"
4. Enter city: "New York"
5. Select source (Google Maps, Justdial, etc.)
6. Click "Find Leads"
7. Wait for results
```

### Step 2: Select and Enrich Leads
```
1. Results appear in table
2. Check boxes to select leads
3. (Optional) Filter by score 7+ using AI enrichment
4. Select all high-quality leads
```

### Step 3: Send to Marketing Agent
```
1. With leads selected, purple "Send 5 to Agent" button appears
2. Click the button
3. See loading spinner
4. Toast notification: "✅ 5 leads sent to Marketing Agent!"
5. Selection auto-cleared
6. Notice agent status changes to "Agent Running" 🟢
```

### Step 4: Monitor Agent
```
1. Agent status indicator in Leads page toolbar updates
2. Marketing Agent card on Dashboard shows real-time metrics
3. Check Marketing Agent dashboard at http://localhost:3000 for detailed logs
4. Monitor email sending in agent logs
```

### Step 5: Verify in Marketing Agent
```
1. Open http://localhost:3000
2. Go to Leads page
3. See 5 new leads with following data:
   - Name: ✅
   - Email: ✅
   - Company: ✅
   - Phone: ✅
   - Website: ✅
   - Observation: ✅ (from ai_summary or outreach_message)
4. Agent automatically started
5. Check Logs for "outreach_sent" entries
```

---

## 📊 Data Flow Diagram

```
┌─────────────┐
│   Proxaly   │
│  Frontend   │
│ (Leads.jsx) │
└──────┬──────┘
       │ (Select leads + Click "Send to Agent")
       │
       ▼
┌──────────────────────────────┐
│ leadsApi.sendToAgent()        │
│ (POST /api/leads/send-to-agent)
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  Proxaly Backend (/backend/routes/leads.js)
│  send-to-agent endpoint                  │
│ ────────────────────────────────────────│
│ 1. Get leads from Supabase              │
│ 2. Format for Marketing Agent           │
│ 3. Send to POST /api/leads (x5)         │
│ 4. Call POST /api/agent/start           │
│ 5. Return { sent: 5, failed: 0 }        │
└──────┬───────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│   Marketing Agent (:3000)                │
│  CORS Enabled ✅                         │
│  ────────────────────────────────────────│
│  POST /api/leads (receive 5 leads)      │
│  POST /api/agent/start (start agent)    │
└──────┬────────────────────────────────────┘
       │ (Every 3 minutes)
       │ Agent Loop:
       │ 1. Check IMAP inbox
       │ 2. Process replies
       │ 3. Generate responses
       │ 4. Send emails
       ▼
   📧 Leads receive emails!
```

---

## 🔌 API Reference

### Proxaly Backend

#### Send Leads to Marketing Agent
```http
POST /api/leads/send-to-agent
Content-Type: application/json

{
  "leadIds": ["uuid-1", "uuid-2", "uuid-3"]
}

Response:
{
  "success": true,
  "sent": 3,
  "failed": 0,
  "total": 3,
  "message": "Sent 3/3 leads to Marketing Agent"
}
```

#### Get Agent Status
```http
GET /api/leads/agent/status
Authorization: Bearer [jwt-token]

Response:
{
  "status": "online",
  "running": true,
  "tickCount": 42,
  "lastRunTime": "2026-04-06T14:30:00Z",
  "emailsSentToday": 12
}

// If offline:
{
  "error": "Marketing Agent unreachable",
  "status": "offline"
}
```

### Marketing Agent

#### Add Lead
```http
POST /api/leads
Content-Type: application/json

{
  "name": "John's Dental Clinic",
  "email": "contact@clinic.com",
  "company": "New York",
  "phone": "+1-555-1234",
  "website": "clinic.com",
  "observation": "Uses GMB, 4.8 stars"
}
```

#### Start Agent
```http
POST /api/agent/start
Content-Type: application/json

Response:
{
  "success": true,
  "status": "started"
}
```

#### Get Agent Status
```http
GET /api/agent/status

Response:
{
  "running": true,
  "tickCount": 42,
  "lastRunTime": "2026-04-06T14:30:00Z"
}
```

---

## 🔧 Configuration

### Proxaly Backend (.env)
```
MARKETING_AGENT_URL=http://localhost:3000
# For production:
# MARKETING_AGENT_URL=https://agent.yourdomain.com
```

### Marketing Agent (server.js)
CORS origins can be modified to allow additional domains:
```javascript
origin: [
  'http://localhost:5173',
  'http://localhost:3001',
  'https://yourdomain.com',
  // Add more as needed
]
```

---

## ✅ Verification Checklist

Setup is complete when all pass:

- [ ] Proxaly backend has `.env` with `MARKETING_AGENT_URL=http://localhost:3000`
- [ ] Proxaly backend `/api/leads/send-to-agent` endpoint returns 200
- [ ] Proxaly backend `/api/leads/agent/status` endpoint returns 200
- [ ] Proxaly frontend loads Leads page without errors
- [ ] "Send to Agent" button appears when leads are selected
- [ ] Agent status indicator shows in toolbar
- [ ] Marketing Agent dashboard widget shows on Dashboard
- [ ] Marketing Agent has cors package installed (`npm install`)
- [ ] Marketing Agent server starts without CORS errors
- [ ] Can send leads from Proxaly to Marketing Agent
- [ ] Toast notifications appear on success/error
- [ ] Leads appear in Marketing Agent dashboard
- [ ] Agent starts automatically after sending leads
- [ ] Agent status updates in real-time

---

## 🐛 Troubleshooting

### Issue: "Failed to send leads. Is Marketing Agent running?"

**Solution:**
1. Start Marketing Agent: `cd "e:\ai marketing agent" && npm start`
2. Verify port 3000 is accessible
3. Check firewall isn't blocking port 3000
4. Verify CORS is enabled in Marketing Agent (`npm install cors` if needed)

### Issue: Agent status shows "Offline"

**Solution:**
1. Make sure Marketing Agent is running
2. Check that CORS origins include Proxaly URLs
3. Verify proxy endpoint in Proxaly backend is working
4. Check browser console for CORS errors

### Issue: Leads not appearing in Marketing Agent

**Solution:**
1. Check that leads have email addresses (required field)
2. View Proxaly backend logs for send-to-agent endpoint
3. Check Marketing Agent logs for incoming leads
4. Verify data is being persisted to leads.json in Marketing Agent

### Issue: Agent not starting after sending leads

**Solution:**
1. Marketing Agent might be starting silently (check logs)
2. Verify agent interval is configured (default 3 minutes)
3. Try manually starting agent from Marketing Agent dashboard
4. Check for errors in Marketing Agent console

### Issue: CORS error in browser console

**Solution:**
1. Verify `cors` package is installed: `npm install cors`
2. Verify cors configuration in `server.js` includes Proxaly URLs
3. Restart Marketing Agent after changes
4. Clear browser cache and reload

---

## 📈 Performance Tips

1. **Batch sending**: Send leads in batches of 20-50 for optimal performance
2. **Monitor agent status**: Check agent status before bulk operations
3. **Email validation**: Proxaly enriches emails, ensuring valid addresses reach agent
4. **Rate limiting**: Proxaly backend has 200 req/min limit per IP
5. **Agent interval**: Set to 3-5 minutes for most use cases

---

## 🚀 Future Enhancements

Potential additions to this integration:

1. **Real-time WebSocket updates** for agent status
2. **Campaign templates** from Proxaly to Marketing Agent
3. **Lead scoring integration** to auto-qualify hot leads
4. **Reply sync** — Pull Marketing Agent replies back to Proxaly
5. **Multi-user dashboard** showing team's agent metrics
6. **Webhooks** for third-party CRM integrations
7. **Email template builder** in Proxaly dashboard
8. **A/B testing reports** synced to Proxaly

---

## 📝 Technical Stack

| Component | Technology |
|-----------|-----------|
| Proxaly Frontend | React 19 + Vite + Tailwind CSS |
| Proxaly Backend | Node.js + Express + Supabase |
| Marketing Agent | Node.js + Express + JSON storage |
| Database | Supabase (Proxaly), JSON files (Marketing Agent) |
| API Communication | REST + CORS + Fetch API |
| Email | IMAP + SMTP + Brevo API |
| Hosting | Local (dev), Vercel/Railway (prod) |

---

## 📞 Support

**Questions or issues?**
1. Check troubleshooting section above
2. Review console logs in both applications
3. Verify all dependencies are installed (`npm install`)
4. Ensure environment variables are set correctly
5. Restart both applications

**Integration created:** April 6, 2026
**Last updated:** April 6, 2026

---

## 🎉 Success!

Your Proxaly + Marketing Agent integration is now complete! 

Start by:
1. Opening Proxaly at http://localhost:5173
2. Searching for leads
3. Selecting leads with high scores
4. Clicking the purple "Send to Agent" button
5. Watching the magic happen! ✨

Happy outreach! 🚀
