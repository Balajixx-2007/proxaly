// API client — talks to our Express backend
import axios from 'axios'

const BROKEN_API_URLS = new Set([
  'https://proxaly.production.up.railway.app/api',
  'https://proxaly-backend.railway.app/api',
])

const FALLBACK_PROD_API_URL = 'https://proxaly-production.up.railway.app/api'
const envApiUrl = String(import.meta.env.VITE_API_URL || '').trim()

export const API_BASE_URL = envApiUrl && !BROKEN_API_URLS.has(envApiUrl)
  ? envApiUrl
  : (import.meta.env.DEV ? '/api' : FALLBACK_PROD_API_URL)

export const APP_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '') || 'https://proxaly.vercel.app'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
})

// Attach Supabase JWT to every request
api.interceptors.request.use(async (config) => {
  try {
    const { supabase } = await import('./supabase')
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }
  } catch {
    // Allow requests to proceed unauthenticated if session lookup fails.
  }
  return config
})

// ----- Leads -----
export const leadsApi = {
  scrape: (body) => api.post('/leads/scrape', body),
  list: (params) => api.get('/leads', { params }),
  update: (id, data) => api.patch(`/leads/${id}`, data),
  delete: (id) => api.delete(`/leads/${id}`),
  bulkDelete: (ids) => api.delete('/leads/bulk-delete', { data: { ids } }),
  enrich: (id) => api.post(`/leads/${id}/enrich`),
  findEmail: (id) => api.post(`/leads/${id}/find-email`),
  bulkEnrich: (ids) => api.post('/leads/bulk-enrich', { ids }),
  export: (params) => api.get('/leads/export', { params, responseType: 'blob' }),
  // Marketing Agent integration
  sendToAgent: (leadIds) => api.post('/leads/send-to-agent', { leadIds }),
  getAgentStatus: () => api.get('/agent/status'),
}

// ----- Campaigns -----
export const campaignsApi = {
  list: () => api.get('/campaigns'),
  create: (data) => api.post('/campaigns', data),
  update: (id, data) => api.patch(`/campaigns/${id}`, data),
  delete: (id) => api.delete(`/campaigns/${id}`),
  addLead: (campaignId, leadId) => api.post(`/campaigns/${campaignId}/leads`, { leadId }),
  removeLead: (campaignId, leadId) => api.delete(`/campaigns/${campaignId}/leads/${leadId}`),
  leads: (campaignId) => api.get(`/campaigns/${campaignId}/leads`),
  campaignLeads: (campaignId) => api.get(`/campaigns/${campaignId}/leads`), // alias
}

// ----- Email Outreach -----
export const emailApi = {
  preview: (body) => api.post('/email/preview', body),
  send: (body) => api.post('/email/send', body),
  bulk: (body) => api.post('/email/bulk', body),
  schedule: (body) => api.post('/email/schedule', body),
  logs: (params) => api.get('/email/logs', { params }),
}

// ----- Marketing Agent -----
export const agentApi = {
  status: () => api.get('/agent/status'),
  start: () => api.post('/agent/start'),
  stop: () => api.post('/agent/stop'),
  approvals: () => api.get('/agent/approvals'),
  approve: (leadId) => api.post(`/agent/approvals/${leadId}/approve`),
  reject: (leadId) => api.post(`/agent/approvals/${leadId}/reject`),
}

// ----- Auth -----
export const authApi = {
  profile: () => api.get('/auth/profile'),
}

export default api
