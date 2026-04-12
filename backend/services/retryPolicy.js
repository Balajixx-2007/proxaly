/**
 * Retry Policy with Exponential Backoff (Phase 3)
 * 
 * Retries failed operations with increasingly long delays,
 * with jitter to prevent thundering herd problem.
 */

async function retryWithBackoff(fn, options = {}) {
  const maxAttempts = options.maxAttempts || 3;
  const initialDelayMs = options.initialDelayMs || 1000;
  const maxDelayMs = options.maxDelayMs || 30000;
  const multiplier = options.backoffMultiplier || 2;
  const jitter = options.jitter !== false;
  const context = options.context || 'unknown';

  let lastError;
  let attempt = 0;

  for (attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxAttempts) {
        // Last attempt, don't retry
        break;
      }

      // Calculate delay
      let delay = initialDelayMs * Math.pow(multiplier, attempt - 1);
      delay = Math.min(delay, maxDelayMs);

      // Add jitter (0-10% random variation)
      if (jitter) {
        const jitterAmount = delay * 0.1 * Math.random();
        delay += jitterAmount;
      }

      console.log(
        `[Retry] ${context}: Attempt ${attempt}/${maxAttempts} failed, ` +
        `retrying in ${Math.round(delay)}ms: ${err.message}`
      );

      // Wait before next attempt
      await sleep(Math.round(delay));
    }
  }

  // All attempts failed
  const err = new Error(
    `Failed after ${maxAttempts} attempts: ${lastError.message}`
  );
  err.cause = lastError;
  err.attempts = maxAttempts;
  throw err;
}

/**
 * Retry with custom backoff function
 */
async function retryWithCustomBackoff(fn, backoffFn, maxAttempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxAttempts) break;

      const delay = backoffFn(attempt);
      console.log(`[Retry] Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms`);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Timeout wrapper
 */
async function withTimeout(fn, timeoutMs) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Timeout after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Timeout with fallback
 */
async function withTimeoutFallback(fn, fallbackFn, timeoutMs) {
  try {
    return await withTimeout(fn, timeoutMs);
  } catch (err) {
    if (err.message.includes('Timeout')) {
      console.log(`[Timeout] Executing fallback after ${timeoutMs}ms`);
      return await fallbackFn();
    }
    throw err;
  }
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Composable retries - combine multiple strategies
 */
class RetryPolicy {
  constructor(options = {}) {
    this.maxAttempts = options.maxAttempts || 3;
    this.initialDelayMs = options.initialDelayMs || 1000;
    this.maxDelayMs = options.maxDelayMs || 30000;
    this.multiplier = options.multiplier || 2;
    this.jitter = options.jitter !== false;
    this.timeout = options.timeout || null;
    this.fallback = options.fallback || null;
  }

  async execute(fn, context = {}) {
    const fnWithTimeout = this.timeout
      ? () => withTimeout(fn, this.timeout)
      : fn;

    const fnWithFallback = this.fallback
      ? () =>
          withTimeoutFallback(
            fnWithTimeout,
            this.fallback,
            this.timeout || 10000
          )
      : fnWithTimeout;

    return retryWithBackoff(fnWithFallback, {
      maxAttempts: this.maxAttempts,
      initialDelayMs: this.initialDelayMs,
      maxDelayMs: this.maxDelayMs,
      backoffMultiplier: this.multiplier,
      jitter: this.jitter,
      context: context.name || 'operation',
    });
  }
}

module.exports = {
  retryWithBackoff,
  retryWithCustomBackoff,
  withTimeout,
  withTimeoutFallback,
  sleep,
  RetryPolicy,
};
