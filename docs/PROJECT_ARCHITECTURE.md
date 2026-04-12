# Proxaly Project Architecture

## 1. System Overview

Proxaly is a contact-ready prospecting SaaS built as a split frontend-backend system.

- Frontend: React + Vite application (deployed on Vercel)
- Backend: Node.js + Express API (deployed on Railway)
- Database/Auth: Supabase (PostgreSQL + JWT-based auth)
- AI: Groq for enrichment and outreach generation
- Channels: Email and messaging workflows via backend integrations

## 2. High-Level Architecture

1. User signs in via Supabase auth in the frontend.
2. Frontend sends authenticated API calls to backend with bearer token.
3. Backend verifies token and executes lead scraping, enrichment, automation, and analytics logic.
4. Backend persists and reads data from Supabase.
5. Automation services run scheduled tasks (queue retries, follow-ups, reporting).

## 3. Core Components

### Frontend

- Stack: React, Vite, Axios, React Router
- Core modules:
  - Page-level workflows for leads, clients, campaigns, channels, automation, and analytics
  - API clients in src/lib for backend communication
  - Auth context and protected page routing

### Backend

- Stack: Node.js, Express, Axios, Puppeteer/Cheerio, cron
- Core modules:
  - Route handlers in backend/routes
  - Service layer in backend/services for scraping, enrichment, queueing, email, and automation
  - Middleware for auth and request security
  - Migrations in backend/migrations

### Data Layer

- Supabase PostgreSQL tables for leads, campaigns, clients, automation state, and email logs/sequences
- RLS-backed access model with per-user scoping for protected resources

## 4. Security and Reliability Controls

- Bearer auth enforced on protected endpoints
- Rate limiting on high-risk endpoints (scrape/email)
- Input validation and payload limits
- Sanitized API error responses
- Durable retry queue for outbound operations
- Monitoring hooks for exception capture

## 5. Lead Pipeline (Runtime Flow)

1. Search request comes in with business type and city.
2. Scraper gathers candidates from source engines.
3. Contact enrichment pipeline runs:
  - Domain extraction
  - Email guessing
  - Website deep scrape
  - Phone/email extraction
4. Contactability rule applied (email or phone or website required).
5. Dedupe applied (domain/name based markers).
6. Fresh-only leads returned and optionally stored.
7. Frontend displays readiness state, contact options, and bulk actions.

## 6. Deployment Topology

- Frontend production URL: https://proxaly.vercel.app
- Backend production URL: https://proxaly-production.up.railway.app
- Frontend API env should point to: https://proxaly-production.up.railway.app/api

## 7. Operational Notes

- Keep backend and frontend environment variables aligned per environment.
- Run migrations before enabling new backend features in production.
- Validate CORS origins whenever deployment domains change.
