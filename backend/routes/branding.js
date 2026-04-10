/**
 * Branding Routes — White-label configuration per user
 * Stores agency name, logo, colors, tagline for client portal
 */

const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const { getClient } = require('../services/supabase')

// ── GET /api/branding ─────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = getClient(req)
    const userId = req.user?.id

    const { data, error } = await db
      .from('agency_branding')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows

    res.json(data || getDefaultBranding())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/branding ────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const db = getClient(req)
    const userId = req.user?.id

    const branding = {
      user_id: userId,
      agency_name: req.body.agencyName || 'My Agency',
      agency_tagline: req.body.agencyTagline || '',
      logo_url: req.body.logoUrl || '',
      favicon_url: req.body.faviconUrl || '',
      primary_color: req.body.primaryColor || '#7c3aed',
      accent_color: req.body.accentColor || '#22d3ee',
      email_signature: req.body.emailSignature || '',
      support_email: req.body.supportEmail || '',
      website_url: req.body.websiteUrl || '',
      footer_text: req.body.footerText || '',
      hide_proxaly_branding: req.body.hideProxalyBranding || false,
      updated_at: new Date().toISOString(),
    }

    // Upsert branding
    const { data, error } = await db
      .from('agency_branding')
      .upsert(branding, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PUBLIC: GET /api/branding/portal/:token ────────────────────────────────
// Called by the client portal to get branding for that agency
router.get('/portal/:token', async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js')
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Find the client and their owner's branding
    const { data: client } = await supabase
      .from('clients')
      .select('user_id')
      .eq('portal_token', req.params.token)
      .single()

    if (!client) return res.json(getDefaultBranding())

    const { data: branding } = await supabase
      .from('agency_branding')
      .select('*')
      .eq('user_id', client.user_id)
      .single()

    res.json(branding || getDefaultBranding())
  } catch (err) {
    res.json(getDefaultBranding())
  }
})

function getDefaultBranding() {
  return {
    agency_name: 'Proxaly',
    agency_tagline: 'AI-Powered Lead Generation & Outreach',
    logo_url: '',
    favicon_url: '',
    primary_color: '#7c3aed',
    accent_color: '#22d3ee',
    email_signature: '',
    support_email: 'support@proxaly.app',
    website_url: 'https://proxaly.app',
    footer_text: '',
    hide_proxaly_branding: false,
  }
}

module.exports = { router, getDefaultBranding }
