/**
 * Agent Routes - Phase 2
 * 
 * Routes now call the in-process agent service directly instead of
 * making HTTP calls to an external service. This is the unified approach.
 * 
 * For Phase 1 compatibility (external agent service), set USE_EXTERNAL_AGENT=true env var
 */

const express = require('express');
const axios = require('axios');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Try to use Phase 2 in-process agent if available, fallback to Phase 1 external
let agentService = null;
try {
  const phase2Agent = require('../agent');
  if (process.env.USE_EXTERNAL_AGENT !== 'true') {
    agentService = phase2Agent;
  }
} catch (err) {
  console.warn('[Routes] Phase 2 agent not available, using external service');
}

/**
 * Phase 1 Fallback: Call external agent service
 */
function getMarketingAgentUrl() {
  return process.env.MARKETING_AGENT_URL || 'http://localhost:3000';
}

async function callExternalAgent(method, path, data) {
  const base = getMarketingAgentUrl();
  const url = `${base}${path}`;

  const response = await axios({
    method,
    url,
    data,
    timeout: 8000,
    validateStatus: () => true,
    headers: { 'Content-Type': 'application/json' },
  });

  return response;
}

/**
 * GET /api/agent/status
 * Get current agent status (running/stopped, tick count, pending approvals)
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    if (agentService) {
      // Phase 2: Call in-process service
      const status = await agentService.getStatus();
      return res.json(status);
    } else {
      // Phase 1: Call external service
      const response = await callExternalAgent('get', '/api/agent/status');
      if (response.status >= 200 && response.status < 300) {
        return res.json(response.data);
      }
      return res.status(503).json({
        error: 'Agent unreachable',
        status: 'offline',
      });
    }
  } catch (err) {
    res.status(503).json({
      error: 'Failed to get agent status',
      details: err.message,
      status: 'offline',
    });
  }
});

/**
 * POST /api/agent/start
 * Start the agent tick loop
 */
router.post('/start', requireAuth, async (req, res) => {
  try {
    if (agentService) {
      const result = await agentService.start();
      return res.json({ success: result, status: 'running' });
    } else {
      const response = await callExternalAgent('post', '/api/agent/start', {});
      return res.status(response.status).json(response.data);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to start agent', details: err.message });
  }
});

/**
 * POST /api/agent/stop
 * Stop the agent tick loop
 */
router.post('/stop', requireAuth, async (req, res) => {
  try {
    if (agentService) {
      const result = await agentService.stop();
      return res.json({ success: result, status: 'stopped' });
    } else {
      const response = await callExternalAgent('post', '/api/agent/stop', {});
      return res.status(response.status).json(response.data);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop agent', details: err.message });
  }
});

/**
 * GET /api/agent/approvals
 * Get pending approvals list
 */
router.get('/approvals', requireAuth, async (req, res) => {
  try {
    if (agentService) {
      const approvals = await agentService.approvals.getPendingApprovals();
      return res.json({ approvals });
    } else {
      const response = await callExternalAgent('get', '/api/approvals');
      return res.status(response.status).json(response.data);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch approvals', details: err.message });
  }
});

/**
 * POST /api/agent/approvals/:leadId/approve
 * Approve a lead for sending
 */
router.post('/approvals/:leadId/approve', requireAuth, async (req, res) => {
  const { leadId } = req.params;

  try {
    if (agentService) {
      const result = await agentService.approvals.approve(leadId, req.user.id);
      return res.json({ success: true, approval: result });
    } else {
      const response = await callExternalAgent('post', `/api/approvals/${leadId}/approve`, {});
      return res.status(response.status).json(response.data);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve', details: err.message });
  }
});

/**
 * POST /api/agent/approvals/:leadId/reject
 * Reject a lead from sending
 */
router.post('/approvals/:leadId/reject', requireAuth, async (req, res) => {
  const { leadId } = req.params;
  const { reason } = req.body;

  try {
    if (agentService) {
      const result = await agentService.approvals.reject(leadId, req.user.id, reason);
      return res.json({ success: true, approval: result });
    } else {
      const response = await callExternalAgent('post', `/api/approvals/${leadId}/reject`, {
        reason,
      });
      return res.status(response.status).json(response.data);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject', details: err.message });
  }
});

/**
 * GET /api/agent/health
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    if (agentService) {
      const health = await agentService.healthCheck();
      return res.json(health);
    }
    res.json({ status: 'ok', mode: 'external' });
  } catch (err) {
    res.status(500).json({ error: 'Health check failed', details: err.message });
  }
});

module.exports = router;
