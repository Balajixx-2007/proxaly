# ⚡ Proxaly — Full Platform Documentation

> **Autonomous AI Marketing Agency Platform**  
> React (Vercel) · Node.js (Railway) · Supabase · Groq AI · Twilio · Stripe / PayPal / Wise

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Feature Map (All 10)](#feature-map-all-10)
5. [Environment Variables](#environment-variables)
6. [Supabase Database Setup](#supabase-database-setup)
7. [API Reference](#api-reference)
8. [Frontend Pages](#frontend-pages)
9. [Deployment Guide](#deployment-guide)
10. [File Structure](#file-structure)
11. [Cron Jobs](#cron-schedule)
12. [Billing Plans](#billing-plans)
13. [Troubleshooting](#troubleshooting)

---

## Overview

Proxaly is a **fully autonomous AI-powered marketing agency platform**. It:

- **Scrapes** leads from Justdial, Yellow Pages, Google Maps
- **Enriches** leads with Groq AI (Llama 3) — scores, personalizes, researches websites
- **Sends** personalized cold emails automatically
- **Follows up** on Days 2, 4, 7 — no human input needed
- **Books meetings** by detecting interest → auto-sends Calendly links
- **Escalates** to WhatsApp and LinkedIn if email gets no reply
- **Shows clients** their own white-labeled private portal (no login needed)
- **Reports** weekly stats every Monday morning by email
- **Charges clients** via Stripe, PayPal, or Wise bank transfer

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                  FRONTEND (Vercel)                    │
│  React + Vite  ·  proxaly.vercel.app                 │
│                                                      │
│  Protected Pages (require login):                    │
│  Dashboard · Leads · Campaigns · Clients             │
│  Channels · Analytics · Branding · Billing           │
│  Automation · Settings                               │
│                                                      │
│  Public Page:  /client/:token  (Client Portal)       │
└─────────────────────┬────────────────────────────────┘
                      │ HTTPS REST API calls
┌─────────────────────▼────────────────────────────────┐
│                  BACKEND (Railway)                    │
│  Node.js · Express · Port 3001                       │
│                                                      │
│  Routes: /api/leads · /api/campaigns · /api/auth     │
│          /api/analytics · /api/billing               │
│          /api/clients  · /api/channels               │
│          /api/branding · /api/automation             │
└──────────┬───────────────┬──────────────┬────────────┘
           │               │              │
    ┌──────▼──────┐ ┌──────▼─────┐ ┌────▼────────┐
    │  Supabase   │ │  Groq API  │ │  3rd Party  │
    │  Postgres   │ │  Llama 3   │ │  Twilio WA  │
    │  Auth + DB  │ │  (Free)    │ │  Brevo SMTP │
    └─────────────┘ └────────────┘ │  Stripe     │
                                   └─────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React + Vite | UI |
| Styling | Vanilla CSS (inline + global) | Design system |
| Routing | React Router v6 | Navigation |
| Backend | Node.js + Express | REST API |
| Database | Supabase (PostgreSQL) | Data + Auth |
| AI | Groq (Llama 3 8B) | Scoring, replies, personalization |
| Email | Brevo (Sendinblue) | Outreach + weekly reports |
| WhatsApp | Twilio API | Multi-channel outreach |
| Payments | Stripe · PayPal · Wise | Subscriptions |
| Hosting | Vercel (frontend) · Railway (backend) | Deployment |
| Scraping | Puppeteer / Cheerio | Lead discovery |

---

## Feature Map (All 10)

### ✅ Feature 1 — Email Sending
- Cold emails via Brevo SMTP
- HTML-formatted, AI-personalized per lead
- Tracked in Supabase (`status = 'Contacted'`)
- **Requires:** `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`

### ✅ Feature 2 — Auto Follow-ups
- 3-stage drip: **Day 2 · Day 4 · Day 7**
- Runs via `node-cron` in automation service
- Skips leads that replied or booked meetings
- **File:** `backend/services/automation.js`

### ✅ Feature 3 — Groq AI Brain
- Real LLM (Llama 3) reads inbound replies
- Classifies intent: `interested` · `not_interested` · `needs_info` · `reschedule`
- Generates contextual reply for each intent
- **Requires:** `GROQ_API_KEY` (free at console.groq.com)
- **File:** `backend/services/groq.js`

### ✅ Feature 4 — AI Meeting Booking
- Detects `interested` intent automatically
- Extracts proposed meeting time from reply text
- Auto-sends Calendly link + WhatsApp notification to you
- **Requires:** `CALENDLY_LINK`, `CALLMEBOT_PHONE`, `CALLMEBOT_API_KEY`
- **File:** `backend/src/meetingBooker.js`

### ✅ Feature 5 — Lead Deep Research
- Scrapes each lead's website before sending email
- AI identifies specific problems (e.g., "no online booking form")
- Uses findings as personalized email hook
- **Endpoint:** `POST /api/leads/research-all`
- **File:** `backend/src/leadResearcher.js`

### ✅ Feature 6 — Billing (Stripe + PayPal + Wise)
- **Stripe** — Checkout session → hosted payment page
- **PayPal** — Direct link to your PayPal
- **Wise** — Shows bank details inline with copy buttons
- No GST currently; architecture ready for tax lines later
- **Requires:** `STRIPE_SECRET_KEY`, `PAYPAL_EMAIL`, `WISE_EMAIL`, `WISE_ACCOUNT_NAME`
- **File:** `backend/routes/billing.js`

### ✅ Feature 7 — Multi-Tenant Client Dashboard
- Add clients (name, email, business, plan, notes)
- Each client gets a unique portal URL: `/client/:token`
- Portal shows: leads found, emails sent, replies, meetings
- **No login required** for clients (token-based access)
- Regen token anytime to revoke access
- **Files:** `backend/routes/clients.js` · `frontend/src/pages/Clients.jsx` · `frontend/src/pages/ClientPortal.jsx`

### ✅ Feature 8 — Analytics & Weekly Reports
- Real stats: total leads, contacted, replied, meetings, clients
- 14-day daily volume bar chart (pure CSS)
- Conversion funnel with animated progress bars
- Top niches breakdown · Lead sources · Score distribution
- **Weekly email** every Monday 8:00am UTC (via Brevo)
- Manual "Send Now" button on Analytics page
- **Requires:** `BREVO_API_KEY`, `REPORT_EMAIL`
- **Files:** `backend/routes/analytics.js` · `frontend/src/pages/Analytics.jsx`

### ✅ Feature 9 — Multi-Channel Outreach
- **WhatsApp (Twilio):** Single or bulk send to leads with phone numbers
- **Cadence:** Email Day 1 → Follow-up Day 4 → WhatsApp Day 7
- **LinkedIn:** Groq AI generates personalized DM → copy + open in one click
- Tracks `whatsapp_sent` and `linkedin_messaged` per lead
- **Requires:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`
- **Files:** `backend/routes/channels.js` · `backend/services/channels.js` · `frontend/src/pages/Channels.jsx`

### ✅ Feature 10 — White-Label Branding
- Agency name, tagline, logo URL, custom colors per account
- 6 preset color palettes + custom hex color picker
- **Live preview** of client portal as you type
- Toggle to hide "Proxaly" branding entirely
- Custom email signature appended to all outreach
- Portal footer with agency website link
- **Files:** `backend/routes/branding.js` · `frontend/src/pages/Branding.jsx`

---

## Environment Variables

### 🚂 Railway (Backend)

#### Required

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `SUPABASE_URL` | Project URL | Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | Anonymous key | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key | Supabase → Settings → API |
| `JWT_SECRET` | Token signing secret | Any random 32+ char string |
| `PORT` | Server port | `3001` |

#### Optional (per feature)

| Variable | Feature | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | AI Brain | console.groq.com — free |
| `BREVO_API_KEY` | Email + Reports | app.brevo.com |
| `BREVO_SENDER_EMAIL` | Email | Your verified Brevo sender |
| `REPORT_EMAIL` | Weekly Reports | Where Monday reports go |
| `STRIPE_SECRET_KEY` | Billing | stripe.com dashboard |
| `PAYPAL_EMAIL` | Billing | Your PayPal email |
| `WISE_EMAIL` | Billing | Your Wise email |
| `WISE_ACCOUNT_NAME` | Billing | Your name on Wise |
| `TWILIO_ACCOUNT_SID` | WhatsApp | twilio.com console |
| `TWILIO_AUTH_TOKEN` | WhatsApp | twilio.com console |
| `TWILIO_WHATSAPP_FROM` | WhatsApp | `whatsapp:+14155238886` |
| `CALENDLY_LINK` | Meeting Booking | Your Calendly URL |
| `CALLMEBOT_PHONE` | WA Alerts | Your WhatsApp number |
| `CALLMEBOT_API_KEY` | WA Alerts | callmebot.com |
| `FRONTEND_URL` | Portal Links | `https://proxaly.vercel.app` |

### ▲ Vercel (Frontend)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | e.g. `https://proxaly-backend.railway.app/api` |
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | Same as `SUPABASE_ANON_KEY` |

---

## Supabase Database Setup

Run all SQL below in **Supabase → SQL Editor → New Query**

```sql
-- 1. Leads
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  name TEXT, email TEXT, phone TEXT,
  company TEXT, website TEXT, niche TEXT, source TEXT,
  status TEXT DEFAULT 'New',
  score INTEGER DEFAULT 0,
  enriched BOOLEAN DEFAULT false,
  observation TEXT, ai_observation TEXT, linkedin_url TEXT,
  whatsapp_sent BOOLEAN DEFAULT false,
  whatsapp_sent_at TIMESTAMPTZ, whatsapp_status TEXT,
  linkedin_messaged BOOLEAN DEFAULT false,
  linkedin_messaged_at TIMESTAMPTZ,
  channels_used TEXT[] DEFAULT '{}',
  contacted_at TIMESTAMPTZ,
  follow_up_1_sent BOOLEAN DEFAULT false,
  follow_up_2_sent BOOLEAN DEFAULT false,
  follow_up_3_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  leads_count INTEGER DEFAULT 0,
  niche TEXT, location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Clients
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL, email TEXT NOT NULL,
  business_name TEXT DEFAULT '', niche TEXT DEFAULT '',
  plan TEXT DEFAULT 'starter', notes TEXT DEFAULT '',
  portal_token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active',
  leads_sent INTEGER DEFAULT 0, meetings_booked INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON clients USING (true) WITH CHECK (true);

-- 4. Agency Branding
CREATE TABLE IF NOT EXISTS agency_branding (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL,
  agency_name TEXT DEFAULT 'My Agency',
  agency_tagline TEXT DEFAULT '',
  logo_url TEXT DEFAULT '', favicon_url TEXT DEFAULT '',
  primary_color TEXT DEFAULT '#7c3aed',
  accent_color TEXT DEFAULT '#22d3ee',
  email_signature TEXT DEFAULT '',
  support_email TEXT DEFAULT '',
  website_url TEXT DEFAULT '', footer_text TEXT DEFAULT '',
  hide_proxaly_branding BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE agency_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON agency_branding USING (true) WITH CHECK (true);

-- 5. Settings
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE,
  config JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Reference

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/signup` | — | Create account |
| POST | `/api/auth/login` | — | Sign in |
| POST | `/api/auth/logout` | ✅ | Sign out |

### Leads
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leads` | List (paginated, filterable) |
| POST | `/api/leads/scrape` | Scrape new leads |
| PUT | `/api/leads/:id` | Update lead |
| DELETE | `/api/leads/:id` | Delete lead |
| POST | `/api/leads/:id/send-email` | Send email to lead |
| POST | `/api/leads/research-all` | AI bulk website research |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/overview?days=30` | Stats + funnel + trends |
| GET | `/api/analytics/campaigns` | Campaign performance |
| POST | `/api/analytics/report/send` | Email report now |

### Billing
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/billing/stripe/checkout` | Create Stripe session |
| GET | `/api/billing/paypal/link/:planId` | PayPal URL |
| GET | `/api/billing/wise/details/:planId` | Wise bank details |

### Clients
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/clients` | ✅ | List clients |
| POST | `/api/clients` | ✅ | Create + generate token |
| PUT | `/api/clients/:id` | ✅ | Update |
| DELETE | `/api/clients/:id` | ✅ | Delete |
| POST | `/api/clients/:id/regenerate-token` | ✅ | New portal token |
| GET | `/api/clients/portal/:token` | 🌐 Public | Client portal data |

### Channels
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/channels/whatsapp/send` | Send WhatsApp to lead |
| POST | `/api/channels/whatsapp/bulk` | Bulk WhatsApp queue |
| GET | `/api/channels/whatsapp/queue` | Eligible leads |
| GET | `/api/channels/linkedin/message/:id` | Generate DM |
| POST | `/api/channels/linkedin/log/:id` | Log attempt |
| GET | `/api/channels/linkedin/queue` | LinkedIn queue |
| GET | `/api/channels/stats` | Channel stats |

### Branding
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/branding` | ✅ | Get branding |
| POST | `/api/branding` | ✅ | Save branding |
| GET | `/api/branding/portal/:token` | 🌐 Public | Branding by token |

### Automation
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/automation/status` | Current state |
| POST | `/api/automation/start` | Enable auto-run |
| POST | `/api/automation/stop` | Disable |
| GET | `/api/automation/logs` | SSE real-time logs |

---

## Frontend Pages

| Route | Page | Auth | Description |
|-------|------|------|-------------|
| `/login` | Login.jsx | Public | Sign in / Sign up |
| `/dashboard` | Dashboard.jsx | ✅ | Stats overview |
| `/leads` | Leads.jsx | ✅ | Manage + scrape leads |
| `/campaigns` | Campaigns.jsx | ✅ | Campaign management |
| `/clients` | Clients.jsx | ✅ | Clients + portal links |
| `/channels` | Channels.jsx | ✅ | WhatsApp + LinkedIn hub |
| `/analytics` | Analytics.jsx | ✅ | Funnel + trends + reports |
| `/branding` | Branding.jsx | ✅ | White-label settings |
| `/billing` | Billing.jsx | ✅ | Plans + 3 payment methods |
| `/automation` | Automation.jsx | ✅ | Start/stop + real-time logs |
| `/settings` | Settings.jsx | ✅ | Config, API keys, email |
| `/client/:token` | ClientPortal.jsx | 🌐 Public | Client's private dashboard |

---

## Deployment Guide

### 1. Supabase
1. [supabase.com](https://supabase.com) → New Project
2. SQL Editor → run all SQL from the Database Setup section
3. Authentication → Settings:
   - Disable "Confirm email"
   - Set Site URL → your Vercel URL
   - Add Vercel URL to Redirect URLs

### 2. Railway (Backend)
1. [railway.app](https://railway.app) → New Project → GitHub
2. Select `proxaly` repo → Root Directory: `backend`
3. Variables tab → add all required env vars
4. Settings → Networking → Generate public domain

### 3. Vercel (Frontend)
1. [vercel.com](https://vercel.com) → New Project → GitHub → `proxaly`
2. Root Directory: `frontend` · Framework: **Vite**
3. Add env vars: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
4. Deploy

---

## File Structure

```
proxaly/
├── backend/
│   ├── index.js                    # Express entry point
│   ├── middleware/auth.js           # JWT auth guard
│   ├── routes/
│   │   ├── auth.js
│   │   ├── leads.js
│   │   ├── campaigns.js
│   │   ├── enrich.js
│   │   ├── automation.js
│   │   ├── billing.js              # Stripe · PayPal · Wise
│   │   ├── clients.js              # Client portal
│   │   ├── analytics.js            # Stats + weekly reports
│   │   ├── channels.js             # WhatsApp · LinkedIn
│   │   └── branding.js             # White-label config
│   └── services/
│       ├── supabase.js
│       ├── groq.js                 # AI enrichment + replies
│       ├── scraper.js
│       ├── emailFinder.js
│       ├── automation.js           # Cron engine
│       └── channels.js             # Twilio · LinkedIn service
│
└── frontend/src/
    ├── App.jsx                     # Router + auth guard
    ├── lib/api.js                  # Axios instance
    ├── contexts/AuthContext.jsx
    ├── components/Layout.jsx       # Sidebar navigation
    └── pages/
        ├── Dashboard.jsx
        ├── Leads.jsx
        ├── Campaigns.jsx
        ├── Clients.jsx
        ├── ClientPortal.jsx        # /client/:token (public)
        ├── Channels.jsx
        ├── Analytics.jsx
        ├── Branding.jsx
        ├── Billing.jsx
        ├── Automation.jsx
        ├── Settings.jsx
        └── Login.jsx
```

---

## Cron Schedule

| Cron | Schedule | Job |
|------|----------|-----|
| Auto-run | Configurable (2h default) | Scrape → Enrich → Send emails |
| Daily reset | `0 0 * * *` (midnight UTC) | Reset `totalLeadsToday` counter |
| Weekly report | `0 8 * * 1` (Monday 8am UTC) | Email report to `REPORT_EMAIL` |

> **Note:** Monday 8am UTC = Monday 1:30pm IST

---

## Billing Plans

| Plan | Monthly | Annual | Leads/mo | Key Features |
|------|---------|--------|----------|--------------|
| **Free** | $0 | $0 | 50 | Basic AI, CSV, 3 campaigns |
| **Pro** | $29 | $279 | 500 | Full AI, bulk enrich, LinkedIn |
| **Agency** | $79 | $759 | Unlimited | All Pro + 5 seats, white-label, API |

> Annual = 20% discount · No GST currently · All prices in USD

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| CORS error in browser | Add frontend URL to CORS whitelist in `backend/index.js`. Set `FRONTEND_URL` in Railway. |
| Supabase JWT invalid | Check `SUPABASE_URL` and `SUPABASE_ANON_KEY` match your project exactly. |
| Groq API not working | Add `GROQ_API_KEY` to Railway. Get free key at console.groq.com |
| Email not sending | Verify `BREVO_API_KEY` and ensure sender email is verified in Brevo account. |
| WhatsApp sandbox fails | Recipient must first text `join <word>` to Twilio sandbox number. |
| Stripe checkout not working | Check `STRIPE_SECRET_KEY` format (`sk_test_` or `sk_live_`). Add Vercel URL to Stripe redirect URLs. |
| Weekly report not arriving | Check `REPORT_EMAIL` + `BREVO_API_KEY` in Railway. Test via Analytics → Send Now. |
| Client portal shows Proxaly branding | Go to Branding page → fill agency details → toggle "Hide Proxaly" → Save. |
| Automation not scraping | Check Railway logs. Ensure automation is enabled in Automation page. Check `GROQ_API_KEY`. |

---

*Built by Proxaly · Powered by Groq AI · April 2026*
