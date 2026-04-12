const express = require('express')
const axios = require('axios')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

function getMarketingAgentUrl() {
  return process.env.MARKETING_AGENT_URL || 'http://localhost:3000'
}

async function callAgent(method, path, data) {
  const base = getMarketingAgentUrl()
  const url = `${base}${path}`

  const response = await axios({
    method,
    url,
    data,
    timeout: 8000,
    validateStatus: () => true,
    headers: { 'Content-Type': 'application/json' },
  })

  return response
}

router.get('/status', requireAuth, async (req, res) => {
  try {
    const response = await callAgent('get', '/api/agent/status')
    if (response.status < 200 || response.status >= 300) {
      return res.status(503).json({
        error: 'Marketing Agent unreachable',
        upstreamStatus: response.status,
        status: 'offline'
      })
    }
    res.json(response.data)
  } catch (err) {
    res.status(503).json({ error: 'Marketing Agent unreachable', details: err.message, status: 'offline' })
  }
})

router.post('/start', requireAuth, async (req, res) => {
  try {
    const response = await callAgent('post', '/api/agent/start', {})
    res.status(response.status).json(response.data)
  } catch (err) {
    res.status(503).json({ error: 'Failed to start Marketing Agent', details: err.message })
  }
})

router.post('/stop', requireAuth, async (req, res) => {
  try {
    const response = await callAgent('post', '/api/agent/stop', {})
    res.status(response.status).json(response.data)
  } catch (err) {
    res.status(503).json({ error: 'Failed to stop Marketing Agent', details: err.message })
  }
})

router.get('/approvals', requireAuth, async (req, res) => {
  try {
    const response = await callAgent('get', '/api/approvals')
    res.status(response.status).json(response.data)
  } catch (err) {
    res.status(503).json({ error: 'Failed to fetch approvals', details: err.message })
  }
})

router.post('/approvals/:leadId/approve', requireAuth, async (req, res) => {
  try {
    const response = await callAgent('post', `/api/approvals/${req.params.leadId}/approve`, {})
    res.status(response.status).json(response.data)
  } catch (err) {
    res.status(503).json({ error: 'Failed to approve reply', details: err.message })
  }
})

router.post('/approvals/:leadId/reject', requireAuth, async (req, res) => {
  try {
    const response = await callAgent('post', `/api/approvals/${req.params.leadId}/reject`, {})
    res.status(response.status).json(response.data)
  } catch (err) {
    res.status(503).json({ error: 'Failed to reject reply', details: err.message })
  }
})

module.exports = router
