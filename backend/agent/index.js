/**
 * Agent Service: Main orchestrator (Phase 2)
 * 
 * Manages the complete agent lifecycle and coordinates sub-services
 */

const queue = require('./queue');
const approvals = require('./approvals');
const email = require('./email');
const imap = require('./imap');
const tick = require('./tick');
const { supabase } = require('../services/supabase');
const { captureException, captureMessage } = require('../services/monitoring');

let agentState = {
  status: 'stopped',
  startedAt: null,
  tickCount: 0,
  tickInterval: null,
  imapInterval: null,
  config: {},
};

async function initialize() {
  try {
    console.log('[Agent] Initializing Phase 2 agent services...');

    // Load config from database
    const { data: configRecords, error: configErr } = await supabase
      .from('agent_config')
      .select('key, value, value_type');

    if (configErr) throw configErr;

    agentState.config = {};
    for (const rec of configRecords || []) {
      let value = rec.value;
      if (rec.value_type === 'boolean') value = rec.value === 'true';
      else if (rec.value_type === 'number') value = parseInt(rec.value, 10);
      agentState.config[rec.key] = value;
    }

    // Initialize sub-services
    await queue.initialize();
    await approvals.initialize();
    await email.initialize();
    await imap.initialize();

    console.log('[Agent] Phase 2 agent services initialized');
    return true;
  } catch (err) {
    console.error('[Agent] Initialization failed:', err);
    captureException(err, { context: 'agent_phase2_init' });
    throw err;
  }
}

async function start() {
  try {
    if (agentState.status === 'running') {
      console.log('[Agent] Agent already running');
      return;
    }

    console.log('[Agent] Starting agent...');

    agentState.status = 'running';
    agentState.startedAt = new Date();
    agentState.tickCount = 0;

    // Start tick loop
    const interval = agentState.config.tick_interval_ms || 30000;
    agentState.tickInterval = setInterval(async () => {
      try {
        const result = await tick.tick();
        agentState.tickCount++;
        if (!result.success) {
          console.error('[Agent] Tick error:', result.error);
        }
      } catch (err) {
        console.error('[Agent] Tick failed:', err);
        captureException(err, { context: 'agent_tick_error' });
      }
    }, interval);

    // Run first tick immediately
    setTimeout(async () => {
      try {
        await tick.tick();
        agentState.tickCount++;
      } catch (err) {
        console.error('[Agent] First tick failed:', err);
      }
    }, 1000);

    // Start IMAP check (if enabled)
    if (agentState.config.imap_check_enabled) {
      const imapInterval = agentState.config.imap_check_interval_ms || 60000;
      agentState.imapInterval = setInterval(async () => {
        try {
          await imap.checkInbox();
        } catch (err) {
          console.error('[Agent] IMAP check error:', err);
        }
      }, imapInterval);
    }

    await updateConfig('agent_status', 'running');

    console.log('[Agent] Agent started');
    captureMessage('agent_started', { tickInterval: interval });
    return true;
  } catch (err) {
    console.error('[Agent] Start failed:', err);
    agentState.status = 'error';
    captureException(err, { context: 'agent_start' });
    throw err;
  }
}

async function stop() {
  try {
    if (agentState.status === 'stopped') {
      console.log('[Agent] Agent already stopped');
      return;
    }

    console.log('[Agent] Stopping agent...');

    if (agentState.tickInterval) {
      clearInterval(agentState.tickInterval);
      agentState.tickInterval = null;
    }
    if (agentState.imapInterval) {
      clearInterval(agentState.imapInterval);
      agentState.imapInterval = null;
    }

    agentState.status = 'stopped';
    await updateConfig('agent_status', 'stopped');

    console.log('[Agent] Agent stopped');
    captureMessage('agent_stopped', { tickCount: agentState.tickCount, uptime: Date.now() - agentState.startedAt });
    return true;
  } catch (err) {
    console.error('[Agent] Stop failed:', err);
    captureException(err, { context: 'agent_stop' });
  }
}

async function getStatus() {
  const pendingCount = await approvals.getCount();
  const queueStats = await queue.getStats();

  return {
    status: agentState.status,
    startedAt: agentState.startedAt,
    tickCount: agentState.tickCount,
    uptime: agentState.startedAt ? Date.now() - agentState.startedAt : null,
    pendingApprovals: pendingCount,
    queueStats,
    config: {
      approval_mode_enabled: agentState.config.approval_mode_enabled,
      tick_interval_ms: agentState.config.tick_interval_ms,
      imap_check_enabled: agentState.config.imap_check_enabled,
    },
  };
}

async function updateConfig(key, value) {
  try {
    const stringValue = String(value);
    const { error } = await supabase
      .from('agent_config')
      .update({ value: stringValue, updated_at: new Date() })
      .eq('key', key);

    if (error) throw error;
    agentState.config[key] = value;
    return true;
  } catch (err) {
    console.error(`[Agent] Update config ${key} failed:`, err);
    return false;
  }
}

async function healthCheck() {
  return {
    status: agentState.status,
    timestamp: new Date(),
    tickCount: agentState.tickCount,
    config_loaded: Object.keys(agentState.config).length > 0,
  };
}

// Sub-service exports
const services = { queue, approvals, email, imap, tick };

module.exports = { initialize, start, stop, getStatus, updateConfig, healthCheck, ...services };
