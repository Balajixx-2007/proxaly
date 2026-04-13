/**
 * Campaigns routes — user-scoped client (anon key + RLS)
 */
const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const { getClient } = require('../services/supabase')
const { v4: uuidv4 } = require('uuid')

function isMissingCampaignSchemaError(err) {
  const message = String(err?.message || err || '').toLowerCase()
  return (
    message.includes("could not find the table 'public.campaigns'") ||
    message.includes("could not find the table 'public.campaign_leads'") ||
    message.includes('relation "campaigns" does not exist') ||
    message.includes('relation "campaign_leads" does not exist')
  )
}

// ── GET /api/campaigns ────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = getClient(req)
    const { data: campaigns, error } = await db
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Get lead counts per campaign
    const enriched = await Promise.all((campaigns || []).map(async (c) => {
      const { data: links } = await db
        .from('campaign_leads')
        .select('lead_id, leads(status)')
        .eq('campaign_id', c.id)
        .limit(500)

      const leads = (links || []).map(l => l.leads).filter(Boolean)
      return {
        ...c,
        total_leads: leads.length,
        contacted: leads.filter(l => l.status === 'contacted').length,
        converted: leads.filter(l => l.status === 'converted').length,
      }
    }))

    res.json({ campaigns: enriched })
  } catch (err) {
    console.error('GET /campaigns error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/campaigns ───────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { name, description } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Campaign name is required' })

  try {
    const db = getClient(req)
    const { data: campaign, error } = await db
      .from('campaigns')
      .insert({
        id: uuidv4(),
        user_id: req.user.id,
        name: name.trim(),
        description: description?.trim() || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    res.status(201).json({ campaign: { ...campaign, total_leads: 0, contacted: 0, converted: 0 } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/campaigns/:id ──────────────────────────────────────────────────
router.patch('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const { name, description } = req.body
  const updates = { updated_at: new Date().toISOString() }
  if (name) updates.name = name.trim()
  if (description !== undefined) updates.description = description

  try {
    const db = getClient(req)
    const { data, error } = await db
      .from('campaigns')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    res.json({ campaign: data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/campaigns/:id ─────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
    const db = getClient(req)
    await db.from('campaign_leads').delete().eq('campaign_id', id)
    const { error } = await db.from('campaigns').delete().eq('id', id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/campaigns/:id/leads ─────────────────────────────────────────────
router.post('/:id/leads', requireAuth, async (req, res) => {
  const { id: campaignId } = req.params
  const { leadId } = req.body
  if (!leadId) return res.status(400).json({ error: 'leadId is required' })

  try {
    const db = getClient(req)
    const { data, error } = await db
      .from('campaign_leads')
      .insert({ campaign_id: campaignId, lead_id: leadId, added_at: new Date().toISOString() })
      .select()
      .single()

    if (error) throw error
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/campaigns/:id/leads/:leadId ───────────────────────────────────
router.delete('/:id/leads/:leadId', requireAuth, async (req, res) => {
  const { id: campaignId, leadId } = req.params
  try {
    const db = getClient(req)
    const { error } = await db
      .from('campaign_leads')
      .delete()
      .eq('campaign_id', campaignId)
      .eq('lead_id', leadId)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/campaigns/:id/leads ────────────────────────────────────────────
router.get('/:id/leads', requireAuth, async (req, res) => {
  const { id } = req.params

  try {
    const db = getClient(req)
    const { data: links, error } = await db
      .from('campaign_leads')
      .select('lead_id, added_at')
      .eq('campaign_id', id)
      .order('added_at', { ascending: false })

    if (error) throw error

    const leadIds = (links || []).map(link => link.lead_id).filter(Boolean)
    if (leadIds.length === 0) {
      return res.json({ leads: [] })
    }

    const { data: leads, error: leadsError } = await db
      .from('leads')
      .select('id, name, email, phone, website, city, address, business_type, status, ai_score, outreach_message, created_at')
      .in('id', leadIds)

    if (leadsError) throw leadsError

    const byId = (leads || []).reduce((acc, lead) => {
      acc[lead.id] = lead
      return acc
    }, {})

    return res.json({
      leads: (links || []).map(link => ({
        ...byId[link.lead_id],
        added_at: link.added_at,
      })).filter(Boolean),
    })
  } catch (err) {
    if (isMissingCampaignSchemaError(err)) {
      return res.json({ leads: [] })
    }
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
