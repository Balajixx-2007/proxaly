const LEAD_STATUS = Object.freeze({
  NEW: 'new',
  CONTACTED: 'contacted',
  REPLIED: 'replied',
  MEETING_BOOKED: 'meeting_booked',
  CLIENT: 'client',
  CONVERTED: 'converted',
})

const STATUS_ALIASES = Object.freeze({
  new: LEAD_STATUS.NEW,
  contacted: LEAD_STATUS.CONTACTED,
  replied: LEAD_STATUS.REPLIED,
  meeting_booked: LEAD_STATUS.MEETING_BOOKED,
  client: LEAD_STATUS.CLIENT,
  converted: LEAD_STATUS.CONVERTED,
  'meeting booked': LEAD_STATUS.MEETING_BOOKED,
})

function normalizeLeadStatus(value, fallback = LEAD_STATUS.NEW) {
  if (typeof value !== 'string' || !value.trim()) return fallback
  const key = value.trim().toLowerCase().replace(/[-\s]+/g, '_')
  return STATUS_ALIASES[key] || fallback
}

function statusIn(value, allowedStatuses) {
  const normalized = normalizeLeadStatus(value, '')
  return allowedStatuses.includes(normalized)
}

function getLeadScore(lead) {
  if (!lead || typeof lead !== 'object') return 0
  const raw = lead.ai_score ?? lead.score ?? 0
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

module.exports = {
  LEAD_STATUS,
  normalizeLeadStatus,
  statusIn,
  getLeadScore,
}