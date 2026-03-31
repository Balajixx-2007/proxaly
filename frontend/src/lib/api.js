// API client — talks to our Express backend
import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: BASE,
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
  } catch (_) {}
  return config
})

// ----- Leads -----
export const leadsApi = {
  scrape: (body) => api.post('/leads/scrape', body),
  list: (params) => api.get('/leads', { params }),
  update: (id, data) => api.patch(`/leads/${id}`, data),
  delete: (id) => api.delete(`/leads/${id}`),
  enrich: (id) => api.post(`/leads/${id}/enrich`),
  findEmail: (id) => api.post(`/leads/${id}/find-email`),
  bulkEnrich: (ids) => api.post('/leads/bulk-enrich', { ids }),
  export: (params) => api.get('/leads/export', { params, responseType: 'blob' }),
}

// ----- Campaigns -----
export const campaignsApi = {
  list: () => api.get('/campaigns'),
  create: (data) => api.post('/campaigns', data),
  update: (id, data) => api.patch(`/campaigns/${id}`, data),
  delete: (id) => api.delete(`/campaigns/${id}`),
  addLead: (campaignId, leadId) => api.post(`/campaigns/${campaignId}/leads`, { leadId }),
  removeLead: (campaignId, leadId) => api.delete(`/campaigns/${campaignId}/leads/${leadId}`),
}

// ----- Auth -----
export const authApi = {
  profile: () => api.get('/auth/profile'),
}

export default api
