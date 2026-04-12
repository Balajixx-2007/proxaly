const Groq = require('groq-sdk')
const { v4: uuidv4 } = require('uuid')
const { supabaseAdmin } = require('./supabase')
const { captureException } = require('./monitoring')

const GROQ_MODELS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
]

const DEFAULT_SEQUENCE_STEPS = [
  { step: 1, delayDays: 0, type: 'initial' },
  { step: 2, delayDays: 2, type: 'follow_up_1' },
  { step: 3, delayDays: 6, type: 'follow_up_2' },
]

const OPT_OUT_LINE = 'If you\'re not interested, just reply "stop" and I won\'t reach out again.'

let groqClient = null

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null
  if (!groqClient) groqClient = new Groq({ apiKey })
  return groqClient
}

async function chatWithFallback(messages) {
  const client = getGroqClient()
  if (!client) throw new Error('GROQ_API_KEY not set')

  for (const model of GROQ_MODELS) {
    try {
      const completion = await client.chat.completions.create({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 500,
      })
      const content = completion.choices[0]?.message?.content
      if (content && content.trim()) return content
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('decommissioned') || msg.includes('not supported') || err.status === 400) continue
      throw err
    }
  }

  throw new Error('All Groq models unavailable for email generation')
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + Number(days || 0))
  return d
}

function fallbackEmailCopy(lead, stepType = 'initial') {
  const business = lead.business_type || 'business'
  const name = lead.name || 'there'

  if (stepType === 'follow_up_1') {
    return {
      subject: `Quick follow-up for ${name}`,
      body: `Hi ${name},\n\nFollowing up on my last message. We help ${business} teams generate qualified leads consistently with AI-assisted outreach.\n\nOpen to a short 15-minute chat this week?\n\n${OPT_OUT_LINE}\n\nBest,\nProxaly Team`,
    }
  }

  if (stepType === 'follow_up_2') {
    return {
      subject: `Last note on client growth`,
      body: `Hi ${name},\n\nLast quick note from me. If lead generation is a priority this quarter, I can show you a simple system that finds and contacts ideal prospects automatically.\n\nWould you like a short demo?\n\n${OPT_OUT_LINE}\n\nBest,\nProxaly Team`,
    }
  }

  return {
    subject: `Helping ${name} get more clients`,
    body: `Hi ${name},\n\nI noticed your ${business} business and thought this might be relevant. We built an AI system that finds ideal prospects and automates personalized outreach to book more meetings.\n\nWould you be open to a quick demo this week?\n\n${OPT_OUT_LINE}\n\nBest,\nProxaly Team`,
  }
}

function ensureOptOutLine(body) {
  const text = String(body || '').trim()
  if (!text) return OPT_OUT_LINE

  if (text.toLowerCase().includes('reply "stop"') || text.toLowerCase().includes("reply 'stop'")) {
    return text
  }

  return `${text}\n\n${OPT_OUT_LINE}`
}

async function generateEmailCopy({ lead, stepType = 'initial', painPoint = 'inconsistent lead flow' }) {
  const prompt = `Write a short cold outreach email.

Business details:
- Company/Lead name: ${lead.name || 'Unknown'}
- Industry: ${lead.business_type || 'Unknown'}
- City: ${lead.city || 'Unknown'}
- Website: ${lead.website || 'N/A'}
- Pain point: ${painPoint}
- Sequence step type: ${stepType}

Requirements:
- Keep it concise and persuasive
- Add one clear CTA
- Return EXACT JSON only:
{"subject":"...","body":"..."}`

  try {
    const content = await chatWithFallback([{ role: 'user', content: prompt }])
    const parsed = JSON.parse(content)
    return {
      subject: (parsed.subject || '').trim(),
      body: ensureOptOutLine(parsed.body),
    }
  } catch {
    return fallbackEmailCopy(lead, stepType)
  }
}

async function sendViaBrevo({ to, subject, body }) {
  const key = process.env.BREVO_API_KEY
  if (!key) throw new Error('BREVO_API_KEY not configured')

  if (typeof fetch !== 'function') {
    throw new Error('Global fetch API unavailable on this Node runtime')
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'reports@proxaly.app'
  const senderName = process.env.BREVO_SENDER_NAME || 'Proxaly'

  const safeBody = body?.includes(OPT_OUT_LINE)
    ? body
    : `${body}\n\n${OPT_OUT_LINE}`

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: `<div style="white-space:pre-wrap;font-family:Arial,sans-serif;line-height:1.5">${safeBody}</div>`,
    }),
  })

  if (!res.ok) {
    throw new Error(`Brevo send failed: ${await res.text()}`)
  }

  const payload = await res.json()
  return { ...payload, finalBody: safeBody }
}

async function getSequenceForUser(userId, sequenceId) {
  if (!sequenceId) {
    return { id: null, name: 'Default 3-step', steps: DEFAULT_SEQUENCE_STEPS }
  }

  const { data, error } = await supabaseAdmin
    .from('email_sequences')
    .select('*')
    .eq('id', sequenceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) {
    return { id: null, name: 'Default 3-step', steps: DEFAULT_SEQUENCE_STEPS }
  }

  return data
}

async function createPendingLogs({ userId, leadId, campaignId = null, sequenceId = null, startAt = new Date(), steps = DEFAULT_SEQUENCE_STEPS }) {
  const rows = steps.map((stepDef, idx) => {
    const step = Number(stepDef.step || idx + 1)
    return {
      id: uuidv4(),
      user_id: userId,
      lead_id: leadId,
      campaign_id: campaignId,
      sequence_id: sequenceId,
      step,
      status: 'pending',
      scheduled_at: addDays(startAt, Number(stepDef.delayDays || 0)).toISOString(),
    }
  })

  const { error } = await supabaseAdmin.from('email_logs').insert(rows)
  if (error) throw error
  return rows
}

async function sendSingleEmailNow({ userId, lead, campaignId = null, sequenceId = null, step = 1, stepType = 'initial', subject, body, painPoint }) {
  const copy = (subject && body)
    ? { subject, body }
    : await generateEmailCopy({ lead, stepType, painPoint })

  const provider = await sendViaBrevo({
    to: lead.email,
    subject: copy.subject,
    body: copy.body,
  })

  const providerMessageId = provider?.messageId || provider?.message_id || null
  const finalBody = provider?.finalBody || copy.body

  const { error } = await supabaseAdmin
    .from('email_logs')
    .insert({
      id: uuidv4(),
      user_id: userId,
      lead_id: lead.id,
      campaign_id: campaignId,
      sequence_id: sequenceId,
      step,
      status: 'sent',
      subject: copy.subject,
      body: finalBody,
      provider_message_id: providerMessageId,
      sent_at: new Date().toISOString(),
      scheduled_at: new Date().toISOString(),
    })

  if (error) throw error

  return { copy: { ...copy, body: finalBody }, providerMessageId }
}

async function markLogSent(logId, subject, body, providerMessageId) {
  const { error } = await supabaseAdmin
    .from('email_logs')
    .update({
      status: 'sent',
      subject,
      body,
      provider_message_id: providerMessageId,
      sent_at: new Date().toISOString(),
      error_text: null,
    })
    .eq('id', logId)

  if (error) throw error
}

async function markLogFailed(logId, currentRetryCount, errMessage) {
  const retryCount = Number(currentRetryCount || 0) + 1
  const terminal = retryCount >= 5

  const { error } = await supabaseAdmin
    .from('email_logs')
    .update({
      status: terminal ? 'failed' : 'pending',
      retry_count: retryCount,
      error_text: errMessage,
      scheduled_at: terminal ? new Date().toISOString() : addDays(new Date(), 1).toISOString(),
    })
    .eq('id', logId)

  if (error) throw error
}

async function processScheduledFollowups(limit = 100) {
  const now = new Date().toISOString()
  const { data: dueLogs, error } = await supabaseAdmin
    .from('email_logs')
    .select('id, user_id, lead_id, campaign_id, sequence_id, step, status, retry_count, scheduled_at')
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  if (!dueLogs || dueLogs.length === 0) return { processed: 0, sent: 0, failed: 0 }

  let sent = 0
  let failed = 0

  for (const log of dueLogs) {
    try {
      const { data: lead } = await supabaseAdmin
        .from('leads')
        .select('id, name, email, city, website, business_type')
        .eq('id', log.lead_id)
        .maybeSingle()

      if (!lead?.email) {
        await markLogFailed(log.id, 5, 'Lead has no email')
        failed++
        continue
      }

      const stepType = log.step === 1 ? 'initial' : log.step === 2 ? 'follow_up_1' : 'follow_up_2'
      const copy = await generateEmailCopy({ lead, stepType })
      const provider = await sendViaBrevo({ to: lead.email, subject: copy.subject, body: copy.body })
      const providerMessageId = provider?.messageId || provider?.message_id || null
      await markLogSent(log.id, copy.subject, provider?.finalBody || copy.body, providerMessageId)
      sent++
    } catch (err) {
      captureException(err, { tags: { scope: 'email_followups' } })
      await markLogFailed(log.id, log.retry_count, err.message)
      failed++
    }
  }

  return { processed: dueLogs.length, sent, failed }
}

module.exports = {
  DEFAULT_SEQUENCE_STEPS,
  generateEmailPreview: generateEmailCopy,
  getSequenceForUser,
  createPendingLogs,
  sendSingleEmailNow,
  processScheduledFollowups,
}
