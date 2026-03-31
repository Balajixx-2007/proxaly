/**
 * Auth routes
 * GET /api/auth/profile — get current user's profile
 */

const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')

router.get('/profile', requireAuth, (req, res) => {
  const { id, email, created_at, user_metadata } = req.user
  res.json({
    id,
    email,
    created_at,
    user_metadata,
    plan: 'free',
    limits: { leads_per_month: 50, campaigns: 3 }
  })
})

module.exports = router
