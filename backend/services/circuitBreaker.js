/**
 * Circuit Breaker Pattern Implementation (Phase 3)
 * 
 * Prevents cascading failures by failing fast when external services are down.
 * States: CLOSED → HALF_OPEN → CLOSED (recovered) or OPEN → HALF_OPEN (recovered)
 */

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.state = 'CLOSED';
    
    // Thresholds
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 10000;
    this.resetTimeout = options.resetTimeout || 60000;
    
    // Counters
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastStateChangeTime = Date.now();
    
    // Stats
    this.totalAttempts = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
  }

  async execute(fn, context = {}) {
    this.totalAttempts++;

    // Check if we should reset from OPEN to HALF_OPEN
    if (this.state === 'OPEN') {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure > this.resetTimeout) {
        console.log(`[CB:${this.name}] Reset timeout reached, trying HALF_OPEN`);
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        const err = new Error(`Circuit breaker OPEN for ${this.name}`);
        err.code = 'CB_OPEN';
        throw err;
      }
    }

    try {
      // Execute with timeout
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout after ${this.timeout}ms`)),
            this.timeout
          )
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
    this.failureCount = 0;
    this.totalSuccesses++;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        console.log(`[CB:${this.name}] Recovered! Closing circuit.`);
        this.state = 'CLOSED';
        this.successCount = 0;
        this.lastStateChangeTime = Date.now();
      }
    }
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.totalFailures++;

    if (this.state === 'HALF_OPEN') {
      console.log(`[CB:${this.name}] Failed during HALF_OPEN, reopening circuit`);
      this.state = 'OPEN';
      this.successCount = 0;
      this.lastStateChangeTime = Date.now();
    } else if (this.failureCount >= this.failureThreshold) {
      console.log(`[CB:${this.name}] Failure threshold reached (${this.failureCount}), opening circuit`);
      this.state = 'OPEN';
      this.lastStateChangeTime = Date.now();
    }
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalAttempts: this.totalAttempts,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      successRate: this.totalAttempts > 0 ? (this.totalSuccesses / this.totalAttempts * 100).toFixed(2) : 0,
      lastFailureTime: this.lastFailureTime,
      timeSinceStateChange: Date.now() - this.lastStateChangeTime,
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    console.log(`[CB:${this.name}] Manually reset`);
  }
}

/**
 * Circuit Breaker Manager: Factory for creating and managing multiple breakers
 */
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
  }

  register(name, options) {
    const breaker = new CircuitBreaker(name, options);
    this.breakers.set(name, breaker);
    return breaker;
  }

  get(name) {
    return this.breakers.get(name);
  }

  getAll() {
    return Array.from(this.breakers.entries()).map(([name, breaker]) => ({
      name,
      ...breaker.getStatus(),
    }));
  }

  resetAll() {
    this.breakers.forEach(breaker => breaker.reset());
  }
}

module.exports = { CircuitBreaker, CircuitBreakerManager };
