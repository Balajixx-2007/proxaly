const { supabaseAdmin } = require('./supabase')

const STATUS = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  SENT: 'sent',
  FAILED: 'failed',
})

function sanitizeLead(lead) {
  return {
    id: lead.id || null,
    name: lead.name || 'Unknown',
    email: lead.email || '',
    city: lead.city || '',
    address: lead.address || '',
    phone: lead.phone || '',
    website: lead.website || '',
    summary: lead.summary || '',
    outreach_message: lead.outreach_message || '',
  }
}

async function enqueueLead(lead) {
  const payload = sanitizeLead(lead)
  const { error } = await supabaseAdmin
    .from('agent_queue')
    .insert({
      user_id: lead.user_id || null,
      lead_id: payload.id,
      payload,
      retries: 0,
      status: STATUS.PENDING,
    })

  if (error) throw error
}

async function getPending(limit = 50) {
  const { data, error } = await supabaseAdmin
    .from('agent_queue')
    .select('id, lead_id, payload, retries, status, created_at')
    .eq('status', STATUS.PENDING)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return data || []
}

async function claimPending(id) {
  const { data, error } = await supabaseAdmin
    .from('agent_queue')
    .update({ status: STATUS.PROCESSING })
    .eq('id', id)
    .eq('status', STATUS.PENDING)
    .select('id, lead_id, payload, retries, status')
    .maybeSingle()

  if (error) throw error
  return data || null
}

async function markSent(id) {
  const { error } = await supabaseAdmin
    .from('agent_queue')
    .update({ status: STATUS.SENT })
    .eq('id', id)

  if (error) throw error
}

async function markFailed(id, retries, maxRetries = 5) {
  const nextRetries = Number(retries || 0) + 1
  const nextStatus = nextRetries >= maxRetries ? STATUS.FAILED : STATUS.PENDING

  const { error } = await supabaseAdmin
    .from('agent_queue')
    .update({ status: nextStatus, retries: nextRetries })
    .eq('id', id)

  if (error) throw error
}

module.exports = {
  enqueueLead,
  getPending,
  claimPending,
  markSent,
  markFailed,
}
