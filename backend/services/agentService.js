/**
 * Agent Service: Core orchestrator for in-process marketing agent
 * 
 * This module manages the entire agent lifecycle:
 * - Starting and stopping the tick loop
 * - Monitoring agent health
 * - Coordinating with queue, approvals, email, and IMAP services
 * 
 * Usage:
 *   const agentService = require('./agentService');
 *   await agentService.initialize();
 *   await agentService.start();
 */

const { supabase } = require('./supabase');
const { captureException, captureMessage } = require('./monitoring');
const agentQueue = require('./agentQueue');
const agentApprovals = require('./agentApprovals');
const agentEmail = require('./agentEmail');
const agentIMAP = require('./agentIMAP');
const agentTick = require('./agentTick');

/**
 * Agent Service State
 */
let agentState = {
  status: 'stopped', // stopped, running, error
  startedAt: null,
  lastTickAt: null,
  tickCount: 0,
  tickInterval: null,
  imapInterval: null,
  config: {},
  stats: {
    totalLeadsSent: 0,
    totalApprovalsProcessed: 0,
    totalErrors: 0,
  },
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

function normalizeConfigRecord(record) {
  let value = record.value;
  if (record.value_type === 'boolean') {
    value = record.value === 'true' || record.value === '1';
  } else if (record.value_type === 'number') {
    value = parseInt(record.value, 10);
  }
  return value;
}

/**
 * Initialize agent service
 * - Load configuration from Supabase
 * - Initialize sub-services
 */
async function initialize() {
  try {
    console.log('[Agent] Initializing agent service...');

    agentState.config = { ...DEFAULT_AGENT_CONFIG };

    // Load config from database
    const configRecords = await supabase
      .from('agent_config')
      .select('*');

    if (configRecords.error) {
      if (!isMissingAgentConfigError(configRecords.error)) {
        throw new Error(`Failed to load config: ${configRecords.error.message}`);
      }

      console.warn('[Agent] agent_config table is missing, using in-memory defaults');
      captureMessage('agent_config_missing_defaults_used', { context: 'agent_initialize' });
    } else {
      for (const rec of configRecords.data || []) {
        agentState.config[rec.key] = normalizeConfigRecord(rec);
      }
    }

    console.log('[Agent] Config loaded:', agentState.config);

    // Initialize sub-services
    await agentQueue.initialize();
    await agentApprovals.initialize();
    await agentEmail.initialize();
    await agentIMAP.initialize();

    console.log('[Agent] Agent service initialized successfully');
    updateConfig('agent_status', 'initialized');
  } catch (err) {
    console.error('[Agent] Initialization failed:', err);
    captureException(err, { context: 'agent_initialize' });
    agentState.status = 'error';
    throw err;
  }
}

/**
 * Start the agent tick loop
 */
async function start() {
  try {
    if (agentState.status === 'running') {
      console.log('[Agent] Already running');
      return;
    }

    console.log('[Agent] Starting agent service...');

    agentState.status = 'running';
    agentState.startedAt = new Date();
    agentState.tickCount = 0;

    // Update database
    await updateConfig('agent_status', 'running');

    // Start main tick loop
    const interval = agentState.config.tick_interval_ms || 30000;
    agentState.tickInterval = setInterval(() => {
      agentTick.tick().catch(err => {
        console.error('[Agent] Tick error:', err);
        captureException(err, { context: 'agent_tick', tickCount: agentState.tickCount });
        agentState.stats.totalErrors++;
      });
    }, interval);

    // Run first tick immediately
    setTimeout(() => {
      agentTick.tick().catch(err => {
        console.error('[Agent] First tick error:', err);
        captureException(err, { context: 'agent_first_tick' });
      });
    }, 1000);

    // Start IMAP check loop (if enabled)
    if (agentState.config.imap_check_enabled) {
      const imapInterval = agentState.config.imap_check_interval_ms || 60000;
      agentState.imapInterval = setInterval(() => {
        agentIMAP.checkInbox().catch(err => {
          console.error('[Agent] IMAP check error:', err);
          captureException(err, { context: 'agent_imap_check' });
        });
      }, imapInterval);
    }

    console.log('[Agent] Agent service started');
    captureMessage('agent_started', { tickCount: agentState.tickCount });

  } catch (err) {
    console.error('[Agent] Start failed:', err);
    captureException(err, { context: 'agent_start' });
    agentState.status = 'error';
    throw err;
  }
}

/**
 * Stop the agent tick loop
 */
async function stop() {
  try {
    if (agentState.status === 'stopped') {
      console.log('[Agent] Already stopped');
      return;
    }

    console.log('[Agent] Stopping agent service...');

    // Clear intervals
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

    console.log('[Agent] Agent service stopped');
    captureMessage('agent_stopped', {
      uptime: agentState.startedAt ? Date.now() - agentState.startedAt : 0,
      tickCount: agentState.tickCount,
    });

  } catch (err) {
    console.error('[Agent] Stop failed:', err);
    captureException(err, { context: 'agent_stop' });
  }
}

/**
 * Get current agent status
 */
async function getStatus() {
  return {
    status: agentState.status,
    startedAt: agentState.startedAt,
    lastTickAt: agentState.lastTickAt,
    tickCount: agentState.tickCount,
    uptime: agentState.startedAt ? Date.now() - agentState.startedAt : null,
    stats: agentState.stats,
    config: {
      tick_interval_ms: agentState.config.tick_interval_ms,
      approval_mode_enabled: agentState.config.approval_mode_enabled,
      imap_check_enabled: agentState.config.imap_check_enabled,
    },
  };
}

/**
 * Update configuration value in database and memory
 */
async function updateConfig(key, value) {
  try {
    const stringValue = typeof value === 'string' ? value : String(value);

    if (!agentState.config) {
      agentState.config = { ...DEFAULT_AGENT_CONFIG };
    }

    if (key in DEFAULT_AGENT_CONFIG) {
      agentState.config[key] = value;
    }

    const result = await supabase
      .from('agent_config')
      .update({ value: stringValue, updated_at: new Date() })
      .eq('key', key);

    if (result.error) {
      throw result.error;
    }

    agentState.config[key] = value;
    return true;
  } catch (err) {
    console.error(`[Agent] Failed to update config ${key}:`, err);
    captureException(err, { context: 'agent_update_config', key });

    if (isMissingAgentConfigError(err)) {
      agentState.config[key] = value;
      return true;
    }

    return false;
  }
}

/**
 * Record tick completion
 */
async function recordTick(tickData) {
  agentState.lastTickAt = new Date();
  agentState.tickCount++;
  agentState.stats.totalLeadsSent += tickData.sentCount || 0;
  agentState.stats.totalApprovalsProcessed += tickData.approvalsProcessed || 0;

  // Log tick event
  try {
    await supabase.from('agent_logs').insert({
      event_type: 'agent_tick',
      message: `Tick #${agentState.tickCount} completed`,
      metadata: {
        tickCount: agentState.tickCount,
        sentCount: tickData.sentCount,
        approvalsProcessed: tickData.approvalsProcessed,
        durationMs: tickData.durationMs,
      },
      severity: 'debug',
    });
  } catch (err) {
    console.error('[Agent] Failed to log tick:', err);
  }
}

/**
 * Health check
 */
async function healthCheck() {
  const health = {
    agent_status: agentState.status,
    database_connected: false,
    email_provider_ready: false,
    imap_configured: false,
    timestamp: new Date(),
  };

  try {
    // Check database
    const { error: dbError } = await supabase
      .from('agent_config')
      .select('count')
      .limit(1);

    health.database_connected = !dbError || isMissingAgentConfigError(dbError);

    // Check email provider
    health.email_provider_ready = await agentEmail.isReady();

    // Check IMAP
    health.imap_configured = !!agentState.config.imap_check_enabled;

  } catch (err) {
    console.error('[Agent] Health check error:', err);
  }

  return health;
}

/**
 * Export public API
 */
module.exports = {
  initialize,
  start,
  stop,
  getStatus,
  updateConfig,
  recordTick,
  healthCheck,
  
  // Sub-service access (for advanced usage)
  queue: agentQueue,
  approvals: agentApprovals,
  email: agentEmail,
  imap: agentIMAP,
  tick: agentTick,
};
