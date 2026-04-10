/**
 * Clients Routes — Multi-tenant client management
 * Agency admin manages clients, each gets a private portal token
 */

const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// ── List all clients for the authenticated user ─────────────────────────────
router.get('/', async (req, res) => {
  try {
    const supabase = getSupabase()
    const userId = req.headers['x-user-id']
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Create a new client ──────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const supabase = getSupabase()
    const userId = req.headers['x-user-id']
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { name, email, businessName, niche, plan, notes } = req.body
    if (!name || !email) return res.status(400).json({ error: 'Name and email required' })

    // Generate unique portal token
    const token = crypto.randomBytes(24).toString('hex')

    const { data, error } = await supabase
      .from('clients')
      .insert({
        user_id: userId,
        name,
        email,
        business_name: businessName || '',
        niche: niche || '',
        plan: plan || 'starter',
        notes: notes || '',
        portal_token: token,
        status: 'active',
        leads_sent: 0,
        meetings_booked: 0,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    const frontendUrl = process.env.FRONTEND_URL || 'https://proxaly.vercel.app'
    res.json({ ...data, portalUrl: `${frontendUrl}/client/${token}` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Update client ────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const supabase = getSupabase()
    const userId = req.headers['x-user-id']
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { data, error } = await supabase
      .from('clients')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Delete client ────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const supabase = getSupabase()
    const userId = req.headers['x-user-id']
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', userId)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Regenerate portal token ──────────────────────────────────────────────────
router.post('/:id/regenerate-token', async (req, res) => {
  try {
    const supabase = getSupabase()
    const userId = req.headers['x-user-id']
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const newToken = crypto.randomBytes(24).toString('hex')

    const { data, error } = await supabase
      .from('clients')
      .update({ portal_token: newToken })
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error

    const frontendUrl = process.env.FRONTEND_URL || 'https://proxaly.vercel.app'
    res.json({ token: newToken, portalUrl: `${frontendUrl}/client/${newToken}` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PUBLIC: Client portal — accessed via token (no auth needed) ─────────────
router.get('/portal/:token', async (req, res) => {
  try {
    const supabase = getSupabase()

    // Find client by token
    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('portal_token', req.params.token)
      .single()

    if (error || !client) return res.status(404).json({ error: 'Portal not found' })

    // Get leads stats for this client (match by agency user_id + client email/business)
    const { data: leads } = await supabase
      .from('leads')
      .select('status, created_at, name, company, email')
      .eq('user_id', client.user_id)
      .ilike('company', `%${client.business_name || client.name}%`)
      .limit(100)

    const allLeads = leads || []

    // Compute stats
    const stats = {
      totalLeads: allLeads.length,
      emailsSent: allLeads.filter(l => ['Contacted', 'Replied', 'Meeting Booked', 'Client'].includes(l.status)).length,
      replies: allLeads.filter(l => ['Replied', 'Meeting Booked', 'Client'].includes(l.status)).length,
      meetingsBooked: allLeads.filter(l => l.status === 'Meeting Booked').length,
      clients: allLeads.filter(l => l.status === 'Client').length,
    }

    // Build activity timeline
    const recentActivity = allLeads
      .filter(l => l.status !== 'New')
      .slice(0, 10)
      .map(l => ({
        name: l.name,
        company: l.company,
        status: l.status,
        date: l.created_at
      }))

    res.json({
      client: {
        name: client.name,
        businessName: client.business_name,
        niche: client.niche,
        plan: client.plan,
        startDate: client.created_at,
        status: client.status,
      },
      stats,
      recentActivity,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
