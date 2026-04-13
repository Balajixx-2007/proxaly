const axios = require('axios')

function isExternalAgentMode() {
  return process.env.FORCE_EXTERNAL_AGENT === 'true' && !!getMarketingAgentUrl()
}

function loadInProcessAgent() {
  try {
    return require('../agent')
  } catch (phase2Err) {
    try {
      return require('../services/agentService')
    } catch (phase2ServiceErr) {
      console.error('[AgentMode] Failed to load in-process agent implementations')
      console.error(phase2Err)
      console.error(phase2ServiceErr)
      return null
    }
  }
}

function getInProcessAgent() {
  if (isExternalAgentMode()) return null
  return loadInProcessAgent()
}

function getMarketingAgentUrl() {
  const configured = process.env.MARKETING_AGENT_URL
  if (!configured || !configured.trim()) return null
  return configured.trim().replace(/\/$/, '')
}

async function callExternalAgent(method, path, data, timeout = 8000) {
  const base = getMarketingAgentUrl()
  if (!base) {
    return {
      status: 503,
      data: {
        error: 'Agent service not configured',
        status: 'misconfigured',
      },
    }
  }

  const url = `${base}${path}`

  return axios({
    method,
    url,
    data,
    timeout,
    validateStatus: () => true,
    headers: { 'Content-Type': 'application/json' },
  })
}

module.exports = {
  isExternalAgentMode,
  getInProcessAgent,
  getMarketingAgentUrl,
  callExternalAgent,
}
