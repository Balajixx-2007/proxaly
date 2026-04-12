/**
 * Rate Limiter: Token Bucket Algorithm (Phase 3)
 * 
 * Limits throughput using token bucket model.
 * Tokens refill at a constant rate; requests consume tokens.
 */

class TokenBucket {
  constructor(options = {}) {
    this.name = options.name || 'bucket';
    this.capacity = options.capacity || 1000; // Max tokens
    this.tokens = this.capacity; // Current tokens
    this.refillRatePerMs = options.refillRate || 1; // tokens per millisecond
    this.lastRefillTime = Date.now();
  }

  /**
   * Refill tokens based on time elapsed
   */
  refill() {
    const now = Date.now();
    const timePassed = now - this.lastRefillTime;
    const tokensToAdd = timePassed * this.refillRatePerMs;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }

  /**
   * Try to consume tokens
   * @returns true if successful, false if rate limited
   */
  tryConsume(count = 1) {
    this.refill();

    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }

    return false;
  }

  /**
   * Consume tokens or wait
   */
  async consume(count = 1, maxWaitMs = -1) {
    const startTime = Date.now();

    while (!this.tryConsume(count)) {
      const elapsed = Date.now() - startTime;

      if (maxWaitMs > 0 && elapsed > maxWaitMs) {
        throw new Error(
          `Rate limit exceeded. No tokens available after ${maxWaitMs}ms`
        );
      }

      // Wait 10ms before retrying
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Time until next token available
   */
  nextTokenTime() {
    this.refill();

    if (this.tokens >= 1) {
      return 0; // Token available now
    }

    const needed = 1 - this.tokens;
    return needed / this.refillRatePerMs;
  }

  /**
   * Time to refill to capacity
   */
  timeToCapacity() {
    this.refill();

    if (this.tokens >= this.capacity) {
      return 0;
    }

    const needed = this.capacity - this.tokens;
    return needed / this.refillRatePerMs;
  }

  /**
   * Get current status
   */
  getStatus() {
    this.refill();

    return {
      name: this.name,
      capacity: this.capacity,
      tokens: this.tokens.toFixed(2),
      refillRatePerMs: this.refillRatePerMs,
      fillPercentage: ((this.tokens / this.capacity) * 100).toFixed(2),
      nextTokenTime: this.nextTokenTime().toFixed(0),
      timeToCapacity: this.timeToCapacity().toFixed(0),
    };
  }
}

/**
 * Multi-level rate limiter
 * E.g., 500 emails/day, 100/hour, 10/minute
 */
class HierarchicalRateLimiter {
  constructor(options = {}) {
    this.limiters = new Map();
    this.name = options.name || 'hierarchical';

    // Register all levels
    if (options.limits) {
      for (const [level, config] of Object.entries(options.limits)) {
        this.limiters.set(
          level,
          new TokenBucket({
            name: `${options.name}:${level}`,
            capacity: config.capacity,
            refillRate: config.capacity / (config.windowMs || 1),
          })
        );
      }
    }
  }

  tryConsume(count = 1) {
    // Must satisfy ALL levels
    for (const limiter of this.limiters.values()) {
      if (!limiter.tryConsume(count)) {
        return false;
      }
    }
    return true;
  }

  getStatus() {
    const status = { name: this.name, limiters: {} };

    for (const [level, limiter] of this.limiters) {
      status.limiters[level] = limiter.getStatus();
    }

    return status;
  }
}

/**
 * Distributed rate limiter (for multi-instance deployments)
 * Uses Supabase as coordination point
 */
class DistributedRateLimiter {
  constructor(supabase, options = {}) {
    this.supabase = supabase;
    this.name = options.name || 'distributed';
    this.capacity = options.capacity || 1000;
    this.windowSeconds = options.windowSeconds || 60;
  }

  async tryConsume(key, count = 1) {
    // Increment counter in database
    const { data, error } = await this.supabase.rpc(
      'increment_rate_limiter',
      {
        limiter_key: `${this.name}:${key}`,
        window_seconds: this.windowSeconds,
        increment_by: count,
        max_allowed: this.capacity,
      }
    );

    if (error) {
      console.error('[RateLimit] Database error:', error);
      // Fallback: allow if database error
      return true;
    }

    return data.allowed === true;
  }

  async getStatus(key) {
    const { data, error } = await this.supabase
      .from('rate_limiter_state')
      .select('*')
      .eq('key', `${this.name}:${key}`)
      .single();

    if (error) return { count: 0, capacity: this.capacity };

    return {
      count: data.count,
      capacity: this.capacity,
      windowSeconds: this.windowSeconds,
      remaining: Math.max(0, this.capacity - data.count),
    };
  }
}

module.exports = {
  TokenBucket,
  HierarchicalRateLimiter,
  DistributedRateLimiter,
};
