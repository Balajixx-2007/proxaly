// Automation API client
import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: BASE,
  timeout: 60000,
})

export const automationApi = {
  status: () => api.get('/automation/status'),
  log: () => api.get('/automation/log'),
  start: () => api.post('/automation/start'),
  stop: () => api.post('/automation/stop'),
  runNow: () => api.post('/automation/run-now'),
  updateTargets: (data) => api.put('/automation/targets', data),
}

export default automationApi;
