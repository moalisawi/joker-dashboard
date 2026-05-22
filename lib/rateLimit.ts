/**
 * Lightweight in-process sliding-window rate limiter.
 * Suitable for a single-instance Node.js server (self-hosted or Vercel with
 * persistent instances). For multi-instance / serverless deployments, replace
 * this with @upstash/ratelimit + Redis for cross-instance coordination.
 */

type Window = { count: number; resetAt: number };

const store = new Map<string, Window>();

// Clean up expired entries every 5 minutes to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [key, win] of store) {
    if (now > win.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

/**
 * Returns `true` when the request should be allowed, `false` when it exceeds
 * the rate limit.
 *
 * @param key     Unique identifier (e.g. IP address or `"ip:route"`)
 * @param limit   Maximum requests per window
 * @param windowMs Window duration in milliseconds
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  let win = store.get(key);

  if (!win || now > win.resetAt) {
    win = { count: 1, resetAt: now + windowMs };
    store.set(key, win);
    return true;
  }

  win.count += 1;
  return win.count <= limit;
}

/** Extract the best available IP from a Request's headers. */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
