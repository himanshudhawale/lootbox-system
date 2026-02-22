/**
 * Retry wrapper for Cosmos DB operations with exponential backoff.
 *
 * Handles:
 *   - 429 (Too Many Requests / rate-limited) — respects retryAfterMs from Cosmos
 *   - 408 (Request Timeout)
 *   - 503 (Service Unavailable)
 *   - ECONNRESET / ENOTFOUND / ETIMEDOUT network errors
 *
 * @param {Function} operation - Async function to execute
 * @param {object}   [options]
 * @param {number}   [options.maxRetries=3]      - Maximum retry attempts
 * @param {number}   [options.baseDelayMs=500]   - Base delay before first retry
 * @param {number}   [options.maxDelayMs=10000]  - Cap on delay between retries
 * @param {string}   [options.label='CosmosOp']  - Label for log messages
 * @returns {Promise<*>} Result of the operation
 */
async function withRetry(operation, options = {}) {
  const {
    maxRetries = 3,
    baseDelayMs = 500,
    maxDelayMs = 10000,
    label = 'CosmosOp',
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;

      // Don't retry on non-transient errors (e.g. 404, 409, 400)
      if (!isTransient(err)) {
        throw err;
      }

      if (attempt === maxRetries) {
        console.error(`[Retry] ${label}: All ${maxRetries} retries exhausted.`, err.message);
        throw err;
      }

      // Calculate delay — respect Cosmos 429 retryAfterMs header if present
      let delay;
      if (err.code === 429 && err.retryAfterInMs) {
        delay = err.retryAfterInMs;
      } else {
        // Exponential backoff with jitter
        delay = Math.min(baseDelayMs * Math.pow(2, attempt) + Math.random() * 200, maxDelayMs);
      }

      console.warn(
        `[Retry] ${label}: Attempt ${attempt + 1}/${maxRetries} failed (${err.code || err.message}). Retrying in ${Math.round(delay)}ms...`,
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Determine if an error is transient and worth retrying.
 */
function isTransient(err) {
  // Cosmos DB HTTP status codes
  const retryableCodes = [429, 408, 503, 449];
  if (retryableCodes.includes(err.code)) return true;

  // Network errors
  const networkErrors = ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EPIPE', 'ECONNREFUSED', 'EAI_AGAIN'];
  if (networkErrors.includes(err.code)) return true;
  if (err.cause && networkErrors.includes(err.cause.code)) return true;

  // Cosmos SDK sometimes wraps errors
  if (err.message && /request timed out|service unavailable|too many requests/i.test(err.message)) {
    return true;
  }

  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { withRetry };
