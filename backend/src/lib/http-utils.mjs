// HTTP utilities for external API calls with timeout, retry, and error handling

/**
 * Fetch with timeout support
 * @param {string} url 
 * @param {RequestInit} opts 
 * @param {number} timeoutMs 
 * @returns {Promise<Response>}
 */
function timeoutFetch(url, opts = {}, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    fetch(url, { ...opts, signal: controller.signal })
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeoutId));
  });
}

/**
 * Add jitter to delay
 * @param {number} baseDelayMs 
 * @returns {number}
 */
function addJitter(baseDelayMs) {
  // Add ±25% jitter
  const jitter = (Math.random() - 0.5) * 0.5 * baseDelayMs;
  return Math.max(0, baseDelayMs + jitter);
}

/**
 * Check if error/status should be retried
 * @param {Error|Response} errorOrResponse 
 * @returns {boolean}
 */
function shouldRetry(errorOrResponse) {
  // Retry on network errors (ENET)
  if (errorOrResponse instanceof Error) {
    const msg = errorOrResponse.message.toLowerCase();
    return msg.includes('network') || 
           msg.includes('timeout') || 
           msg.includes('enet') ||
           msg.includes('connection');
  }
  
  // Retry on 5xx status codes
  if (errorOrResponse && typeof errorOrResponse.status === 'number') {
    return errorOrResponse.status >= 500 && errorOrResponse.status < 600;
  }
  
  return false;
}

/**
 * Retry function with exponential backoff and jitter
 * @param {() => Promise<Response>} fn 
 * @param {number} maxAttempts 
 * @param {number} baseDelayMs 
 * @returns {Promise<Response>}
 */
async function retryWithBackoff(fn, maxAttempts = 3, baseDelayMs = 200) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      
      // Check for 4xx - fast fail, no retry
      if (result.status >= 400 && result.status < 500) {
        return result; // Don't retry 4xx errors
      }
      
      // Check for 5xx - should retry
      if (shouldRetry(result) && attempt < maxAttempts) {
        const delay = addJitter(baseDelayMs * Math.pow(2, attempt - 1));
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Should we retry this error?
      if (shouldRetry(error) && attempt < maxAttempts) {
        const delay = addJitter(baseDelayMs * Math.pow(2, attempt - 1));
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Don't retry, throw the error
      throw error;
    }
  }
  
  throw lastError;
}

/**
 * Map HTTP status/error to meaningful API error
 * @param {Error|Response} errorOrResponse 
 * @returns {object}
 */
function mapToApiError(errorOrResponse) {
  if (errorOrResponse instanceof Error) {
    const msg = errorOrResponse.message.toLowerCase();
    if (msg.includes('timeout')) {
      return { statusCode: 504, error: 'Gateway timeout - external service too slow' };
    }
    if (msg.includes('network') || msg.includes('enet')) {
      return { statusCode: 502, error: 'Network error - external service unreachable' };
    }
    return { statusCode: 502, error: 'External service error' };
  }
  
  if (errorOrResponse && typeof errorOrResponse.status === 'number') {
    const status = errorOrResponse.status;
    if (status >= 400 && status < 500) {
      return { statusCode: 400, error: `Bad request to external service (${status})` };
    }
    if (status >= 500) {
      return { statusCode: 502, error: `External service error (${status})` };
    }
  }
  
  return { statusCode: 500, error: 'Unknown error' };
}

module.exports = {
  timeoutFetch,
  retryWithBackoff, 
  mapToApiError
};
