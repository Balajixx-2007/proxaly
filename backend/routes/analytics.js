/**
 * Analytics Routes — Real data aggregation from Supabase
 * Powers the Analytics dashboard + weekly email reports
 */

const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const { getClient } = require('../services/supabase')
const { LEAD_STATUS, statusIn, normalizeLeadStatus, getLeadScore } = require('../utils/leadSchema')

// ── GET /api/analytics/overview ─────────────────────────────────────────────
router.get('/overview', requireAuth, async (req, res) => {
  try {
    const db = getClient(req)
    const { days = 30 } = req.query
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // All leads in period
    const { data: leads, error } = await db
      .from('leads')
      .select('id, status, ai_score, score, source, niche, created_at, contacted_at, enriched')
      .gte('created_at', since)

    if (error) throw error
    const all = leads || []

    // All-time totals
    const { count: totalAllTime } = await db
      .from('leads')
      .select('*', { count: 'exact', head: true })

    // Status breakdown
    const byStatus = {}
    all.forEach(l => {
      const status = normalizeLeadStatus(l.status)
      byStatus[status] = (byStatus[status] || 0) + 1
    })

    // Source breakdown
    const bySource = {}
    all.forEach(l => { bySource[l.source || 'unknown'] = (bySource[l.source || 'unknown'] || 0) + 1 })

    // Niche breakdown (top 5)
    const byNiche = {}
    all.forEach(l => { if (l.niche) byNiche[l.niche] = (byNiche[l.niche] || 0) + 1 })
    const topNiches = Object.entries(byNiche)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([niche, count]) => ({ niche, count }))

    // Score distribution
    const scoreDistribution = { low: 0, medium: 0, high: 0 }
    all.forEach(l => {
      const s = getLeadScore(l)
      if (s >= 8) scoreDistribution.high++
      else if (s >= 5) scoreDistribution.medium++
      else scoreDistribution.low++
    })

    // Daily lead count (last 14 days)
    const dailyData = []
    for (let i = 13; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0]
      const count = all.filter(l => l.created_at?.startsWith(dateStr)).length
      dailyData.push({ date: dateStr, count })
    }

    // Conversion funnel
    const funnel = {
      scraped: all.length,
      enriched: all.filter(l => l.enriched).length,
      contacted: all.filter(l => statusIn(l.status, [LEAD_STATUS.CONTACTED, LEAD_STATUS.REPLIED, LEAD_STATUS.MEETING_BOOKED, LEAD_STATUS.CLIENT])).length,
      replied: all.filter(l => statusIn(l.status, [LEAD_STATUS.REPLIED, LEAD_STATUS.MEETING_BOOKED, LEAD_STATUS.CLIENT])).length,
      meetings: all.filter(l => statusIn(l.status, [LEAD_STATUS.MEETING_BOOKED])).length,
      clients: all.filter(l => statusIn(l.status, [LEAD_STATUS.CLIENT])).length,
    }

    // Rates
    const replyRate = funnel.contacted > 0 ? Math.round((funnel.replied / funnel.contacted) * 100) : 0
    const meetingRate = funnel.contacted > 0 ? Math.round((funnel.meetings / funnel.contacted) * 100) : 0
    const enrichRate = funnel.scraped > 0 ? Math.round((funnel.enriched / funnel.scraped) * 100) : 0

    // Avg quality score
    const scores = all.map(l => getLeadScore(l)).filter(s => s > 0)
    const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0

    res.json({
      period: { days: Number(days), since },
      totals: {
        allTime: totalAllTime || 0,
        thisperiod: all.length,
        enriched: funnel.enriched,
        contacted: funnel.contacted,
        replied: funnel.replied,
        meetingsBooked: funnel.meetings,
        clients: funnel.clients,
      },
      rates: { replyRate, meetingRate, enrichRate },
      avgScore: Number(avgScore),
      funnel,
      byStatus,
      bySource,
      topNiches,
      scoreDistribution,
      dailyData,
    })
  } catch (err) {
    console.error('Analytics error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/analytics/campaigns ────────────────────────────────────────────
router.get('/campaigns', requireAuth, async (req, res) => {
  try {
    const db = getClient(req)
    const { data: campaigns, error } = await db
      .from('campaigns')
      .select('id, name, status, leads_count, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) throw error
    res.json(campaigns || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/analytics/report/send ─────────────────────────────────────────
// Manually trigger a report email
router.post('/report/send', requireAuth, async (req, res) => {
  try {
    const db = getClient(req)
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email required' })

    // Get analytics data
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: leads } = await db.from('leads').select('status, ai_score, score, created_at').gte('created_at', since)
    const all = leads || []

    const stats = {
      scraped: all.length,
      contacted: all.filter(l => statusIn(l.status, [LEAD_STATUS.CONTACTED, LEAD_STATUS.REPLIED, LEAD_STATUS.MEETING_BOOKED, LEAD_STATUS.CLIENT])).length,
      replied: all.filter(l => statusIn(l.status, [LEAD_STATUS.REPLIED, LEAD_STATUS.MEETING_BOOKED, LEAD_STATUS.CLIENT])).length,
      meetings: all.filter(l => statusIn(l.status, [LEAD_STATUS.MEETING_BOOKED])).length,
    }

    // Send report email via Brevo
    const brevoKey = process.env.BREVO_API_KEY
    if (!brevoKey) {
      return res.status(503).json({ error: 'Email not configured. Add BREVO_API_KEY to Railway env vars.' })
    }

    const html = buildReportHTML(stats)
    await sendReportEmail(email, html, brevoKey)

    res.json({ success: true, message: `Weekly report sent to ${email}` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Build HTML email ─────────────────────────────────────────────────────────
function buildReportHTML(stats, label = 'Last 7 Days') {
  const replyRate = stats.contacted > 0 ? Math.round((stats.replied / stats.contacted) * 100) : 0
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0f20; color: #e2e8f0; margin: 0; padding: 20px; }
    .card { background: #111827; border: 1px solid #1e2d4a; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
    .stat { display: inline-block; text-align: center; padding: 16px 20px; margin: 8px; background: #1a2035; border-radius: 8px; min-width: 100px; }
    .stat-value { font-size: 32px; font-weight: 800; color: #a78bfa; display: block; }
    .stat-label { font-size: 12px; color: #64748b; margin-top: 4px; display: block; }
    .logo { font-size: 22px; font-weight: 800; color: #a78bfa; }
    a { color: #22d3ee; }
  </style>
</head>
<body>
  <div style="max-width:600px;margin:0 auto;">
    <div style="text-align:center;padding:32px 0 16px;">
      <div class="logo">⚡ Proxaly Weekly Report</div>
      <p style="color:#64748b;font-size:14px;margin:8px 0 0;">${label}</p>
    </div>
    <div class="card">
      <h2 style="margin:0 0 20px;font-size:18px;">📊 Campaign Summary</h2>
      <div style="text-align:center">
        <div class="stat"><span class="stat-value" style="color:#a78bfa">${stats.scraped}</span><span class="stat-label">Leads Found</span></div>
        <div class="stat"><span class="stat-value" style="color:#22d3ee">${stats.contacted}</span><span class="stat-label">Emails Sent</span></div>
        <div class="stat"><span class="stat-value" style="color:#f59e0b">${stats.replied}</span><span class="stat-label">Replies</span></div>
        <div class="stat"><span class="stat-value" style="color:#4ade80">${stats.meetings}</span><span class="stat-label">Meetings</span></div>
      </div>
    </div>
    <div class="card">
      <h3 style="margin:0 0 12px;font-size:16px;">📈 Key Metrics</h3>
      <p style="margin:6px 0;font-size:14px;color:#94a3b8;">Reply Rate: <strong style="color:#f59e0b">${replyRate}%</strong></p>
      <p style="margin:6px 0;font-size:14px;color:#94a3b8;">Meeting Rate: <strong style="color:#4ade80">${stats.contacted > 0 ? Math.round((stats.meetings / stats.contacted) * 100) : 0}%</strong></p>
    </div>
    <div style="text-align:center;padding:24px 0;font-size:12px;color:#334155;">
      Powered by <strong>Proxaly</strong> — AI Lead Generation &amp; Outreach
      <br><a href="https://proxaly.vercel.app">View Full Dashboard →</a>
    </div>
  </div>
</body>
</html>`
}

async function sendReportEmail(toEmail, html, brevoKey) {
  if (typeof fetch !== 'function') {
    throw new Error('Global fetch API is unavailable on this Node runtime')
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Proxaly', email: process.env.BREVO_SENDER_EMAIL || 'reports@proxaly.app' },
      to: [{ email: toEmail }],
      subject: `📊 Proxaly Weekly Report — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
      htmlContent: html,
    })
  })
  if (!res.ok) throw new Error(await res.text())
}

module.exports = { router, buildReportHTML, sendReportEmail }
