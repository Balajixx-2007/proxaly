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

const DEFAULT_AGENT_CONFIG = {
  agent_status: 'stopped',
  approval_mode_enabled: true,
  tick_interval_ms: 30000,
  imap_check_enabled: false,
  imap_check_interval_ms: 60000,
  email_provider: 'brevo',
};

function isMissingAgentConfigError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || (message.includes('agent_config') && (message.includes('does not exist') || message.includes('relation')));
}

function parseConfigValue(record) {
  let value = record.value;
  if (record.value_type === 'boolean') value = record.value === 'true' || record.value === '1';
  else if (record.value_type === 'number') value = parseInt(record.value, 10);
  return value;
}

async function initialize() {
  try {
    console.log('[Agent] Initializing Phase 2 agent services...');

    agentState.config = { ...DEFAULT_AGENT_CONFIG };

    // Load config from database
    const { data: configRecords, error: configErr } = await supabase
      .from('agent_config')
      .select('key, value, value_type');

    if (configErr) {
      if (!isMissingAgentConfigError(configErr)) throw configErr;
      console.warn('[Agent] agent_config table is missing, using defaults');
      captureMessage('agent_config_missing_defaults_used', { context: 'agent_phase2_init' });
    } else {
      for (const rec of configRecords || []) {
        agentState.config[rec.key] = parseConfigValue(rec);
      }
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

    if (!agentState.config) {
      agentState.config = { ...DEFAULT_AGENT_CONFIG };
    }

    if (key in DEFAULT_AGENT_CONFIG) {
      agentState.config[key] = value;
    }

    const { error } = await supabase
      .from('agent_config')
      .update({ value: stringValue, updated_at: new Date() })
      .eq('key', key);

    if (error) throw error;
    agentState.config[key] = value;
    return true;
  } catch (err) {
    console.error(`[Agent] Update config ${key} failed:`, err);

    if (isMissingAgentConfigError(err)) {
      agentState.config[key] = value;
      return true;
    }

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
