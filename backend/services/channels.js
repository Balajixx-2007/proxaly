/**
 * Multi-Channel Outreach Service
 * - WhatsApp via Twilio (real API)
 * - LinkedIn message generation via Groq AI
 * - Auto-escalation: Email → WhatsApp → LinkedIn queue
 */

const { getClient, supabaseAdmin } = require('./supabase')
const Groq = require('groq-sdk')

// ── WhatsApp via Twilio ──────────────────────────────────────────────────────
async function sendWhatsApp(toPhone, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886' // Twilio sandbox

  if (!accountSid || !authToken) {
    throw new Error('Twilio not configured. Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to Railway env vars.')
  }

  // Normalize phone number
  let phone = toPhone.replace(/\s+/g, '').replace(/[^+\d]/g, '')
  if (!phone.startsWith('+')) phone = '+' + phone

  const twilio = require('twilio')(accountSid, authToken)

  const msg = await twilio.messages.create({
    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
    to: `whatsapp:${phone}`,
    body: message,
  })

  return { success: true, sid: msg.sid, status: msg.status }
}

// ── LinkedIn message via Groq AI ─────────────────────────────────────────────
async function generateLinkedInMessage(lead, config) {
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) {
    // Fallback template
    return buildLinkedInTemplate(lead, config)
  }

  try {
    const groq = new Groq({ apiKey: groqKey })
    const firstName = (lead.name || 'there').split(' ')[0]
    const observation = lead.observation || lead.ai_observation || ''

    const completion = await groq.chat.completions.create({
      model: 'llama3-8b-8192',
      messages: [
        {
          role: 'system',
          content: `You write short, human LinkedIn DMs for lead outreach. 
Rules:
- Max 5 sentences
- Sound like a real person, not a robot
- No emojis
- Reference something specific about their business
- End with a soft CTA (quick call or demo)
- Don't mention "AI" or "automation"`
        },
        {
          role: 'user',
          content: `Write a LinkedIn DM for this lead:
Name: ${lead.name}
Company: ${lead.company || 'their business'}
Niche: ${lead.niche || config.niche || 'local business'}
Observation: ${observation || 'looking to grow their client base'}
My offer: ${config.offer || 'help them get more clients'}
My name: ${config.fromName || 'me'}`
        }
      ],
      max_tokens: 200,
      temperature: 0.85,
    })

    return completion.choices[0]?.message?.content?.trim() || buildLinkedInTemplate(lead, config)
  } catch (err) {
    console.error('Groq LinkedIn message error:', err.message)
    return buildLinkedInTemplate(lead, config)
  }
}

function buildLinkedInTemplate(lead, config) {
  const firstName = (lead.name || 'there').split(' ')[0]
  const fromName = config.fromName || 'a fellow professional'
  const offer = config.offer || 'help you get more clients'
  const observation = lead.observation || lead.ai_observation || ''

  return `Hi ${firstName},

I came across ${lead.company || 'your business'} and ${observation ? `noticed ${observation}` : 'thought there could be a great fit'}.

I help ${config.niche || 'businesses like yours'} ${offer} — without the usual hassle.

Would a quick 15-minute call this week work? Happy to show you what we do.

${fromName}`
}

// ── Build LinkedIn search URL for a lead ────────────────────────────────────
function buildLinkedInUrl(lead) {
  // If we have a stored LinkedIn URL, use it
  if (lead.linkedin_url) return lead.linkedin_url

  // Otherwise build a search URL
  const query = [lead.name, lead.company].filter(Boolean).join(' ')
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`
}

// ── Build WhatsApp message for a lead ───────────────────────────────────────
function buildWhatsAppMessage(lead, config) {
  const firstName = (lead.name || 'there').split(' ')[0]
  const fromName = config.fromName || 'a business consultant'
  const offer = config.offer || 'grow your business'
  const demoLink = config.demoLink || ''

  return `Hi ${firstName}! 👋

This is ${fromName}. I sent you an email last week about helping ${lead.company || 'your business'} ${offer}.

Wanted to follow up here in case email got lost.

${demoLink ? `Here's a quick demo: ${demoLink}\n\n` : ''}Would love to show you what we can do. Reply with "YES" if you're interested!`
}

module.exports = {
  sendWhatsApp,
  generateLinkedInMessage,
  buildLinkedInUrl,
  buildWhatsAppMessage,
  buildLinkedInTemplate,
}
