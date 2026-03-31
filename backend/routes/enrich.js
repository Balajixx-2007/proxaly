/**
 * Enrich route (standalone endpoint for direct enrichment)
 * POST /api/enrich — enrich a lead payload directly
 */

const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const { enrichLead } = require('../services/groq')
const rateLimit = require('express-rate-limit')

const enrichLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many enrichment requests. Slow down.' },
})

router.post('/', requireAuth, enrichLimiter, async (req, res) => {
  const { name, businessType, city, phone, website, rating } = req.body

  if (!name) return res.status(400).json({ error: 'Lead name is required' })

  try {
    const result = await enrichLead({ name, business_type: businessType, city, phone, website, rating })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
