# Proxaly Documentation (Code-Accurate)

Last updated: 2026-04-11

This document is the single source of truth for the current Proxaly implementation in this repository.

## 1. What Proxaly Is

Proxaly is a full-stack lead generation and outreach platform:

- Frontend: React + Vite
- Backend: Node.js + Express
- Data/Auth: Supabase
- AI enrichment: Groq
- Optional channels: Twilio WhatsApp, Stripe, PayPal, Wise
- Optional external integration: Marketing Agent (local or remote)

Core capabilities implemented in code:

- Lead scraping from multiple sources
- Lead enrichment/scoring with Groq
- Campaign management
- Automation tick runner (scheduled scrape -> enrich -> filter -> dedupe -> persist -> send-to-agent)
- Analytics and report email send
- Client portal tokens and white-label branding
- Multi-channel outreach helpers (WhatsApp/LinkedIn)

## 2. Repository Structure

```text
.
|- backend/
|  |- index.js
|  |- middleware/
|  |  `- auth.js
|  |- routes/
|  |  |- analytics.js
|  |  |- auth.js
|  |  |- automation.js
|  |  |- billing.js
|  |  |- branding.js
|  |  |- campaigns.js
|  |  |- channels.js
|  |  |- clients.js
|  |  |- enrich.js
|  |  `- leads.js
|  |- services/
|  |  |- automation.js
|  |  |- channels.js
|  |  |- emailFinder.js
|  |  |- groq.js
|  |  |- scraper.js
|  |  `- supabase.js
|  |- data/
|  `- logs/
|- frontend/
|  |- src/
|  |  |- App.jsx
|  |  |- components/Layout.jsx
|  |  |- contexts/AuthContext.jsx
|  |  |- lib/
|  |  |  |- api.js
|  |  |  |- automationApi.js
|  |  |  `- supabase.js
|  |  `- pages/
|  |     |- Analytics.jsx
|  |     |- Automation.jsx
|  |     |- Billing.jsx
|  |     |- Branding.jsx
|  |     |- Campaigns.jsx
|  |     |- Channels.jsx
|  |     |- ClientPortal.jsx
|  |     |- Clients.jsx
|  |     |- Dashboard.jsx
|  |     |- Leads.jsx
|  |     |- Login.jsx
|  |     `- Settings.jsx
|- DOCUMENTATION.md
|- PROXALY_MARKETING_AGENT_INTEGRATION.md
|- README.md
|- TESTING_CHECKLIST.md
|- start.ps1
`- supabase_schema.sql
```

## 3. Architecture Overview

```text
Browser (React app)
   |
   | HTTPS/HTTP JSON
   v
Express API (backend/index.js)
   |- /api/leads
   |- /api/campaigns
   |- /api/enrich
   |- /api/auth
   |- /api/automation
   |- /api/billing
   |- /api/clients
   |- /api/analytics
   |- /api/channels
   `- /api/branding
   |
   |- Supabase (data + auth)
   |- Groq (enrichment)
   |- Twilio (optional)
   |- Stripe (optional)
   `- Marketing Agent API (optional, via MARKETING_AGENT_URL)
```

## 4. Runtime and Tooling

Backend:

- Node >= 20 (declared in backend/package.json)
- Express 4
- CommonJS modules

Frontend:

- React 19 + Vite 8
- React Router
- Axios

## 5. Environment Variables

## 5.1 Backend variables

Required for core operation:

- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- PORT (optional; defaults to 3001)
- FRONTEND_URL (recommended for CORS/redirect consistency)

Required for specific features:

- GROQ_API_KEY: AI enrichment (routes/leads and routes/enrich)
- BREVO_API_KEY: analytics report email sending
- BREVO_SENDER_EMAIL: sender identity for report mail
- REPORT_EMAIL: weekly cron report recipient
- STRIPE_SECRET_KEY: Stripe checkout endpoint
- PAYPAL_EMAIL: PayPal link generation endpoint
- WISE_ACCOUNT_NAME, WISE_EMAIL: Wise details endpoint
- TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM: WhatsApp sending
- MARKETING_AGENT_URL: external agent integration (defaults to http://localhost:3000)

## 5.2 Frontend variables

- VITE_API_URL (for example http://localhost:3001/api)
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

## 6. Local Development

## 6.1 Install

```powershell
cd "e:\ai leads\backend"
npm install

cd "e:\ai leads\frontend"
npm install
```

## 6.2 Run manually

```powershell
# Terminal 1
cd "e:\ai leads\backend"
npm run dev

# Terminal 2
cd "e:\ai leads\frontend"
npm run dev
```

## 6.3 Run with helper script

PowerShell script at root:

```powershell
& "e:\ai leads\start.ps1"
```

Note: the script currently uses Start-Sleep and fixed local paths.

## 7. Backend API Reference

Base URL (local): `http://localhost:3001`

Health:

- GET /health

## 7.1 Auth model summary

- Most protected routes use Bearer token auth via middleware/requireAuth.
- Supabase token is validated with supabaseAdmin.auth.getUser(token).
- `req.accessToken` is passed to a user-scoped Supabase client for RLS-aware queries.

Important exception:

- `routes/clients.js` does NOT use requireAuth.
- It expects `x-user-id` header from frontend.

## 7.2 Routes

### /api/auth

- GET /profile (requires Bearer token)

### /api/leads

- GET /
- POST /scrape
- POST /bulk-enrich
- GET /export
- POST /:id/enrich
- POST /:id/find-email
- PATCH /:id
- DELETE /:id
- POST /send-to-agent
- GET /agent/status

Notes:

- /scrape is rate-limited (5 req/min/IP on that route).
- /bulk-enrich max 20 ids/request.
- /send-to-agent max 100 ids/request; skips leads with no email.

### /api/campaigns

- GET /
- POST /
- PATCH /:id
- DELETE /:id
- POST /:id/leads
- DELETE /:id/leads/:leadId

### /api/enrich

- POST /

Notes:

- Rate-limited (30 req/min/IP on that route).

### /api/automation

- GET /status
- GET /logs
- GET /log (alias)
- GET /stream (Server-Sent Events)
- POST /start
- POST /stop
- POST /run-now
- PUT /targets

### /api/billing

- POST /stripe/checkout
- GET /paypal/link/:planId
- GET /wise/details/:planId
- GET /plans

### /api/clients

- GET /
- POST /
- PUT /:id
- DELETE /:id
- POST /:id/regenerate-token
- GET /portal/:token (public)

Auth detail:

- Uses `x-user-id` header (not Bearer middleware in current implementation).

### /api/analytics

- GET /overview
- GET /campaigns
- POST /report/send

### /api/channels

- POST /whatsapp/send
- POST /whatsapp/bulk
- GET /linkedin/message/:leadId
- POST /linkedin/log/:leadId
- GET /stats
- GET /whatsapp/queue
- GET /linkedin/queue

### /api/branding

- GET /
- POST /
- GET /portal/:token (public)

## 8. Frontend Routes

Public:

- /login
- /client/:token

Protected (must have Supabase session user):

- /dashboard
- /leads
- /campaigns
- /clients
- /analytics
- /channels
- /branding
- /billing
- /automation
- /settings

## 9. Automation Engine

Source: `backend/services/automation.js`

Lifecycle:

- Initialized on backend startup (`automationService.init()`).
- Can run scheduled ticks when enabled.
- Tracks state in `backend/data/automation-state.json`.
- Writes logs to `backend/logs/automation.log`.

Main tick pipeline:

1. Scrape all configured targets
2. Enrich batch with Groq
3. Filter by min score
4. Deduplicate against DB
5. Insert new leads
6. Send eligible leads to Marketing Agent

Cron jobs in code:

- Configurable automation schedule: `0 */H * * *` where H = scheduleHours
- Daily reset at midnight: `0 0 * * *`
- Weekly report: Monday 08:00 (`0 8 * * 1`)

## 10. Marketing Agent Integration

There is an integration between Proxaly and an external Marketing Agent service.

Backend lead handoff endpoints:

- POST /api/leads/send-to-agent
- GET /api/leads/agent/status

Expected external agent endpoints:

- POST {MARKETING_AGENT_URL}/api/leads
- POST {MARKETING_AGENT_URL}/api/agent/start
- GET {MARKETING_AGENT_URL}/api/agent/status

Integration doc:

- See `PROXALY_MARKETING_AGENT_INTEGRATION.md`

## 11. Database Notes

The repository contains `supabase_schema.sql` with base tables and RLS policies for core leads/campaigns.

Current code expects additional fields/tables beyond the base schema (for example features under channels/branding/clients/settings and some lead fields). If your DB was created from an older schema revision, you may see missing column errors.

Recommended approach:

1. Apply `supabase_schema.sql`.
2. Ensure tables used by current routes exist:
   - leads
   - campaigns
   - campaign_leads
   - clients
   - agency_branding
   - settings
3. Add columns referenced by backend code if missing.

## 12. Deployment

Frontend:

- Vercel config present in `frontend/vercel.json` (SPA rewrite to index.html).

Backend:

- Deploy `backend/` to Railway, Render, or equivalent Node host.
- Ensure all required environment variables are set.
- Expose port from `PORT` env var.

Root `vercel.json`:

- Contains build routing that points to frontend dist path. Use with care in monorepo hosting setups.

## 13. Security and Limits

Implemented backend protections:

- Helmet enabled
- CORS allowlist with local + Vercel patterns
- Global rate limit: 200 req/min/IP
- Route-level rate limits on scrape/enrich

Authentication details:

- Bearer JWT required on most API routes
- `clients` route family currently relies on `x-user-id` header

## 14. Troubleshooting

## 14.1 Common issues

- 401 Missing or invalid authorization header:
  - Ensure frontend request has Supabase access token attached.
- 503 Marketing Agent unreachable:
  - Check `MARKETING_AGENT_URL` and whether agent is running.
- Groq failures:
  - Verify `GROQ_API_KEY`; check model availability and quota.
- Twilio WhatsApp errors:
  - Verify SID/token/from number and recipient formatting.
- Stripe endpoint returns not configured:
  - Set `STRIPE_SECRET_KEY` in backend environment.

## 14.2 CORS errors

Update backend CORS origin list in `backend/index.js` and set `FRONTEND_URL` correctly.

## 14.3 Supabase schema errors

If endpoints fail with missing table/column errors, align your Supabase schema with the fields used in current backend route code.

## 15. Current Gaps / Known Mismatches

- Some status values are used in both lowercase and title case across different modules.
- Analytics references `score` while enrichment writes `ai_score` in several flows.
- `clients` route auth differs from other routes (x-user-id vs Bearer middleware).
- Weekly report helper imports `node-fetch`, but `node-fetch` is not listed in backend dependencies.

These are implementation-level consistency concerns to address in a hardening pass.

## 16. Useful Files

- Product quick start: `README.md`
- Marketing Agent integration detail: `PROXALY_MARKETING_AGENT_INTEGRATION.md`
- Validation checklist: `TESTING_CHECKLIST.md`
