/**
 * Agent Routes - Phase 2
 * 
 * Routes now call the in-process agent service directly instead of
 * making HTTP calls to an external service. This is the unified approach.
 * 
 * For Phase 1 compatibility (external agent service), set USE_EXTERNAL_AGENT=true env var
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getInProcessAgent, callExternalAgent } = require('../services/agentMode');

const router = express.Router();

// Safe wrapper for in-process agent calls — returns null instead of throwing
async function safeAgentCall(fn) {
  try {
    return await fn();
  } catch (err) {
    console.warn('[Agent] Safe call failed:', err.message);
    return null;
  }
}

/**
 * GET /api/agent/status
 * Get current agent status (running/stopped, tick count, pending approvals)
 */
router.get('/status', requireAuth, async (req, res) => {
  const agentService = getInProcessAgent();
  try {
    if (agentService) {
      const status = await safeAgentCall(() => agentService.getStatus());
      if (status) {
        return res.json(status);
      }
      // Agent loaded but not initialized (tables missing) — return safe stopped state
      return res.json({
        status: 'stopped',
        running: false,
        tickCount: 0,
        pendingApprovals: 0,
        startedAt: null,
        uptime: null,
        message: 'Agent ready. Run the agent_config migration to enable full features.',
      });
    } else {
      // Phase 1: Call external service
      const response = await callExternalAgent('get', '/api/agent/status');
      if (response.status >= 200 && response.status < 300) {
        return res.json(response.data);
      }
      // External agent not configured — return stopped state (not 503)
      return res.json({
        status: 'stopped',
        running: false,
        tickCount: 0,
        pendingApprovals: 0,
        message: 'External agent not configured. Set MARKETING_AGENT_URL to enable.',
      });
    }
  } catch (err) {
    // Never return 503 for status — always return a valid response
    return res.json({
      status: 'stopped',
      running: false,
      tickCount: 0,
      pendingApprovals: 0,
    });
  }
});

/**
 * POST /api/agent/start
 * Start the agent tick loop
 */
router.post('/start', requireAuth, async (req, res) => {
  const agentService = getInProcessAgent();
  try {
    if (agentService) {
      const result = await safeAgentCall(() => agentService.start());
      return res.json({ success: !!result, status: result ? 'running' : 'stopped' });
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
  const agentService = getInProcessAgent();
  try {
    if (agentService) {
      const result = await safeAgentCall(() => agentService.stop());
      return res.json({ success: !!result, status: 'stopped' });
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
  const agentService = getInProcessAgent();
  try {
    if (agentService) {
      const approvals = await safeAgentCall(() => agentService.approvals.getPendingApprovals());
      return res.json({ approvals: approvals || [] });
    } else {
      const response = await callExternalAgent('get', '/api/approvals');
      if (response.status >= 200 && response.status < 300) {
        return res.status(response.status).json(response.data);
      }
      return res.json({ approvals: [] });
    }
  } catch (err) {
    res.json({ approvals: [] });
  }
});

/**
 * POST /api/agent/approvals/:leadId/approve
 * Approve a lead for sending
 */
router.post('/approvals/:leadId/approve', requireAuth, async (req, res) => {
  const { leadId } = req.params;
  const agentService = getInProcessAgent();

  try {
    if (agentService) {
      const result = await safeAgentCall(() => agentService.approvals.approve(leadId, req.user.id));
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
  const agentService = getInProcessAgent();

  try {
    if (agentService) {
      const result = await safeAgentCall(() => agentService.approvals.reject(leadId, req.user.id, reason));
      return res.json({ success: true, approval: result });
    } else {
      const response = await callExternalAgent('post', `/api/approvals/${leadId}/reject`, { reason });
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
  const agentService = getInProcessAgent();
  try {
    if (agentService) {
      const health = await safeAgentCall(() => agentService.healthCheck());
      return res.json(health || { status: 'ok', mode: 'in-process' });
    }
    res.json({ status: 'ok', mode: 'external' });
  } catch (err) {
    res.json({ status: 'ok', mode: 'unknown' });
  }
});

module.exports = router;
