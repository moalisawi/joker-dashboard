import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

/** jsdom provides neither fetch nor Request, so both are stubbed here. */
type FetchGlobal = { fetch?: typeof fetch }

function stubFetch(impl: () => unknown) {
  const g = globalThis as FetchGlobal
  const original = g.fetch
  const mock = jest.fn(impl)
  g.fetch = mock as unknown as typeof fetch
  return { mock, restore: () => { g.fetch = original } }
}

/** getClientIp only ever calls request.headers.get(). */
function fakeRequest(headers: Record<string, string>): Request {
  return {
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  } as unknown as Request
}

describe('rateLimit', () => {
  let counter = 0
  /** Unique bucket per test — the in-memory store is module-level state. */
  const bucket = () => `test-bucket-${counter++}`

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    jest.restoreAllMocks()
  })

  describe('in-memory counter', () => {
    it('allows requests up to the limit and blocks past it', async () => {
      const key = bucket()
      expect(await checkRateLimit(key, 3, 60_000)).toBe(true)
      expect(await checkRateLimit(key, 3, 60_000)).toBe(true)
      expect(await checkRateLimit(key, 3, 60_000)).toBe(true)
      expect(await checkRateLimit(key, 3, 60_000)).toBe(false)
    })

    it('counts each bucket separately', async () => {
      const a = bucket()
      const b = bucket()
      expect(await checkRateLimit(a, 1, 60_000)).toBe(true)
      expect(await checkRateLimit(a, 1, 60_000)).toBe(false)
      expect(await checkRateLimit(b, 1, 60_000)).toBe(true)
    })

    it('starts a fresh window once the old one expires', async () => {
      const key = bucket()
      expect(await checkRateLimit(key, 1, 1)).toBe(true)
      await new Promise((r) => setTimeout(r, 5))
      expect(await checkRateLimit(key, 1, 1)).toBe(true)
    })
  })

  describe('Redis degradation', () => {
    beforeEach(() => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test'
      process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
      jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('uses the Redis verdict when it answers', async () => {
      const f = stubFetch(() =>
        Promise.resolve({ ok: true, json: async () => [{ result: 99 }, { result: 1 }] })
      )

      expect(await checkRateLimit(bucket(), 10, 60_000)).toBe(false)
      expect(f.mock).toHaveBeenCalledTimes(1)
      f.restore()
    })

    // Regression: a failing Redis used to return true, which removed the limiter
    // from every route — including the financial ones — during an outage.
    it('falls back to the in-memory counter when Redis errors, instead of allowing everything', async () => {
      const f = stubFetch(() => Promise.reject(new Error('network down')))

      const key = bucket()
      expect(await checkRateLimit(key, 2, 60_000)).toBe(true)
      expect(await checkRateLimit(key, 2, 60_000)).toBe(true)
      expect(await checkRateLimit(key, 2, 60_000)).toBe(false)
      f.restore()
    })

    it('falls back when Redis responds with a non-OK status', async () => {
      const f = stubFetch(() => Promise.resolve({ ok: false, status: 503 }))

      const key = bucket()
      expect(await checkRateLimit(key, 1, 60_000)).toBe(true)
      expect(await checkRateLimit(key, 1, 60_000)).toBe(false)
      f.restore()
    })
  })

  describe('getClientIp', () => {
    it('prefers x-real-ip', () => {
      expect(getClientIp(fakeRequest({ 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '1.1.1.1' })))
        .toBe('9.9.9.9')
    })

    // The leftmost entry is client-supplied and forgeable; the rightmost is the
    // address the trusted proxy actually saw.
    it('takes the rightmost x-forwarded-for entry, not the spoofable leftmost', () => {
      expect(getClientIp(fakeRequest({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' })))
        .toBe('3.3.3.3')
    })

    it('returns "unknown" when no header identifies the caller', () => {
      expect(getClientIp(fakeRequest({}))).toBe('unknown')
    })
  })
})
