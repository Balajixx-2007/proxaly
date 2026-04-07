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

const app = express()
const PORT = process.env.PORT || 3001

// ── Security middleware ─────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }))

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:3000',
    'https://proxaly.vercel.app',
    /\.vercel\.app$/,  // Vercel preview URLs
  ],
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
app.use(express.json({ limit: '10mb' }))
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

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` })
})

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message)
  console.error(err.stack)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
})

// ── Initialize automation service ────────────────────────────────────────────
const automationService = require('./services/automation')
automationService.init()

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Proxaly API running on http://localhost:${PORT}`)
  console.log(`📊 Health: http://localhost:${PORT}/health`)
  console.log(`🔑 Groq:   ${process.env.GROQ_API_KEY ? '✓ configured' : '✗ not set'}`)
  console.log(`🗃️  Supabase: ${process.env.SUPABASE_URL ? '✓ configured' : '✗ not set'}\n`)
})

module.exports = app
