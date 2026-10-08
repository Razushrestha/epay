/**
 * Rate Limiting Middleware
 * Protects endpoints from brute force and abuse using sliding window algorithm
 */

// Store for rate limiting: Map<key, { attempts: [], blocked_until: timestamp }>
const rateLimitStore = new Map();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    // Remove old attempts
    data.attempts = data.attempts.filter(t => now - t < 60 * 60 * 1000); // Keep last hour
    
    // Remove entry if no recent attempts and not blocked
    if (data.attempts.length === 0 && (!data.blocked_until || data.blocked_until < now)) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limiter configurations
 */
export const RateLimitConfig = {
  AUTH_LOGIN: {
    window: 15 * 60 * 1000,    // 15 minutes
    maxAttempts: 5,             // 5 attempts per window
    blockDuration: 30 * 60 * 1000, // Block for 30 minutes
    message: 'Too many login attempts. Please try again in 30 minutes.'
  },
  AUTH_REGISTER: {
    window: 60 * 60 * 1000,    // 1 hour
    maxAttempts: 3,             // 3 attempts per hour
    blockDuration: 60 * 60 * 1000, // Block for 1 hour
    message: 'Too many registration attempts. Please try again later.'
  },
  AUTH_FORGOT_PASSWORD: {
    window: 60 * 60 * 1000,    // 1 hour
    maxAttempts: 3,             // 3 attempts per hour
    blockDuration: 60 * 60 * 1000, // Block for 1 hour
    message: 'Too many password reset requests. Please try again later.'
  },
  AUTH_VERIFY: {
    window: 60 * 60 * 1000,    // 1 hour
    maxAttempts: 5,             // 5 attempts per hour
    blockDuration: 30 * 60 * 1000, // Block for 30 minutes
    message: 'Too many verification attempts. Please try again later.'
  },
  AUTH_2FA: {
    window: 15 * 60 * 1000,    // 15 minutes
    maxAttempts: 5,             // 5 attempts per window
    blockDuration: 30 * 60 * 1000, // Block for 30 minutes
    message: 'Too many 2FA attempts. Please try again in 30 minutes.'
  },
  DEFAULT: {
    window: 60 * 1000,         // 1 minute
    maxAttempts: 30,            // 30 requests per minute
    blockDuration: 5 * 60 * 1000, // Block for 5 minutes
    message: 'Too many requests. Please slow down.'
  }
};

/**
 * Get client identifier (IP + User-Agent)
 */
function getClientIdentifier(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() 
           || req.headers['x-real-ip'] 
           || req.socket.remoteAddress 
           || 'unknown';
  
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  return `${ip}:${userAgent}`;
}

/**
 * Check if request should be rate limited
 */
export function checkRateLimit(req, config = RateLimitConfig.DEFAULT) {
  const identifier = getClientIdentifier(req);
  const now = Date.now();
  
  // Get or create rate limit entry
  let limitData = rateLimitStore.get(identifier);
  if (!limitData) {
    limitData = { attempts: [], blocked_until: null };
    rateLimitStore.set(identifier, limitData);
  }

  // Check if currently blocked
  if (limitData.blocked_until && limitData.blocked_until > now) {
    const remainingMs = limitData.blocked_until - now;
    const remainingMinutes = Math.ceil(remainingMs / 60000);
    
    return {
      allowed: false,
      message: `${config.message} (${remainingMinutes} minutes remaining)`,
      retryAfter: Math.ceil(remainingMs / 1000)
    };
  }

  // Remove attempts outside the time window
  limitData.attempts = limitData.attempts.filter(t => now - t < config.window);

  // Check if exceeded max attempts
  if (limitData.attempts.length >= config.maxAttempts) {
    limitData.blocked_until = now + config.blockDuration;
    
    return {
      allowed: false,
      message: config.message,
      retryAfter: Math.ceil(config.blockDuration / 1000)
    };
  }

  // Record this attempt
  limitData.attempts.push(now);

  return {
    allowed: true,
    remaining: config.maxAttempts - limitData.attempts.length
  };
}

/**
 * Express-style rate limiting middleware
 */
export function rateLimiter(config = RateLimitConfig.DEFAULT) {
  return (req, res, next) => {
    const result = checkRateLimit(req, config);
    
    if (!result.allowed) {
      res.writeHead(429, { 
        'Content-Type': 'application/json',
        'Retry-After': result.retryAfter.toString()
      });
      res.end(JSON.stringify({
        error: result.message,
        retryAfter: result.retryAfter
      }));
      return;
    }

    // Add rate limit headers
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    next();
  };
}

/**
 * Manual rate limit check for use in handlers
 */
export function rateLimit(req, config = RateLimitConfig.DEFAULT) {
  const result = checkRateLimit(req, config);
  
  if (!result.allowed) {
    return {
      status: 429,
      headers: { 
        'Retry-After': result.retryAfter.toString() 
      },
      body: {
        error: result.message,
        retryAfter: result.retryAfter
      }
    };
  }

  return null; // No rate limit hit
}

/**
 * Clear rate limit for a specific identifier (e.g., after successful login)
 */
export function clearRateLimit(req) {
  const identifier = getClientIdentifier(req);
  rateLimitStore.delete(identifier);
}

/**
 * Get current rate limit status
 */
export function getRateLimitStatus(req, config = RateLimitConfig.DEFAULT) {
  const identifier = getClientIdentifier(req);
  const limitData = rateLimitStore.get(identifier);
  const now = Date.now();

  if (!limitData) {
    return {
      attempts: 0,
      remaining: config.maxAttempts,
      blocked: false
    };
  }

  const recentAttempts = limitData.attempts.filter(t => now - t < config.window);
  const blocked = limitData.blocked_until && limitData.blocked_until > now;

  return {
    attempts: recentAttempts.length,
    remaining: Math.max(0, config.maxAttempts - recentAttempts.length),
    blocked: blocked,
    blockedUntil: blocked ? limitData.blocked_until : null
  };
}
