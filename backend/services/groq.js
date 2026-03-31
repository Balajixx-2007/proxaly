/**
 * Groq AI service — uses llama-3.1-8b-instant (free, fast)
 * Model updated from deprecated llama3-8b-8192
 * Provides: business summary, personalized outreach, lead score, email guess
 */

const Groq = require('groq-sdk')

// Updated model list — in order of preference (all free on Groq)
const MODELS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'gemma2-9b-it',
  'mixtral-8x7b-32768',
]

let groqClient = null

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not set. Get a free key at console.groq.com')
  if (!groqClient) groqClient = new Groq({ apiKey })
  return groqClient
}

/**
 * Try multiple models — fallback if one is deprecated
 */
async function chatWithFallback(messages, options = {}) {
  const groq = getGroqClient()
  const useJson = options.json !== false
  const { json: _, ...restOptions } = options

  for (const model of MODELS) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 600,
        ...(useJson ? { response_format: { type: 'json_object' } } : {}),
        ...restOptions,
      })
      const content = completion.choices[0]?.message?.content
      if (!content || content.trim() === '') {
        console.warn(`⚠️  Groq model "${model}" returned empty response, trying next...`)
        continue
      }
      return content
    } catch (err) {
      const msg = err.message || ''
      if (
        msg.includes('decommissioned') ||
        msg.includes('not supported') ||
        msg.includes('model output') ||
        msg.includes('empty') ||
        err.status === 400
      ) {
        console.warn(`⚠️  Groq model "${model}" error: ${msg.slice(0, 80)}, trying next...`)
        continue
      }
      throw err
    }
  }
  throw new Error('All Groq models unavailable. Check your API key at console.groq.com')
}

/**
 * Enrich a single lead with AI
 */
async function enrichLead(lead) {
  const prompt = `You are a B2B lead scoring and outreach expert. Analyze this business lead and return JSON.

Business:
- Name: ${lead.name}
- Type: ${lead.business_type || 'Unknown'}
- City: ${lead.city || lead.address || 'Unknown'}
- Phone: ${lead.phone || 'Not available'}
- Website: ${lead.website || 'Not available'}
- Rating: ${lead.rating || 'Not available'}

Respond with ONLY valid JSON (no markdown):
{
  "summary": "One concise sentence describing what this business does and their likely needs",
  "outreach_message": "A personalized, professional cold outreach message (3-4 sentences). Address them by business name. Mention a specific pain point relevant to their industry. End with a clear CTA.",
  "ai_score": <integer 1-10 based on: website presence, rating, data completeness, business attractiveness>,
  "score_reason": "Brief 1-sentence explanation of the score"
}`

  try {
    const content = await chatWithFallback([{ role: 'user', content: prompt }])
    if (!content) throw new Error('Empty response from Groq')

    const parsed = JSON.parse(content)
    return {
      summary: parsed.summary || '',
      outreach_message: parsed.outreach_message || '',
      ai_score: Math.min(10, Math.max(1, parseInt(parsed.ai_score) || 5)),
      score_reason: parsed.score_reason || '',
      // NOTE: email intentionally NOT included — only real scraped emails are used
    }
  } catch (err) {
    if (err.message.includes('JSON')) throw new Error('AI returned malformed response. Please retry.')
    throw err
  }
}

/**
 * Batch enrich multiple leads
 */
async function enrichLeadsBatch(leads) {
  const results = []
  for (const lead of leads) {
    try {
      const enriched = await enrichLead(lead)
      results.push({ id: lead.id, ...enriched, success: true })
    } catch (err) {
      results.push({ id: lead.id, success: false, error: err.message })
    }
    await new Promise(r => setTimeout(r, 300))
  }
  return results
}

/**
 * Just guess an email for a lead (lightweight, no full enrichment)
 */
async function guessEmail(lead) {
  // Derive domain from website if available
  if (lead.website) {
    try {
      const url = new URL(lead.website.startsWith('http') ? lead.website : 'https://' + lead.website)
      const domain = url.hostname.replace(/^www\./, '')
      return `info@${domain}`
    } catch (_) {}
  }

  // AI guess as last resort — must include 'json' in prompt for json_object mode
  const prompt = `Given this business info, return JSON with the most likely contact email.

Business name: ${lead.name}
Type: ${lead.business_type || 'business'}
City: ${lead.city || ''}

Return JSON: {"email": "guessed@example.com"}
Base domain on a cleaned version of the business name. Use info@, contact@, or hello@ prefix.`

  try {
    const content = await chatWithFallback([{ role: 'user', content: prompt }], { max_tokens: 80 })
    const parsed = JSON.parse(content)
    return parsed.email || null
  } catch {
    return null
  }
}

module.exports = { enrichLead, enrichLeadsBatch, guessEmail }
