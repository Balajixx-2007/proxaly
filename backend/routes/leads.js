/**
 * Leads routes
 * Uses user-scoped Supabase client (JWT passthrough) → works with anon key + RLS
 */
const express = require('express')
const router = express.Router()
const rateLimit = require('express-rate-limit')
const { requireAuth } = require('../middleware/auth')
const { scrapeLeads } = require('../services/scraper')
const { enrichLead, enrichLeadsBatch } = require('../services/groq')
const { findEmail } = require('../services/emailFinder')
const { getClient } = require('../services/supabase')
const { v4: uuidv4 } = require('uuid')
const { normalizeLeadStatus } = require('../utils/leadSchema')
const { getInProcessAgent, callExternalAgent } = require('../services/agentMode')

// All business types are allowed — users can search for any niche
// Previously had a whitelist here that blocked custom types. Removed.

const scrapeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many scrape requests. Please wait 1 minute.' },
})

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function domainFromWebsite(website) {
  try {
    if (!website) return null
    const normalized = website.startsWith('http') ? website : `https://${website}`
    return new URL(normalized).hostname.toLowerCase().replace(/^www\./, '')
  } catch (_) {
    return null
  }
}

function dedupeMarkers(lead) {
  const markers = []
  const domain = domainFromWebsite(lead?.website)
  if (domain) markers.push(`domain:${domain}`)
  const normalized = normalizeName(lead?.name)
  if (normalized) markers.push(`name:${normalized}`)
  return markers
}

function isUsableLead(lead) {
  return Boolean(lead?.email || lead?.phone || lead?.website)
}

// ── GET /api/leads ────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const { limit = 100, offset = 0, status, orderBy = 'created_at', order = 'desc' } = req.query
    const db = getClient(req)

    let query = db
      .from('leads')
      .select('*', { count: 'exact' })
      .order(orderBy, { ascending: order === 'asc' })
      .range(Number(offset), Number(offset) + Number(limit) - 1)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: leads, error, count } = await query

    if (error) throw error
    res.json({ leads: leads || [], total: count || 0 })
  } catch (err) {
    console.error('GET /leads error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/leads/scrape ────────────────────────────────────────────────────
router.post('/scrape', requireAuth, scrapeLimiter, async (req, res) => {
  const { businessType, city, source = 'google_maps', maxResults = 15 } = req.body

  if (!businessType?.trim() || !city?.trim()) {
    return res.status(400).json({ error: 'businessType and city are required' })
  }


  const normalizedBusinessType = businessType.trim().toLowerCase()

  try {
    const rawLeads = await scrapeLeads({
      businessType: normalizedBusinessType,
      city: city.trim(),
      source,
      maxResults: Math.min(Number(maxResults), 30),
    })

    const usableLeads = rawLeads.filter(isUsableLead)

    if (!usableLeads.length) {
      return res.json({ leads: [], message: 'No leads found. Try a different source or search term.' })
    }

    const db = getClient(req)
    const { data: existing, error: existingError } = await db
      .from('leads')
      .select('name, website')
      .limit(5000)

    if (existingError) throw existingError

    const seenKeys = new Set((existing || []).flatMap(dedupeMarkers))
    const localKeys = new Set()
    const unseenLeads = []
    for (const lead of usableLeads) {
      const markers = dedupeMarkers(lead)
      if (markers.length === 0) continue
      if (markers.some(marker => seenKeys.has(marker) || localKeys.has(marker))) continue
      markers.forEach(marker => localKeys.add(marker))
      unseenLeads.push(lead)
    }

    if (!unseenLeads.length) {
      return res.json({ leads: [], message: 'No fresh leads found. Try Find New Leads again.' })
    }

    const leadsToInsert = unseenLeads.map(lead => {
      const { contactable, ...persistable } = lead
      return {
      ...persistable,
      id: uuidv4(),
      user_id: req.user.id,
      }
    })

    const { data: saved, error } = await db
      .from('leads')
      .insert(leadsToInsert)
      .select()

    if (error) {
      console.warn('DB insert failed:', error.message)
      // Return results even if DB save fails (e.g. tables not created yet)
      return res.json({
        leads: unseenLeads.map(lead => ({ ...lead, contactable: isUsableLead(lead) })),
        saved: false,
        message: 'Scraped successfully! Run the SQL schema in Supabase to save leads permanently.'
      })
    }

    const responseLeads = (saved || unseenLeads).map(lead => ({ ...lead, contactable: isUsableLead(lead) }))
    res.json({ leads: responseLeads, total: responseLeads.length })
  } catch (err) {
    console.error('Scrape error:', err.message)
    res.status(500).json({ error: `Scraping failed: ${err.message}` })
  }
})

// ── DELETE /api/leads/bulk-delete ────────────────────────────────────────────
router.delete('/bulk-delete', requireAuth, async (req, res) => {
  const { ids } = req.body || {}

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Provide an array of lead IDs' })
  }

  try {
    const db = getClient(req)
    const { error } = await db.from('leads').delete().in('id', ids)
    if (error) throw error
    res.json({ success: true, deleted: ids.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/leads/bulk-enrich ───────────────────────────────────────────────
router.post('/bulk-enrich', requireAuth, async (req, res) => {
  const { ids } = req.body

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Provide an array of lead IDs' })
  }
  if (ids.length > 20) {
    return res.status(400).json({ error: 'Maximum 20 leads per bulk enrichment' })
  }

  try {
    const db = getClient(req)
    const { data: leads, error } = await db
      .from('leads')
      .select('*')
      .in('id', ids)

    if (error) throw error

    const results = await enrichLeadsBatch(leads || [])
    const updated = []

    for (const result of results) {
      if (!result.success) continue
      const { id, success, error: _e, ...enrichData } = result
      const { data } = await db
        .from('leads')
        .update({ ...enrichData, enriched_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (data) updated.push(data)
    }

    res.json({ leads: updated, enriched: updated.length, failed: results.filter(r => !r.success).length })
  } catch (err) {
    console.error('Bulk enrich error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/leads/export ─────────────────────────────────────────────────────
router.get('/export', requireAuth, async (req, res) => {
  const { status } = req.query
  const db = getClient(req)

  try {
    let query = db.from('leads').select('*').order('created_at', { ascending: false })
    if (status && status !== 'all') query = query.eq('status', status)

    const { data: leads, error } = await query
    if (error) throw error

    const cols = ['name', 'city', 'address', 'phone', 'website', 'rating', 'ai_score', 'status', 'outreach_message', 'source', 'created_at']
    const escape = v => `"${String(v || '').replace(/"/g, '""')}"`

    const csv = [
      cols.join(','),
      ...(leads || []).map(lead => cols.map(col => escape(lead[col])).join(','))
    ].join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="Proxaly_leads_${Date.now()}.csv"`)
    res.send(csv)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/leads/:id/enrich ────────────────────────────────────────────────
router.post('/:id/enrich', requireAuth, async (req, res) => {
  const { id } = req.params
  const db = getClient(req)

  try {
    const { data: lead, error } = await db.from('leads').select('*').eq('id', id).single()
    if (error || !lead) return res.status(404).json({ error: 'Lead not found' })

    const enriched = await enrichLead(lead)

    const updateData = { ...enriched, enriched_at: new Date().toISOString() }
    // Remove null email so it doesn't overwrite existing one
    if (!updateData.email) delete updateData.email

    const { data: updated, error: updateError } = await db
      .from('leads')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    res.json({ lead: updateError ? { ...lead, ...enriched } : updated })
  } catch (err) {
    console.error('Enrich error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/leads/:id/find-email ───────────────────────────────────────────
router.post('/:id/find-email', requireAuth, async (req, res) => {
  const { id } = req.params
  const db = getClient(req)

  try {
    const { data: lead, error } = await db.from('leads').select('*').eq('id', id).single()
    if (error || !lead) return res.status(404).json({ error: 'Lead not found' })

    const email = await findEmail(lead)

    if (email) {
      const { data: updated } = await db
        .from('leads')
        .update({ email, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      res.json({ email, lead: updated || { ...lead, email } })
    } else {
      res.json({ email: null, message: 'Could not find email for this business' })
    }
  } catch (err) {
    console.error('Find email error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/leads/:id ──────────────────────────────────────────────────────
router.patch('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const allowed = ['status', 'notes', 'name', 'phone', 'website', 'address', 'city']
  const updates = {}
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key]
  }

  if ('status' in updates) {
    updates.status = normalizeLeadStatus(updates.status)
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' })
  }

  try {
    const db = getClient(req)
    const { data, error } = await db
      .from('leads')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    res.json({ lead: data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/leads/:id ─────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
    const db = getClient(req)
    const { error } = await db.from('leads').delete().eq('id', id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/leads/send-to-agent ────────────────────────────────────────────
/**
 * Send selected leads to Marketing Agent
 * Body: { leadIds: [...] }
 * 1. Fetch leads from Supabase
 * 2. Format for Marketing Agent
 * 3. Send each lead individually
 * 4. Start marketing agent
 * 5. Return success/failed counts
 */
router.post('/send-to-agent', requireAuth, async (req, res) => {
  const { leadIds } = req.body

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return res.status(400).json({ error: 'Provide an array of lead IDs' })
  }

  if (leadIds.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 leads per send' })
  }

  try {
    const db = getClient(req)
    const { data: leads, error } = await db
      .from('leads')
      .select('*')
      .in('id', leadIds)

    if (error) throw error
    if (!leads || leads.length === 0) {
      return res.status(404).json({ error: 'No leads found' })
    }

    let sent = 0
    let failed = 0
    const errors = []

    const agentService = getInProcessAgent()
    if (agentService) {
      console.log(`[Marketing Agent] Queueing ${leads.length} leads to in-process agent`)

      for (const lead of leads) {
        try {
          const email = lead.email || ''
          if (!email) {
            console.log(`[Marketing Agent] Skipping ${lead.name} - no email`)
            failed++
            continue
          }

          await agentService.queue.addToQueue({
            leadId: lead.id,
            userId: req.user.id,
            email,
            leadName: lead.name || 'Unknown',
            company: lead.city || lead.address || '',
            enrichmentData: {
              phone: lead.phone || '',
              website: lead.website || '',
              observation: lead.ai_summary || lead.outreach_message || lead.notes || '',
            },
          })

          sent++
          console.log(`[Marketing Agent] ✅ Queued: ${lead.name} (${email})`)
        } catch (err) {
          failed++
          errors.push(`${lead.name}: ${err.message}`)
          console.error(`[Marketing Agent] Queue error for ${lead.name}:`, err.message)
        }
      }

      if (sent > 0) {
        try {
          await agentService.start()
        } catch (err) {
          console.warn('[Marketing Agent] Could not start in-process agent:', err.message)
        }
      }
    } else {
      console.log(`[Marketing Agent] Sending ${leads.length} leads to external agent`)

      for (const lead of leads) {
        try {
          const payload = {
            name: lead.name || 'Unknown',
            email: lead.email || '',
            company: lead.city || lead.address || '',
            phone: lead.phone || '',
            website: lead.website || '',
            observation: lead.ai_summary || lead.outreach_message || lead.notes || ''
          }

          if (!payload.email) {
            console.log(`[Marketing Agent] Skipping ${lead.name} - no email`)
            failed++
            continue
          }

          const response = await callExternalAgent('post', '/api/leads', payload, 5000)

          if (response.status >= 200 && response.status < 300) {
            sent++
            console.log(`[Marketing Agent] ✅ Sent: ${lead.name} (${lead.email})`)
          } else {
            failed++
            errors.push(`${lead.name}: ${typeof response.data === 'string' ? response.data : JSON.stringify(response.data)}`)
            console.log(`[Marketing Agent] ❌ Failed: ${lead.name} - ${response.status}`)
          }
        } catch (err) {
          failed++
          errors.push(`${lead.name}: ${err.message}`)
          console.error(`[Marketing Agent] Send error for ${lead.name}:`, err.message)
        }
      }

      if (sent > 0) {
        try {
          console.log('[Marketing Agent] Starting external agent loop...')
          await callExternalAgent('post', '/api/agent/start', {}, 5000)
          console.log('[Marketing Agent] ✅ External agent started')
        } catch (err) {
          console.warn('[Marketing Agent] Could not start external agent:', err.message)
        }
      }
    }

    const responseBody = {
      success: sent > 0,
      sent,
      failed,
      total: leads.length,
      errors: errors.length > 0 ? errors : undefined,
      message: sent > 0
        ? `Sent ${sent}/${leads.length} leads to Marketing Agent`
        : 'No leads could be queued for Marketing Agent',
    }

    if (sent === 0) {
      return res.status(503).json(responseBody)
    }

    res.json(responseBody)

  } catch (err) {
    console.error('Send to agent error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/agent/status ───────────────────────────────────────────────────
/**
 * Proxy Marketing Agent status
 * Returns: { running, tickCount, lastRunTime, status }
 */
router.get('/agent/status', requireAuth, async (req, res) => {
  try {
    const agentService = getInProcessAgent()
    if (agentService) {
      const status = await agentService.getStatus()
      return res.json(status)
    }

    const response = await callExternalAgent('get', '/api/agent/status', undefined, 5000)

    if (response.status < 200 || response.status >= 300) {
      console.warn(`[Marketing Agent] Status check failed: ${response.status}`)
      return res.status(503).json({
        error: 'Marketing Agent unreachable',
        status: 'offline'
      })
    }

    res.json(response.data)
  } catch (err) {
    console.error('[Marketing Agent] Status check error:', err.message)
    res.status(503).json({
      error: 'Marketing Agent unreachable',
      status: 'offline',
      details: err.message
    })
  }
})

module.exports = router
