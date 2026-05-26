/**
 * Production-safe rate limiter.
 *
 * Strategy:
 *  1. When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set the limiter
 *     uses Upstash Redis via their HTTP REST API — no extra npm package needed.
 *     This is shared across all serverless instances (Vercel, etc.) so limits
 *     are actually enforced under horizontal scaling.
 *  2. When those vars are absent (local dev) it falls back to an in-process
 *     fixed-window counter. This fallback is NOT suitable for production but
 *     keeps the local DX identical.
 *
 * To enable Redis limiting in production, add to your environment:
 *   UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN=AXxxxx==
 * Both values are shown in the Upstash console → database → REST API.
 */

// ─── In-memory fallback (dev only) ───────────────────────────────────────────

type Window = { count: number; resetAt: number };
const _memStore = new Map<string, Window>();

setInterval(() => {
  const now = Date.now();
  for (const [k, w] of _memStore) if (now > w.resetAt) _memStore.delete(k);
}, 5 * 60 * 1000).unref?.();

function _memCheck(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  let win = _memStore.get(key);
  if (!win || now > win.resetAt) {
    _memStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  win.count += 1;
  return win.count <= limit;
}

// ─── Upstash Redis via HTTP REST API ─────────────────────────────────────────
// Uses a fixed-window counter: INCR key + EXPIRE key windowSeconds NX
// The NX flag means EXPIRE is only applied when the key is first created,
// preserving the window boundary for subsequent increments.

async function _redisCheck(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const url   = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;

  try {
    const res = await fetch(`${url}/pipeline`, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR",   `rl:${key}`],
        ["EXPIRE", `rl:${key}`, windowSeconds, "NX"],
      ]),
    });

    if (!res.ok) {
      // Redis unavailable — fail open so users aren't locked out by infra issues.
      console.error("[rateLimit] Upstash request failed, failing open:", res.status);
      return true;
    }

    const data = await res.json() as [{ result: number }, { result: number }];
    const count = data[0]?.result ?? 1;
    return count <= limit;
  } catch (err) {
    console.error("[rateLimit] Upstash error, failing open:", err);
    return true;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns `true` when the request should proceed, `false` to block it.
 *
 * @param key      Unique limiter bucket (e.g. `"sub-ops:1.2.3.4"`)
 * @param limit    Max requests per window
 * @param windowMs Window length in milliseconds
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const hasRedis =
    Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
    Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

  if (hasRedis) {
    const windowSeconds = Math.ceil(windowMs / 1000);
    return _redisCheck(key, limit, windowSeconds);
  }
  // Dev fallback
  return _memCheck(key, limit, windowMs);
}

/**
 * Extract the most reliable available client IP.
 *
 * On Vercel the real IP is in x-real-ip (set by the load balancer and not
 * spoofable). x-forwarded-for is preserved for other proxy setups but we only
 * trust the LAST hop (rightmost entry) which is the address the load balancer
 * actually saw — not the leftmost which the client can forge.
 */
export function getClientIp(request: Request): string {
  // x-real-ip — Vercel / Nginx set this to the actual client IP
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;

  // x-forwarded-for — trust the rightmost (last added by a trusted proxy)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    const last  = parts[parts.length - 1]?.trim();
    if (last) return last;
  }

  return "unknown";
}
