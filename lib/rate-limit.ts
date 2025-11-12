// Simple in-memory rate limiter
// For production with multiple instances, consider using Redis/Upstash

type RateLimitStore = Map<string, { count: number; resetTime: number }>

const store: RateLimitStore = new Map()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of store.entries()) {
    if (now > value.resetTime) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)

export interface RateLimitConfig {
  /**
   * Unique identifier for this rate limiter (e.g., 'login', 'api')
   */
  name: string
  /**
   * Maximum number of requests allowed in the time window
   */
  limit: number
  /**
   * Time window in seconds
   */
  windowSeconds: number
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  reset: number
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier for the requester (e.g., IP address, user ID, email)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export function rateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = `${config.name}:${identifier}`
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000

  const record = store.get(key)

  // No record or expired record - create new
  if (!record || now > record.resetTime) {
    const resetTime = now + windowMs
    store.set(key, { count: 1, resetTime })
    return {
      success: true,
      remaining: config.limit - 1,
      reset: resetTime,
    }
  }

  // Check if limit exceeded
  if (record.count >= config.limit) {
    return {
      success: false,
      remaining: 0,
      reset: record.resetTime,
    }
  }

  // Increment count
  record.count++
  store.set(key, record)

  return {
    success: true,
    remaining: config.limit - record.count,
    reset: record.resetTime,
  }
}

/**
 * Get client IP address from request headers
 */
export function getClientIp(request: Request): string {
  // Check Vercel/proxy headers first
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback to a default value
  return 'unknown'
}
