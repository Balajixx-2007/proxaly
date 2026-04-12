const express = require('express')
const router = express.Router()
const rateLimit = require('express-rate-limit')
const { requireAuth } = require('../middleware/auth')
const { getClient } = require('../services/supabase')
const emailOutreach = require('../services/emailOutreach')

const emailLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many email requests. Please slow down.' },
})

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isMissingEmailSchemaError(err) {
  const msg = String(err?.message || err || '').toLowerCase()
  return (
    msg.includes("could not find the table 'public.email_logs'") ||
    msg.includes("could not find the table 'public.email_sequences'") ||
    msg.includes('relation "email_logs" does not exist') ||
    msg.includes('relation "email_sequences" does not exist')
  )
}

router.post('/preview', requireAuth, emailLimiter, async (req, res) => {
  const { leadId, stepType = 'initial', painPoint } = req.body
  if (!leadId) return res.status(400).json({ error: 'leadId is required' })

  try {
    const db = getClient(req)
    const { data: lead, error } = await db
      .from('leads')
      .select('id, name, email, city, website, business_type')
      .eq('id', leadId)
      .single()

    if (error || !lead) return res.status(404).json({ error: 'Lead not found' })

    const copy = await emailOutreach.generateEmailPreview({ lead, stepType, painPoint })
    res.json({ success: true, leadId, ...copy })
  } catch (err) {
    if (isMissingEmailSchemaError(err)) {
      return res.json({ logs: [], warning: 'Email logging tables are not initialized yet.' })
    }
    res.status(500).json({ error: err.message })
  }
})

router.post('/send', requireAuth, emailLimiter, async (req, res) => {
  const { leadId, campaignId = null, sequenceId = null, subject, body, painPoint } = req.body
  if (!leadId) return res.status(400).json({ error: 'leadId is required' })

  try {
    const db = getClient(req)
    const { data: lead, error } = await db
      .from('leads')
      .select('id, name, email, city, website, business_type')
      .eq('id', leadId)
      .single()

    if (error || !lead) return res.status(404).json({ error: 'Lead not found' })
    if (!lead.email || !isValidEmail(lead.email)) return res.status(400).json({ error: 'Lead has invalid email' })

    const sent = await emailOutreach.sendSingleEmailNow({
      userId: req.user.id,
      lead,
      campaignId,
      sequenceId,
      step: 1,
      stepType: 'initial',
      subject,
      body,
      painPoint,
    })

    const sequence = await emailOutreach.getSequenceForUser(req.user.id, sequenceId)
    const followups = (sequence.steps || emailOutreach.DEFAULT_SEQUENCE_STEPS).filter(s => Number(s.step) > 1)
    if (followups.length > 0) {
      await emailOutreach.createPendingLogs({
        userId: req.user.id,
        leadId: lead.id,
        campaignId,
        sequenceId: sequence.id,
        startAt: new Date(),
        steps: followups,
      })
    }

    res.json({ success: true, leadId: lead.id, subject: sent.copy.subject, followupsScheduled: followups.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/bulk', requireAuth, emailLimiter, async (req, res) => {
  const { leadIds = [], campaignId = null, sequenceId = null, painPoint } = req.body
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return res.status(400).json({ error: 'leadIds array is required' })
  }
  if (leadIds.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 leads per bulk send' })
  }

  try {
    const db = getClient(req)
    const { data: leads, error } = await db
      .from('leads')
      .select('id, name, email, city, website, business_type')
      .in('id', leadIds)

    if (error) throw error

    const sequence = await emailOutreach.getSequenceForUser(req.user.id, sequenceId)
    const followups = (sequence.steps || emailOutreach.DEFAULT_SEQUENCE_STEPS).filter(s => Number(s.step) > 1)

    let sent = 0
    let failed = 0
    const errors = []

    for (const lead of leads || []) {
      try {
        if (!lead.email || !isValidEmail(lead.email)) {
          failed++
          errors.push(`${lead.id}: missing or invalid email`)
          continue
        }

        await emailOutreach.sendSingleEmailNow({
          userId: req.user.id,
          lead,
          campaignId,
          sequenceId: sequence.id,
          step: 1,
          stepType: 'initial',
          painPoint,
        })

        if (followups.length > 0) {
          await emailOutreach.createPendingLogs({
            userId: req.user.id,
            leadId: lead.id,
            campaignId,
            sequenceId: sequence.id,
            startAt: new Date(),
            steps: followups,
          })
        }

        sent++
      } catch (err) {
        failed++
        errors.push(`${lead.id}: ${err.message}`)
      }
    }

    res.json({ success: true, total: leadIds.length, sent, failed, errors: errors.length ? errors : undefined })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/schedule', requireAuth, emailLimiter, async (req, res) => {
  const { leadIds = [], campaignId = null, sequenceId = null, startAt } = req.body
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return res.status(400).json({ error: 'leadIds array is required' })
  }

  try {
    const db = getClient(req)
    const { data: leads, error } = await db
      .from('leads')
      .select('id, email')
      .in('id', leadIds)

    if (error) throw error

    const sequence = await emailOutreach.getSequenceForUser(req.user.id, sequenceId)
    const steps = sequence.steps || emailOutreach.DEFAULT_SEQUENCE_STEPS
    const anchor = startAt ? new Date(startAt) : new Date()

    let scheduledLeads = 0
    for (const lead of leads || []) {
      if (!lead.email || !isValidEmail(lead.email)) continue
      await emailOutreach.createPendingLogs({
        userId: req.user.id,
        leadId: lead.id,
        campaignId,
        sequenceId: sequence.id,
        startAt: anchor,
        steps,
      })
      scheduledLeads++
    }

    res.json({
      success: true,
      sequence: sequence.name,
      leadsScheduled: scheduledLeads,
      logsCreated: scheduledLeads * steps.length,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/logs', requireAuth, async (req, res) => {
  const { limit = 50, status } = req.query

  try {
    const db = getClient(req)
    let query = db
      .from('email_logs')
      .select('id, lead_id, campaign_id, sequence_id, step, status, subject, scheduled_at, sent_at, error_text, created_at')
      .order('created_at', { ascending: false })
      .limit(Math.min(Number(limit) || 50, 200))

    if (status && status !== 'all') query = query.eq('status', status)

    const { data: logs, error } = await query
    if (error) throw error

    const leadIds = [...new Set((logs || []).map(l => l.lead_id).filter(Boolean))]
    let leadsById = {}
    if (leadIds.length > 0) {
      const { data: leads } = await db
        .from('leads')
        .select('id, name, email')
        .in('id', leadIds)
      leadsById = (leads || []).reduce((acc, lead) => {
        acc[lead.id] = lead
        return acc
      }, {})
    }

    const decorated = (logs || []).map(log => ({
      ...log,
      lead_name: leadsById[log.lead_id]?.name || null,
      lead_email: leadsById[log.lead_id]?.email || null,
    }))

    res.json({ logs: decorated })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
