/**
 * Proxaly Backend — Express server
 * Handles lead scraping, AI enrichment, and campaign management
 */

require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')

const leadsRouter = require('./routes/leads')
const campaignsRouter = require('./routes/campaigns')
const enrichRouter = require('./routes/enrich')
const authRouter = require('./routes/auth')
const automationRouter = require('./routes/automation')
const billingRouter = require('./routes/billing')
const clientsRouter = require('./routes/clients')
const { router: analyticsRouter } = require('./routes/analytics')
const channelsRouter = require('./routes/channels')
const { router: brandingRouter } = require('./routes/branding')
const emailRouter = require('./routes/email')
const { initMonitoring, captureException } = require('./services/monitoring')


const app = express()
const PORT = process.env.PORT || 3001
const isProduction = process.env.NODE_ENV === 'production'
const frontendUrl = String(process.env.FRONTEND_URL || '').trim()

initMonitoring()

// ── Security middleware ─────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }))

const corsOrigins = [
  'https://proxaly.vercel.app',
  /\.vercel\.app$/, // Vercel preview URLs
]

if (frontendUrl) {
  corsOrigins.unshift(frontendUrl)
}

if (!isProduction && process.env.DEV_FRONTEND_URL) {
  corsOrigins.push(String(process.env.DEV_FRONTEND_URL).trim())
}

app.use(cors({
  origin: corsOrigins,
  credentials: true,
}))

// Global rate limit: 200 req/min per IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
}))

// ── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Logging ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'))
}

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Proxaly API',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  })
})

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/leads', leadsRouter)
app.use('/api/campaigns', campaignsRouter)
app.use('/api/enrich', enrichRouter)
app.use('/api/auth', authRouter)
app.use('/api/automation', automationRouter);
app.use('/api/billing', billingRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/branding', brandingRouter);
app.use('/api/email', emailRouter);


// ── 404 handler ──────────────────────────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` })
})

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message)
  console.error(err.stack)
  captureException(err, {
    tags: { scope: 'api' },
    extra: { path: req.originalUrl, method: req.method }
  })
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' })
})

// ── Initialize automation service ────────────────────────────────────────────
const automationService = require('./services/automation')
automationService.init()

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const hostLabel = process.env.PUBLIC_BACKEND_URL || `port:${PORT}`
  console.log(`\n🚀 Proxaly API running on ${hostLabel}`)
  console.log(`📊 Health: ${hostLabel}/health`)
  console.log(`🔑 Groq:   ${process.env.GROQ_API_KEY ? '✓ configured' : '✗ not set'}`)
  console.log(`🗃️  Supabase: ${process.env.SUPABASE_URL ? '✓ configured' : '✗ not set'}`)
  console.log('')
})

module.exports = app
