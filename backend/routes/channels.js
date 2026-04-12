/**
 * Channels Routes — Multi-channel outreach API
 * WhatsApp (Twilio) + LinkedIn (AI message generation)
 */

const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const { getClient } = require('../services/supabase')
const channels = require('../services/channels')

const CONTACTED_LIKE_STATUSES = ['contacted', 'replied', 'Contacted', 'Replied']
const EMAIL_SENT_LIKE_STATUSES = ['contacted', 'replied', 'meeting_booked', 'client', 'Contacted', 'Replied', 'Meeting Booked', 'Client']
const LINKEDIN_QUEUE_STATUSES = ['new', 'contacted', 'replied', 'New', 'Contacted', 'Replied']

// ── POST /api/channels/whatsapp/send ────────────────────────────────────────
// Send a WhatsApp message to a single lead
router.post('/whatsapp/send', requireAuth, async (req, res) => {
  try {
    const { leadId, message, phone } = req.body
    const db = getClient(req)

    let lead = null
    let targetPhone = phone
    let targetMessage = message

    if (leadId) {
      const { data } = await db.from('leads').select('*').eq('id', leadId).single()
      lead = data
      if (!lead) return res.status(404).json({ error: 'Lead not found' })

      targetPhone = phone || lead.phone
      if (!targetPhone) return res.status(400).json({ error: 'No phone number for this lead. Add phone number first.' })

      // Get config to build message
      const { data: settings } = await db.from('settings').select('*').limit(1).single()
      const config = settings?.config || {}

      targetMessage = message || channels.buildWhatsAppMessage(lead, config)
    }

    if (!targetPhone) return res.status(400).json({ error: 'Phone number required' })
    if (!targetMessage) return res.status(400).json({ error: 'Message required' })

    const result = await channels.sendWhatsApp(targetPhone, targetMessage)

    // Log and update lead status
    if (leadId && lead) {
      await db.from('leads').update({
        whatsapp_sent: true,
        whatsapp_sent_at: new Date().toISOString(),
        whatsapp_status: result.status,
        channels_used: [...(lead.channels_used || []), 'whatsapp'],
      }).eq('id', leadId)
    }

    res.json({ success: true, ...result })
  } catch (err) {
    console.error('WhatsApp send error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/channels/whatsapp/bulk ────────────────────────────────────────
// Send WhatsApp to all leads with phone numbers that haven't been WA'd
router.post('/whatsapp/bulk', requireAuth, async (req, res) => {
  const db = getClient(req)

  try {
    const { data: settings } = await db.from('settings').select('*').limit(1).single()
    const config = settings?.config || {}

    // Get leads that have phone, were contacted by email, but no WA yet
    const { data: leads } = await db
      .from('leads')
      .select('*')
      .in('status', CONTACTED_LIKE_STATUSES)
      .eq('whatsapp_sent', false)
      .not('phone', 'is', null)
      .limit(20)

    if (!leads || leads.length === 0) {
      return res.json({ success: true, sent: 0, message: 'No eligible leads for WhatsApp (need phone number + email already sent)' })
    }

    res.json({ success: true, message: `Starting WhatsApp outreach to ${leads.length} leads`, total: leads.length })

    // Process in background
    let sent = 0
    for (const lead of leads) {
      try {
        const message = channels.buildWhatsAppMessage(lead, config)
        await channels.sendWhatsApp(lead.phone, message)
        await db.from('leads').update({
          whatsapp_sent: true,
          whatsapp_sent_at: new Date().toISOString(),
          channels_used: [...(lead.channels_used || []), 'whatsapp'],
        }).eq('id', lead.id)
        sent++
        await new Promise(r => setTimeout(r, 2000)) // 2s delay between messages
      } catch (err) {
        console.error(`WhatsApp failed for ${lead.name}:`, err.message)
      }
    }
    console.log(`✅ WhatsApp bulk done: ${sent}/${leads.length} sent`)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/channels/linkedin/message/:leadId ───────────────────────────────
// Generate AI LinkedIn message for a lead
router.get('/linkedin/message/:leadId', requireAuth, async (req, res) => {
  try {
    const db = getClient(req)
    const { data: lead } = await db.from('leads').select('*').eq('id', req.params.leadId).single()
    if (!lead) return res.status(404).json({ error: 'Lead not found' })

    const { data: settings } = await db.from('settings').select('*').limit(1).single()
    const config = settings?.config || {}

    const message = await channels.generateLinkedInMessage(lead, config)
    const linkedinUrl = channels.buildLinkedInUrl(lead)

    res.json({ message, linkedinUrl, lead: { name: lead.name, company: lead.company } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/channels/linkedin/log ─────────────────────────────────────────
// Mark a lead as LinkedIn outreach attempted
router.post('/linkedin/log/:leadId', requireAuth, async (req, res) => {
  try {
    const db = getClient(req)
    const { data: lead } = await db.from('leads').select('channels_used').eq('id', req.params.leadId).single()
    if (!lead) return res.status(404).json({ error: 'Lead not found' })

    await db.from('leads').update({
      linkedin_messaged: true,
      linkedin_messaged_at: new Date().toISOString(),
      channels_used: [...(lead.channels_used || []), 'linkedin'],
    }).eq('id', req.params.leadId)

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/channels/stats ──────────────────────────────────────────────────
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const db = getClient(req)
    const { count: waCount } = await db.from('leads').select('*', { count: 'exact', head: true }).eq('whatsapp_sent', true)
    const { count: liCount } = await db.from('leads').select('*', { count: 'exact', head: true }).eq('linkedin_messaged', true)
    const { count: emailCount } = await db.from('leads').select('*', { count: 'exact', head: true }).in('status', EMAIL_SENT_LIKE_STATUSES)

    res.json({
      email: emailCount || 0,
      whatsapp: waCount || 0,
      linkedin: liCount || 0,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/channels/whatsapp/queue ────────────────────────────────────────
// Leads ready for WhatsApp (have phone, emailed, no WA yet)
router.get('/whatsapp/queue', requireAuth, async (req, res) => {
  try {
    const db = getClient(req)
    const { data } = await db
      .from('leads')
      .select('id, name, company, phone, status, email, created_at')
      .in('status', CONTACTED_LIKE_STATUSES)
      .eq('whatsapp_sent', false)
      .not('phone', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50)

    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/channels/linkedin/queue ────────────────────────────────────────
// Leads ready for LinkedIn (not yet LinkedIn'd)
router.get('/linkedin/queue', requireAuth, async (req, res) => {
  try {
    const db = getClient(req)
    const { data } = await db
      .from('leads')
      .select('id, name, company, email, status, linkedin_url, observation, created_at')
      .in('status', LINKEDIN_QUEUE_STATUSES)
      .neq('linkedin_messaged', true)
      .order('created_at', { ascending: false })
      .limit(50)

    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
