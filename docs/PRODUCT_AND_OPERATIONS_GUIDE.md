# Proxaly Product and Operations Guide

## 1. What We Use

- Frontend: React, Vite
- Backend: Node.js, Express
- Database/Auth: Supabase
- AI enrichment: Groq
- Hosting: Vercel (frontend), Railway (backend)

## 2. Setup Checklist

1. Configure backend environment variables.
2. Configure frontend environment variables.
3. Apply Supabase schema/migrations.
4. Deploy backend to Railway.
5. Deploy frontend to Vercel.
6. Confirm frontend API URL points to deployed backend /api.

## 3. Daily Usage Flow

1. Open Leads page.
2. Run a search by business type and location.
3. Review contact readiness badges.
4. Use bulk actions:
  - Select All
  - Enrich Selected / Enrich All
  - Export CSV
  - Delete Selected
5. Use Find New Leads to fetch fresh, deduped results.

## 4. Product Behavior (Expected)

- Leads must be contactable by at least one path:
  - email, phone, or website
- Duplicate leads are filtered before display/insert.
- Repeated searches should return fresh/unseen records where possible.

## 5. Admin/Operator Checks

### Health checks

- Backend: GET /health
- Frontend: open production URL and test login + scrape

### Incident checks

- If scraping fails:
  1. Verify backend domain resolves and /health returns OK
  2. Verify frontend VITE_API_URL points to correct backend
  3. Verify CORS origin includes frontend domain

## 6. Release Process

1. Run frontend build locally.
2. Validate backend startup and health endpoint.
3. Push to main.
4. Confirm Vercel and Railway deploy success.
5. Run smoke test in production:
  - scrape
  - find new leads
  - export
  - bulk enrich

## 7. Customer-Facing Positioning

Preferred language:

- Contact-ready prospect system
- Direct contact path coverage
- Fresh, deduped lead discovery

Avoid language:

- Generic lead dumps
- Guaranteed conversion promises
