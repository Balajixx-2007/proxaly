const express = require('express')
const router = express.Router()
const automation = require('../services/automation')
const { requireAuth } = require('../middleware/auth')
const { supabaseAdmin } = require('../services/supabase')

async function requireSseAuth(req, res, next) {
  const token = req.query.token
  if (!token) return res.status(401).json({ error: 'Missing stream token' })

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return res.status(401).json({ error: 'Invalid stream token' })
    req.user = user
    req.accessToken = token
    return next()
  } catch {
    return res.status(401).json({ error: 'Stream authentication failed' })
  }
}

// GET /api/automation/status
router.get('/status', requireAuth, (req, res) => {
  res.json(automation.getStatus())
})

// GET /api/automation/logs  (also alias /log for frontend compat)
router.get('/logs', requireAuth, (req, res) => {
  res.json(automation.getLogs())
})
router.get('/log', requireAuth, (req, res) => {
  res.json(automation.getLogs())
})

// SSE — real-time log streaming
router.get('/stream', requireSseAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  // Send existing logs immediately
  const existing = automation.getLogs()
  existing.forEach(line => {
    res.write(`data: ${JSON.stringify({ line })}\n\n`)
  })

  // Subscribe to new logs
  const unsubscribe = automation.subscribe((line) => {
    res.write(`data: ${JSON.stringify({ line })}\n\n`)
  })

  // Heartbeat every 15s
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n')
  }, 15000)

  req.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe()
  })
})

// POST /api/automation/start
router.post('/start', requireAuth, (req, res) => {
  automation.startAutomation()
  res.json({ success: true, status: 'started' })
})

// POST /api/automation/stop
router.post('/stop', requireAuth, (req, res) => {
  automation.stopAutomation()
  res.json({ success: true, status: 'stopped' })
})

// POST /api/automation/run-now
router.post('/run-now', requireAuth, async (req, res) => {
  // Don't await — respond immediately so UI doesn't time out
  res.json({ success: true, status: 'tick-started' })
  automation.runAutomationTick()
})

// PUT /api/automation/targets  (handles targets + schedule + minScore)
router.put('/targets', requireAuth, (req, res) => {
  const { targets, schedule, minScore } = req.body
  if (targets) automation.updateTargets(targets)
  if (schedule !== undefined) automation.updateSchedule(schedule)
  if (minScore !== undefined) automation.updateMinScore(Number(minScore))
  res.json({ success: true, status: automation.getStatus() })
})

module.exports = router
