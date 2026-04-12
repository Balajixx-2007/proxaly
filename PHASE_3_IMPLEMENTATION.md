# Phase 3: Implementation Guide & Integration

## What Was Built

### Phase 3 Service Modules

1. **Circuit Breaker** (`backend/services/circuitBreaker.js`)
   - Prevents cascading failures
   - 3 states: CLOSED (normal) → OPEN (failing fast) → HALF_OPEN (testing recovery)
   - Auto-recovery detection

2. **Retry Policy** (`backend/services/retryPolicy.js`)
   - Exponential backoff with jitter
   - Configurable attempts and delays
   - Timeout wrappers and fallbacks

3. **Rate Limiter** (`backend/services/rateLimiter.js`)
   - Token bucket algorithm
   - Multi-level hierarchical limiting
   - Distributed rate limiting (multi-instance)

### Phase 3 Database Tables

```sql
-- In agent_tables.sql migration
-- Existing tables enhanced with retry tracking
-- New dead letter queue for failed items
-- Metrics snapshots for monitoring
```

---

## Integration Steps

### 1. Update Email Service (Phase 3 Enhancement)

File: `backend/agent/email.js`

Replace the current `send()` function with Phase 3-hardened version:

```javascript
const { CircuitBreakerManager } = require('../services/circuitBreaker');
const { RetryPolicy } = require('../services/retryPolicy');
const { TokenBucket } = require('../services/rateLimiter');

const cbManager = new CircuitBreakerManager();
const brevoBreaker = cbManager.register('brevo', {
  failureThreshold: 5,
  successThreshold: 2,
  resetTimeout: 60000,
  timeout: 10000,
});

const emailRetryPolicy = new RetryPolicy({
  maxAttempts: 3,
  initialDelayMs: 2000,
  maxDelayMs: 60000,
  backoffMultiplier: 2.5,
  timeout: 10000,
});

const emailRateLimiter = new TokenBucket({
  name: 'email_daily',
  capacity: 500,
  refillRate: 500 / (24 * 60 * 60 * 1000), // Per millisecond
});

async function send(lead, emailTemplate) {
  try {
    // Check rate limit
    if (!emailRateLimiter.tryConsume(1)) {
      const waitMs = emailRateLimiter.nextTokenTime();
      const err = new Error(`Rate limited. Wait ${waitMs.toFixed(0)}ms`);
      err.code = 'RATE_LIMITED';
      throw err;
    }

    // Retry with circuit breaker
    const result = await brevoBreaker.execute(
      () =>
        emailRetryPolicy.execute(
          () => sendViaBrevo(lead, emailTemplate),
          { name: `email_${lead.email}` }
        ),
      { service: 'brevo' }
    );

    return result;
  } catch (err) {
    if (err.code === 'CB_OPEN') {
      console.log('[Email] Brevo circuit open, trying SMTP fallback');
      // Try SMTP fallback
      return sendViaSMTP(lead, emailTemplate);
    }

    throw err;
  }
}
```

### 2. Wrap IMAP Service (Phase 3 Enhancement)

File: `backend/agent/imap.js`

Enhance with circuit breaker:

```javascript
const { CircuitBreakerManager } = require('../services/circuitBreaker');

const cbManager = new CircuitBreakerManager();
const imapBreaker = cbManager.register('imap', {
  failureThreshold: 3,
  successThreshold: 1,
  resetTimeout: 120000,
  timeout: 15000,
});

async function checkInbox() {
  try {
    return await imapBreaker.execute(() => checkInboxImpl(), {
      service: 'imap',
    });
  } catch (err) {
    if (err.code === 'CB_OPEN') {
      console.log('[IMAP] Circuit breaker open, skipping reply check');
      return []; // Graceful degradation
    }
    throw err;
  }
}
```

### 3. Dead Letter Queue

Add to `backend/agent/tick.js`:

```javascript
const MAX_ATTEMPTS = 3;

async function tick() {
  // ... existing tick code ...

  for (const lead of pendingLeads) {
    try {
      // ... send email ...
    } catch (err) {
      lead.failure_attempt_count = (lead.failure_attempt_count || 0) + 1;

      if (lead.failure_attempt_count >= MAX_ATTEMPTS) {
        console.log(
          `[Tick] ${lead.email} exceeded max attempts (${MAX_ATTEMPTS}), moving to DLQ`
        );
        await supabase
          .from('agent_deadletter')
          .insert({
            agent_lead_id: lead.id,
            reason: err.message,
            attempt_count: lead.failure_attempt_count,
            max_attempts_exceeded_at: new Date(),
            review_status: 'pending_review',
          });

        await queue.updateStatus(lead.id, 'dead_lettered');
      }
    }
  }
}
```

### 4. Export Monitoring Endpoint

Add to `backend/index.js`:

```javascript
// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime(),
    agent: await agentService?.healthCheck?.(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
  };

  res.status(health.agent?.database_connected === false ? 503 : 200).json(
    health
  );
});

// Prometheus metrics endpoint
app.get('/metrics', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');

  const metrics = [
    `# HELP agent_status Current agent status (1=running, 0=stopped)`,
    `agent_status {service="proxaly"} ${agentService?.getStatus?.()?.status === 'running' ? 1 : 0}`,
    `agent_tick_count_total ${agentService?.getStatus?.()?.tickCount || 0}`,
    `agent_pending_approvals ${agentService?.getStatus?.()?.pendingApprovals || 0}`,
    `process_uptime_seconds ${process.uptime()}`,
    `process_memory_bytes ${process.memoryUsage().heapUsed}`,
  ];

  res.write(metrics.join('\n'));
  res.end();
});

// Circuit breaker status endpoint
app.get('/api/diagnostics/circuitbreakers', (req, res) => {
  const breakers = require('./services/circuitBreaker');
  const manager = new breakers.CircuitBreakerManager();
  res.json(manager.getAll());
});
```

### 5. Configuration

Create `backend/agent/config.js`:

```javascript
module.exports = {
  PHASE_1_ONLY: process.env.USE_EXTERNAL_AGENT === 'true',

  CIRCUIT_BREAKERS: {
    brevo: {
      failureThreshold: 5,
      successThreshold: 2,
      resetTimeout: 60000,
      timeout: 10000,
    },
    imap: {
      failureThreshold: 3,
      successThreshold: 1,
      resetTimeout: 120000,
      timeout: 15000,
    },
    supabase: {
      failureThreshold: 10,
      successThreshold: 3,
      resetTimeout: 30000,
      timeout: 5000,
    },
  },

  RETRY_POLICIES: {
    email: {
      maxAttempts: 3,
      initialDelayMs: 2000,
      maxDelayMs: 60000,
      backoffMultiplier: 2.5,
    },
    database: {
      maxAttempts: 5,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 1.5,
    },
  },

  RATE_LIMITS: {
    emails_per_day: 500,
    approvals_per_minute: 100,
  },

  DEAD_LETTER_QUEUE: {
    maxAttempts: 3,
    archiveAfterDays: 30,
  },
};
```

---

## Testing Phase 3

### Unit Tests

```javascript
// Test circuit breaker
describe('CircuitBreaker', () => {
  it('opens after failure threshold', async () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 2 });

    try {
      await cb.execute(() => Promise.reject(new Error('fail')));
    } catch {}
    try {
      await cb.execute(() => Promise.reject(new Error('fail')));
    } catch {}

    expect(cb.state).toBe('OPEN');
  });

  it('recovers in HALF_OPEN state', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 2,
      resetTimeout: 0, // Instant reset
    });

    // Trigger OPEN
    for (let i = 0; i < 2; i++) {
      try {
        await cb.execute(() => Promise.reject(new Error('fail')));
      } catch {}
    }

    // Wait for reset
    await new Promise(r => setTimeout(r, 10));

    // Succeed in HALF_OPEN
    const result = await cb.execute(() => Promise.resolve('success'));

    expect(result).toBe('success');
    expect(cb.state).toBe('CLOSED');
  });
});
```

### Integration Tests

```javascript
// Test end-to-end with failures
describe('Agent with Phase 3 resilience', () => {
  it('handles Brevo failure and retries', async () => {
    const lead = createTestLead();

    // Mock Brevo to fail first 2 times
    let attempts = 0;
    mock_brevo_send = async () => {
      attempts++;
      if (attempts < 3) throw new Error('Temporary failure');
      return { messageId: '123' };
    };

    // Send should succeed on 3rd attempt
    const result = await emailService.send(lead);
    expect(result.messageId).toBe('123');
    expect(attempts).toBe(3);
  });

  it('gracefully degrades when IMAP fails', async () => {
    // Remove IMAP config
    delete process.env.IMAP_USER;

    const tick = await agentService.tick();

    // Should succeed without IMAP
    expect(tick.success).toBe(true);
    expect(tick.imapError).toBeDefined();
  });

  it('moves leads to DLQ after max attempts', async () => {
    const lead = createTestLead();

    // Mock infinite failures
    mock_email_send = () =>
      Promise.reject(new Error('Permanent failure'));

    for (let i = 0; i < 5; i++) {
      await agentService.tick();
    }

    // Should be in DLQ
    const dlqLead = await supabase
      .from('agent_deadletter')
      .select()
      .eq('agent_lead_id', lead.id);

    expect(dlqLead.data.length).toBe(1);
    expect(dlqLead.data[0].attempt_count).toBe(3);
  });
});
```

---

## Deployment Checklist

- [ ] All Phase 3 modules added to `backend/services/`
- [ ] Circuit breaker integrated into email/IMAP services
- [ ] Retry logic integrated into tick loop
- [ ] Dead letter queue table created (SQL migration)
- [ ] Metrics endpoints available (/health, /metrics)
- [ ] Monitoring alerts configured (CPU, errors, latency, DLQ)
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Staging deployment successful
- [ ] Monitored for 24 hours in staging
- [ ] Production deployment with rollback ready
- [ ] Alert team on Phase 3 features enabled

---

## Success Validation

After Phase 3 deployment, verify:

✅ **Resilience**: Kill Brevo in testing, system continues (uses fallback/retry)  
✅ **Recovery**: Restore Brevo, system auto-recovers within 1-2 minutes  
✅ **Completeness**: No leads lost, all tracked in database  
✅ **Performance**: Tick completes <30s under normal load  
✅ **Monitoring**: /health endpoint reflects real status  
✅ **Alerting**: Dummy failures trigger alerts correctly  
✅ **DLQ**: Bad leads move to DLQ after max attempts  
✅ **Uptime**: 99.9% SLA achievable

---

## Next Steps

1. **Immediately**: Run unit tests, verify circuit breaker logic
2. **This week**: Deploy Phase 3 to staging, run chaos tests
3. **Next week**: Production deployment with monitoring
4. **Ongoing**: Review DLQ weekly, tune thresholds based on data

---

## Files Created/Modified in Phase 3

**New Files:**
- `backend/services/circuitBreaker.js` - Circuit breaker implementation
- `backend/services/retryPolicy.js` - Retry with backoff
- `backend/services/rateLimiter.js` - Rate limiting
- `PHASE_3_MONITORING.md` - Monitoring & resilience guide

**Modified Files:**
- `backend/agent/email.js` - Add circuit breaker + retry
- `backend/agent/imap.js` - Add circuit breaker
- `backend/agent/tick.js` - Add dead letter queue logic
- `backend/agent/index.js` - Start Phase 3 services
- `backend/index.js` - Add health/metrics endpoints
- `backend/migrations/agent_tables.sql` - Add DLQ + metrics tables

---

## Production Runbook Reference

See **PHASE_3_MONITORING.md** for:
- Troubleshooting common issues
- Alert interpretation
- Scaling guidance
- Recovery procedures

