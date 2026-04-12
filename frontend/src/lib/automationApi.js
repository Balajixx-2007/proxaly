// Automation API client (reuses shared authenticated API instance)
import api from './api'

export const automationApi = {
  status: () => api.get('/automation/status'),
  log: () => api.get('/automation/log'),
  start: () => api.post('/automation/start'),
  stop: () => api.post('/automation/stop'),
  runNow: () => api.post('/automation/run-now'),
  updateTargets: (data) => api.put('/automation/targets', data),
}

export default automationApi;
