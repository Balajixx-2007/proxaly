# Phase 3: Monitoring, Resilience & Production Hardening

## Overview

Phase 3 transforms Phase 2 (in-process agent) from a working implementation into a **production-grade service** with:
- Comprehensive monitoring and alerting
- Error recovery and resilience
- Rate limiting and backpressure handling
- Circuit breakers for external dependencies
- Graceful degradation
- Performance optimization

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Monitoring Layer (Phase 3 NEW)                         │
├─────────────────────────────────────────────────────────┤
│  • Metrics collection (Prometheus)                      │
│  • Error tracking (Sentry)                              │
│  • Health checks & alerting                             │
│  • Circuit breakers for Brevo, IMAP, Supabase          │
│  • Rate limit enforcement                               │
└─────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────┐
│  Agent Service (Phase 2)                                │
├─────────────────────────────────────────────────────────┤
│  Core: queue, approvals, email, IMAP, tick loop        │
└─────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────┐
│  External Services (with fallbacks)                     │
├─────────────────────────────────────────────────────────┤
│  • Brevo API (primary), SMTP fallback                   │
│  • IMAP (optional, graceful degradation)                │
│  • Supabase (primary, with retry logic)                 │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 3 Components

### 1. Circuit Breaker Pattern

```javascript
// Wraps all external service calls
circuitBreaker.execute(async () => {
  await brevo.send(lead)
}, {
  timeout: 10000,
  failureThreshold: 5,
  successThreshold: 2,
  resetTimeout: 60000, // 1 minute
})
```

**States:**
- CLOSED: Normal operation, pass through
- OPEN: Service is down, fail fast (return cached response or skip)
- HALF_OPEN: Testing if service recovered, allow limited requests

**Benefits:**
- Prevent cascading failures
- Fast-fail instead of hanging
- Automatic recovery detection

### 2. Retry Logic with Exponential Backoff

```javascript
// Retry failed operations with increasing delays
await retry(async () => {
  await email.send(lead)
}, {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true, // 0-10% random delay to avoid thundering herd
})
```

### 3. Rate Limiting

```javascript
// Token bucket algorithm
const rateLimiter = new TokenBucket({
  capacity: 500,        // Max 500 emails per day
  refillRate: 500 / (24 * 60 * 60 * 1000),  // Per millisecond
});

// Before sending email
if (!rateLimiter.tryConsume(1)) {
  return { status: 'rate_limited', retryAfter: rateLimiter.nextTokenTime };
}
```

### 4. Health Checks & Metrics

```javascript
// Expose metrics for monitoring (Prometheus format)
router.get('/metrics', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.write('# HELP agent_ticks_total Total agent ticks\n');
  res.write(`agent_ticks_total ${metrics.tickCount}\n`);
  res.write(`agent_emails_sent_total ${metrics.emailsSent}\n`);
  res.write(`agent_errors_total ${metrics.errors}\n`);
  res.write(`agent_tick_duration_ms ${metrics.lastTickDurationMs}\n`);
  res.end();
});

// Health endpoint for Kubernetes/load balancers
router.get('/health', (req, res) => {
  const health = {
    status: agentService.getStatus(),
    dependencies: {
      database: checkDatabase(),
      email: checkEmail(),
      imap: checkImap(),
    },
    uptime: process.uptime(),
  };
  const code = health.dependencies.database ? 200 : 503;
  res.status(code).json(health);
});
```

### 5. Graceful Degradation

| Scenario | Behavior |
|----------|----------|
| Brevo down | Queue leads, retry with SMTP fallback, or skip email send |
| IMAP unreachable | Skip reply detection, but continue sending |
| Supabase slow | Use local cache, retry, or fall back to in-memory queue |
| Tick takes too long | Skip this tick, run next tick on schedule |
| Multiple failures | Alert ops, reduce tick frequency, enter "safe mode" |

### 6. Dead Letter Queue (DLQ)

```javascript
// Leads that fail repeatedly go here instead of spinning forever
schema.agent_deadletter = {
  id: UUID,
  agent_lead_id: UUID,         // Reference to the failed lead
  reason: TEXT,                // Why it failed
  attempt_count: INTEGER,      // How many times we tried
  max_attempts_exceeded_at: TIMESTAMP,
  review_status: TEXT,         // pending_review, investigated, resolved
  reviewed_by: UUID,
  reviewed_at: TIMESTAMP,
  notes: TEXT,
};

// After 3 failures: move to DLQ
if (failureCount > 3) {
  await deadLetterQueue.add(lead, failureReason);
  await queue.updateStatus(lead.id, 'dead_lettered');
}
```

---

## Implementation Details

### Circuit Breaker (Phase 3 Module)

File: `backend/services/circuitBreaker.js`

```javascript
class CircuitBreaker {
  constructor(options = {}) {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 60000;
    this.resetTimeout = options.resetTimeout || 60000;
  }

  async execute(fn, context = {}) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error(`Circuit breaker OPEN for ${context.service || 'unknown'}`);
      }
    }

    try {
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.timeout)
        ),
      ]);

      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  onSuccess() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.state = 'CLOSED';
        this.successes = 0;
      }
    }
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}
```

### Retry with Backoff (Phase 3 Module)

File: `backend/services/retryPolicy.js`

```javascript
async function retryWithBackoff(fn, options = {}) {
  const maxAttempts = options.maxAttempts || 3;
  const initialDelayMs = options.initialDelayMs || 1000;
  const maxDelayMs = options.maxDelayMs || 30000;
  const multiplier = options.backoffMultiplier || 2;
  const jitter = options.jitter !== false;

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxAttempts) break;

      let delay = initialDelayMs * Math.pow(multiplier, attempt - 1);
      delay = Math.min(delay, maxDelayMs);
      if (jitter) {
        delay += Math.random() * delay * 0.1; // 0-10% random
      }

      console.log(`[Retry] Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

### Rate Limiter (Phase 3 Module)

File: `backend/services/rateLimiter.js`

```javascript
class TokenBucket {
  constructor(options = {}) {
    this.capacity = options.capacity || 1000;
    this.tokens = this.capacity;
    this.refillRate = options.refillRate || 1; // tokens per ms
    this.lastRefillTime = Date.now();
  }

  refill() {
    const now = Date.now();
    const timePassed = now - this.lastRefillTime;
    this.tokens = Math.min(
      this.capacity,
      this.tokens + (timePassed * this.refillRate)
    );
    this.lastRefillTime = now;
  }

  tryConsume(count = 1) {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  nextTokenTime() {
    const needed = 1 - this.tokens;
    if (needed <= 0) return 0;
    return needed / this.refillRate;
  }
}
```

### Dead Letter Handling

File: `backend/agent/deadLetter.js`

```javascript
async function sendToDLQ(lead, reason, attemptCount) {
  try {
    const { error } = await supabase
      .from('agent_deadletter')
      .insert({
        agent_lead_id: lead.id,
        reason,
        attempt_count: attemptCount,
        max_attempts_exceeded_at: new Date(),
        review_status: 'pending_review',
      });

    if (error) throw error;

    await queue.updateStatus(lead.id, 'dead_lettered');

    // Alert ops
    captureMessage('lead_dead_lettered', {
      leadId: lead.id,
      email: lead.email,
      reason,
      attempts: attemptCount,
    }, 'error');

    console.log(`[DLQ] Lead ${lead.id} sent to DLQ: ${reason}`);
  } catch (err) {
    console.error('[DLQ] Failed to send to DLQ:', err);
  }
}
```

---

## Configuration (Phase 3)

Add to `backend/agent/config.js`:

```javascript
const PHASE_3_CONFIG = {
  // Circuit breakers
  circuitBreaker: {
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

  // Retry policies
  retry: {
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

  // Rate limiting
  rateLimiting: {
    dailyEmailLimit: 500,
    ticksPerHour: 120, // 2 per minute
    approvalsPerMinute: 100,
  },

  // Degradation modes
  degradation: {
    skipImapOnFailure: true,
    fallbackToSmtpOnBrevoFailure: true,
    useLocalCacheOnDatabaseSlow: true,
    maxTickDurationMs: 30000,
  },

  // Dead letter queue
  deadLetter: {
    maxAttemptsBeforeDLQ: 3,
    reviewRequiredAfterDays: 7,
  },

  // Metrics & health
  metrics: {
    enablePrometheus: true,
    metricsPort: 9090,
    healthCheckInterval: 30000,
  },
};
```

---

## Testing & Validation

### Chaos Testing

```javascript
// Simulate failures for resilience testing
async function simulateBrevoFailure() {
  // 1. Start agent with 100 leads queued
  // 2. Kill Brevo in circuit breaker
  // 3. Verify: leads go to retry queue, not lost
  // 4. Recover Brevo
  // 5. Verify: leads automatically resend
}

async function simulateSupabaseLatency() {
  // 1. Slow down Supabase responses (network throttle)
  // 2. Verify: agent uses cache, doesn't block
  // 3. Verify: tick completes in time
}

async function simulateOutOfMemory() {
  // 1. Fill heap with large queue
  // 2. Verify: graceful degradation, not crash
  // 3. Verify: auto-archive old leads
}
```

### Load Testing

```javascript
// Benchmark at target scale
async function loadTest() {
  // Create 10,000 leads in queue
  // Run agent for 24 hours simulation
  // Measure: throughput, latency, memory, CPU
  // Target: 500+ emails/day, <100ms per lead, <200MB memory
}
```

---

## Deployment Checklist (Phase 3)

- [ ] Add all Phase 3 modules (circuitBreaker.js, retryPolicy.js, rateLimiter.js, etc.)
- [ ] Run chaos tests (Brevo/IMAP/Database failures)
- [ ] Run load tests (10K leads, 24h simulation)
- [ ] Verify metrics endpoint works (Prometheus scrape)
- [ ] Set up alerting rules (CPU >80%, errors >1%, latency >5s)
- [ ] Deploy to staging first
- [ ] Monitor for 48 hours in staging
- [ ] Deploy to production with alerting ready
- [ ] Verify DLQ system works end-to-end
- [ ] Document operational runbook

---

## Success Criteria (Phase 3)

✅ Agent handles single external service failure without degrading  
✅ Agent recovers automatically when service becomes available  
✅ Zero lead losses (all leads tracked, none silently dropped)  
✅ Tick loop completes <30s even under load  
✅ Memory usage stable (no leaks) over 7 days runtime  
✅ Dead letter queue catches genuinely bad requests  
✅ Metrics exposed and alarms firing correctly  
✅ 99.9% uptime SLA achievable

---

## Production Runbook

### Troubleshooting

**Problem: High error rate on email sends**
```
1. Check circuit breaker status: GET /health
2. If Brevo CB is OPEN, Brevo API is down
3. Verify SMTP fallback is configured
4. Check rate limiter not at capacity
5. Review DLQ for patterns
```

**Problem: Approvals queue backed up**
```
1. Check tick loop frequency, verify running
2. Check Supabase latency (should be <100ms)
3. Review approvals table for performance issue
4. Verify no long-running transactions
5. Increase tick frequency temporarily
```

**Problem: Memory usage increasing**
```
1. Check for memory leaks in Email/IMAP service
2. Verify old leads are being archived
3. Check Supabase connection pool size
4. Restart agent service if necessary
```

### Monitoring Alerts

Set up alerts for:
```
agent_tick_duration_ms > 30000              → Page on-call
agent_errors_total increase > 10 in 5min    → Critical
agent_circuitbreaker_open 'brevo'           → Warning
agent_deadletter_count > 10 in 1h           → Alert
agent_memory_mb > 500                       → Warning
agent_database_latency_ms > 5000            → Critical
```

