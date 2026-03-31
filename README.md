# Proxaly — AI Lead Generation SaaS

> Find, enrich, and convert leads 10x faster with AI-powered scraping and Groq AI enrichment. 100% free tools, zero paid APIs.

---

## 🚀 Quick Start

### 1. Get your free API keys (5 minutes)

| Service | URL | What for |
|---------|-----|----------|
| Supabase | [supabase.com](https://supabase.com) | Database + Auth |
| Groq | [console.groq.com](https://console.groq.com) | AI enrichment |

### 2. Set up environment variables

**Backend** — copy `backend/.env.example` to `backend/.env`:
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GROQ_API_KEY=gsk_...
PORT=3001
FRONTEND_URL=http://localhost:5173
```

**Frontend** — copy `frontend/.env.example` to `frontend/.env`:
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=http://localhost:3001/api
```

### 3. Set up Supabase database

1. Go to [app.supabase.com](https://app.supabase.com)
2. Create a new project
3. Go to **SQL Editor** → **New Query**
4. Paste the contents of `supabase_schema.sql`
5. Click **Run**

### 4. Install dependencies

```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

### 5. Run the app

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) 🎉

---

## 🏗️ Project Structure

```
Proxaly/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx       # Auth page
│   │   │   ├── Dashboard.jsx   # Overview + stats
│   │   │   ├── Leads.jsx       # Lead table + scraper
│   │   │   ├── Campaigns.jsx   # Campaign management
│   │   │   ├── Billing.jsx     # Pricing tiers
│   │   │   └── Settings.jsx    # API keys + preferences
│   │   ├── components/
│   │   │   └── Layout.jsx      # Sidebar navigation
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx # Supabase auth state
│   │   └── lib/
│   │       ├── supabase.js     # Supabase client
│   │       └── api.js          # Backend API client
│   └── vite.config.js
│
├── backend/
│   ├── routes/
│   │   ├── leads.js       # Lead CRUD + scraping
│   │   ├── campaigns.js   # Campaign management
│   │   ├── enrich.js      # Direct AI enrichment
│   │   └── auth.js        # Auth endpoints
│   ├── services/
│   │   ├── scraper.js     # Puppeteer scrapers
│   │   ├── groq.js        # Groq AI enrichment
│   │   └── supabase.js    # DB client
│   ├── middleware/
│   │   └── auth.js        # JWT verification
│   └── index.js           # Express server
│
└── supabase_schema.sql    # Database setup
```

---

## 🧠 AI Enrichment

Uses **Groq API** with `llama3-8b-8192` (completely free, 14,400 req/day):
- ✅ Business summary
- ✅ Personalized cold outreach message
- ✅ Lead quality score (1–10)
- ✅ Score reasoning

---

## 🔍 Lead Sources

| Source | Best For |
|--------|----------|
| Google Maps | All businesses globally |
| Justdial | Indian businesses |
| Yellow Pages | US businesses |
| Google Search | Any niche |

---

## 📦 Tech Stack

| Layer | Tech | Cost |
|-------|------|------|
| Frontend | React + Vite + Tailwind CSS | Free |
| Backend | Node.js + Express | Free |
| Database | Supabase PostgreSQL | Free (500MB) |
| Auth | Supabase Auth | Free (50k users) |
| AI | Groq llama3-8b-8192 | Free (14,400 req/day) |
| Scraping | Puppeteer + Cheerio | Free |
| Hosting FE | Vercel | Free |
| Hosting BE | Railway | Free tier |

**Total cost: $0** 🎉

---

## 🚢 Deployment

### Frontend → Vercel

```bash
cd frontend
npm run build
# Push to GitHub and connect to Vercel
# Set VITE_ env vars in Vercel dashboard
```

### Backend → Railway

1. Create account at [railway.app](https://railway.app)
2. New project → Deploy from GitHub
3. Point to `/backend` directory
4. Add environment variables
5. Railway auto-deploys on push

---

## 🗺️ Roadmap

- [x] Auth (Supabase)
- [x] Lead scraper (Google Maps, Justdial, Yellow Pages)
- [x] AI enrichment (Groq)
- [x] Lead management dashboard
- [x] Campaign tracker
- [x] CSV export
- [x] Billing UI
- [ ] Stripe payment integration
- [ ] Email finder (Hunter.io free tier)
- [ ] Bull queue for background scraping
- [ ] Webhook integrations
- [ ] Team collaboration

---

## 📄 License

MIT — built with ❤️ using 100% free tools.
