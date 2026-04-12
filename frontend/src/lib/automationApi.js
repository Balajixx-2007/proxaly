// Automation API client
import axios from 'axios'
import { API_BASE_URL } from './api'

const api = axios.create({
  baseURL: API_BASE_URL,
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
