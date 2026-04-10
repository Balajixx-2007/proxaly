/**
 * Automation service — runs on schedule to generate and send leads
 * Scrapes -> Enriches -> Filters -> Dedupes -> Saves -> Sends to Marketing Agent
 * Supports pub/sub for SSE real-time log streaming
 */

const cron = require('node-cron')
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { scrapeLeads } = require('./scraper')
const { enrichLeadsBatch } = require('./groq')
const { supabaseAdmin } = require('./supabase')

// ── Pub/sub for real-time SSE streaming ─────────────────────────────────────
const subscribers = new Set()

function subscribe(fn) {
  subscribers.add(fn)
  return () => subscribers.delete(fn) // returns unsubscribe function
}

function broadcast(line) {
  subscribers.forEach(fn => {
    try { fn(line) } catch (_) {}
  })
}

// ── State ────────────────────────────────────────────────────────────────────
let automationState = {
  running: false,
  cronJob: null,
  lastRun: null,
  nextRun: null,
  totalLeadsToday: 0,
  totalSentToday: 0,
  currentlyRunning: false,
  logs: [],
  targets: [
    { businessType: 'digital marketing agency', city: 'New York' },
    { businessType: 'dental clinic', city: 'Chennai' },
    { businessType: 'real estate agent', city: 'Mumbai' },
    { businessType: 'law firm', city: 'Bangalore' },
    { businessType: 'software company', city: 'Hyderabad' },
  ],
  scheduleHours: 6,
  minScore: 7,
  enabled: false
}

// ── File paths ───────────────────────────────────────────────────────────────
const LOG_DIR = path.join(__dirname, '..', 'logs')
const DATA_DIR = path.join(__dirname, '..', 'data')
const LOG_FILE = path.join(LOG_DIR, 'automation.log')
const STATE_FILE = path.join(DATA_DIR, 'automation-state.json')
const MARKETING_AGENT_URL = process.env.MARKETING_AGENT_URL || 'http://localhost:3000'

// Ensure directories exist
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

// ── Logging ──────────────────────────────────────────────────────────────────
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const entry = `[${timestamp}] ${level}: ${message}`
  console.log(entry)

  try { fs.appendFileSync(LOG_FILE, entry + '\n') } catch (_) {}

  automationState.logs.push(entry)
  if (automationState.logs.length > 200) automationState.logs.shift()

  // Broadcast to all SSE subscribers
  broadcast(entry)

  saveState()
}

// ── Persist state ─────────────────────────────────────────────────────────────
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'))
      automationState = { ...automationState, ...data, cronJob: null, currentlyRunning: false }
    }
  } catch (err) {
    console.error('Failed to load automation state:', err.message)
  }
}

function saveState() {
  try {
    const { cronJob, ...rest } = automationState
    fs.writeFileSync(STATE_FILE, JSON.stringify(rest, null, 2))
  } catch (err) {
    console.error('Failed to save automation state:', err.message)
  }
}

// ── Duplicate check ───────────────────────────────────────────────────────────
async function isDuplicate(lead) {
  try {
    const { data } = await supabaseAdmin
      .from('leads')
      .select('id')
      .eq('name', lead.name)
      .eq('city', lead.city)
      .limit(1)
    if (data && data.length > 0) return true

    if (lead.phone) {
      const { data: pd } = await supabaseAdmin
        .from('leads').select('id').eq('phone', lead.phone).limit(1)
      if (pd && pd.length > 0) return true
    }
    return false
  } catch {
    return false
  }
}

// ── Send to Marketing Agent ───────────────────────────────────────────────────
async function sendToMarketingAgent(lead) {
  try {
    if (!lead.email) {
      log(`Skipping ${lead.name} — no email`, 'WARN')
      return false
    }
    const payload = {
      name: lead.name || 'Unknown',
      email: lead.email,
      company: lead.city || lead.address || '',
      phone: lead.phone || '',
      website: lead.website || '',
      observation: lead.summary || lead.outreach_message || ''
    }
    const res = await axios.post(`${MARKETING_AGENT_URL}/api/leads`, payload, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' }
    })
    if (res.status === 200 || res.status === 201) {
      log(`Sent to Marketing Agent: ${lead.name} (${lead.email})`)
      return true
    }
    return false
  } catch (err) {
    log(`Send error for ${lead.name}: ${err.message}`, 'WARN')
    return false
  }
}

// ── Main tick ─────────────────────────────────────────────────────────────────
async function runAutomationTick() {
  if (automationState.currentlyRunning) {
    log('Already running — skipping tick', 'WARN')
    return
  }
  automationState.currentlyRunning = true
  automationState.lastRun = new Date().toISOString()

  log('Automation tick started')

  try {
    // 1 — Scrape
    let allLeads = []
    const targets = automationState.targets
    log(`Scraping ${targets.length} targets...`)

    for (const target of targets) {
      try {
        log(`Scraping: ${target.businessType} in ${target.city}`)
        const leads = await scrapeLeads({
          businessType: target.businessType,
          city: target.city,
          source: 'auto',
          maxResults: 10
        })
        allLeads = allLeads.concat(leads || [])
        log(`Scraped ${(leads || []).length} leads from ${target.businessType} in ${target.city}`)
      } catch (err) {
        log(`Target failed — ${target.businessType}, ${target.city}: ${err.message}`, 'ERROR')
      }
    }

    log(`Total scraped: ${allLeads.length} leads from ${targets.length} targets`)

    if (allLeads.length === 0) {
      log('No leads scraped from any target', 'WARN')
      automationState.currentlyRunning = false
      saveState()
      return
    }

    // 2 — Enrich with AI
    log('Enriching leads with AI...')
    const enrichResults = await enrichLeadsBatch(allLeads)
    const enriched = enrichResults
      .filter(r => r.success)
      .map(r => ({ ...allLeads.find(l => l.id === r.id), ...r }))

    // Assign default score to failed enrichments
    const failedIds = new Set(enrichResults.filter(r => !r.success).map(r => r.id))
    allLeads.filter(l => failedIds.has(l.id)).forEach(l => {
      enriched.push({ ...l, ai_score: 5, outreach_message: '', score_reason: 'AI enrichment failed' })
    })

    log(`Enriched ${enriched.length} leads with AI`)

    // 3 — Filter quality
    const minScore = automationState.minScore
    const quality = enriched.filter(l => (l.ai_score || 0) >= minScore)
    log(`Filtered to ${quality.length} quality leads score ${minScore}+`)

    if (quality.length === 0) {
      log('No quality leads after filtering', 'WARN')
      automationState.currentlyRunning = false
      saveState()
      return
    }

    // 4 — Deduplicate
    const newLeads = []
    for (const lead of quality) {
      if (!(await isDuplicate(lead))) newLeads.push(lead)
    }
    log(`${newLeads.length} new unique leads after deduplication`)

    if (newLeads.length === 0) {
      log('No new unique leads to save')
      automationState.currentlyRunning = false
      saveState()
      return
    }

    // 5 — Save to Supabase
    const toSave = newLeads.map(l => ({
      ...l,
      status: 'new',
      created_at: new Date().toISOString(),
      enriched_at: new Date().toISOString()
    }))

    const { data: saved, error: saveErr } = await supabaseAdmin
      .from('leads')
      .insert(toSave)
      .select()

    if (saveErr) {
      log(`DB save error: ${saveErr.message}`, 'ERROR')
    } else {
      log(`Saved ${saved?.length || 0} leads to database`)
    }

    automationState.totalLeadsToday += newLeads.length

    // 6 — Send to Marketing Agent
    let sent = 0
    for (const lead of newLeads) {
      if (await sendToMarketingAgent(lead)) sent++
    }
    log(`Sent ${sent} leads to Marketing Agent`)
    automationState.totalSentToday += sent

    log('Automation tick complete', 'SUCCESS')

  } catch (err) {
    log(`Automation tick error: ${err.message}`, 'ERROR')
    console.error(err.stack)
  } finally {
    automationState.currentlyRunning = false
    if (automationState.cronJob) {
      try {
        automationState.nextRun = automationState.cronJob.nextDate().toISO()
      } catch (_) {}
    }
    saveState()
  }
}

// ── Controls ──────────────────────────────────────────────────────────────────
function startAutomation() {
  if (automationState.cronJob) automationState.cronJob.stop()
  const h = automationState.scheduleHours || 6
  const expr = `0 */${h} * * *`
  automationState.cronJob = cron.schedule(expr, runAutomationTick, { scheduled: true })
  automationState.enabled = true
  automationState.running = true
  try { automationState.nextRun = automationState.cronJob.nextDate().toISO() } catch (_) {}
  saveState()
  log(`Automation started — runs every ${h} hours (${expr})`)
}

function stopAutomation() {
  if (automationState.cronJob) {
    automationState.cronJob.stop()
    automationState.cronJob = null
  }
  automationState.enabled = false
  automationState.running = false
  automationState.nextRun = null
  saveState()
  log('Automation stopped')
}

function updateTargets(newTargets) {
  automationState.targets = newTargets
  saveState()
  log(`Targets updated — ${newTargets.length} targets`)
}

function updateSchedule(hours) {
  automationState.scheduleHours = Number(hours) || 6
  if (automationState.enabled) {
    stopAutomation()
    startAutomation()
  }
  saveState()
}

function updateMinScore(score) {
  automationState.minScore = Number(score) || 7
  saveState()
  log(`Min score updated to ${automationState.minScore}`)
}

function getLogs() {
  return automationState.logs.slice(-100)
}

function getStatus() {
  const { cronJob, ...rest } = automationState
  return rest
}

// Reset daily counters at midnight
cron.schedule('0 0 * * *', () => {
  automationState.totalLeadsToday = 0
  automationState.totalSentToday = 0
  saveState()
})

// ── Weekly Report — every Monday at 8:00 AM ───────────────────────────────
cron.schedule('0 8 * * 1', async () => {
  const reportEmail = process.env.REPORT_EMAIL
  const brevoKey = process.env.BREVO_API_KEY
  if (!reportEmail || !brevoKey) {
    log('⚠️ Weekly report skipped — REPORT_EMAIL or BREVO_API_KEY not set')
    return
  }

  try {
    log('📊 Generating weekly report...')
    const { buildReportHTML, sendReportEmail } = require('../routes/analytics')

    // Pull last 7 days of leads from Supabase
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: leads } = await supabaseAdmin
      .from('leads')
      .select('status, score, created_at')
      .gte('created_at', since)

    const all = leads || []
    const stats = {
      scraped: all.length,
      contacted: all.filter(l => ['Contacted', 'Replied', 'Meeting Booked', 'Client'].includes(l.status)).length,
      replied: all.filter(l => ['Replied', 'Meeting Booked', 'Client'].includes(l.status)).length,
      meetings: all.filter(l => l.status === 'Meeting Booked').length,
    }

    const label = `Week of ${new Date(since).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
    const html = buildReportHTML(stats, label)
    await sendReportEmail(reportEmail, html, brevoKey)

    log(`✅ Weekly report sent to ${reportEmail}`)
  } catch (err) {
    log(`❌ Weekly report failed: ${err.message}`)
  }
})


function init() {
  loadState()
  if (automationState.enabled) startAutomation()
  log('Automation service initialized')
}


module.exports = {
  init,
  startAutomation,
  stopAutomation,
  runAutomationTick,
  updateTargets,
  updateSchedule,
  updateMinScore,
  getLogs,
  getStatus,
  subscribe,
}
