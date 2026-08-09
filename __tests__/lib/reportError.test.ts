import { reportError } from '@/lib/reportError'

describe('reportError', () => {
  let consoleSpy: jest.SpyInstance

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    delete process.env.NEXT_PUBLIC_ERROR_REPORT_URL
  })

  it('logs an Error with its name, message and stack', () => {
    const err = new TypeError('boom')
    reportError(err, { scope: 'api-route', source: 'test' })

    expect(consoleSpy).toHaveBeenCalledTimes(1)
    const payload = consoleSpy.mock.calls[0][1]
    expect(payload.name).toBe('TypeError')
    expect(payload.message).toBe('boom')
    expect(typeof payload.stack).toBe('string')
    expect(payload.scope).toBe('api-route')
    expect(payload.source).toBe('test')
  })

  it('handles a thrown string', () => {
    reportError('plain failure', { scope: 'service' })
    expect(consoleSpy.mock.calls[0][1].message).toBe('plain failure')
  })

  it('handles a non-serialisable value without throwing', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(() => reportError(circular, { scope: 'unknown' })).not.toThrow()
    expect(consoleSpy).toHaveBeenCalledTimes(1)
  })

  it('carries the digest and extra context through', () => {
    reportError(new Error('x'), {
      scope: 'react-boundary',
      digest: 'abc123',
      extra: { subscriberId: '42' },
    })
    const payload = consoleSpy.mock.calls[0][1]
    expect(payload.digest).toBe('abc123')
    expect(payload.extra).toEqual({ subscriberId: '42' })
  })

  // jsdom implements neither fetch nor sendBeacon, so the transport is stubbed
  // onto navigator for these cases.
  type BeaconNavigator = Navigator & { sendBeacon?: (url: string, data?: BodyInit) => boolean }

  function stubBeacon(impl: () => boolean) {
    const nav = navigator as BeaconNavigator
    const original = nav.sendBeacon
    nav.sendBeacon = jest.fn(impl)
    return {
      mock: nav.sendBeacon as jest.Mock,
      restore: () => { nav.sendBeacon = original },
    }
  }

  it('does not forward anywhere when no endpoint is configured', () => {
    const beacon = stubBeacon(() => true)
    reportError(new Error('x'), { scope: 'unknown' })
    expect(beacon.mock).not.toHaveBeenCalled()
    beacon.restore()
  })

  it('forwards to the configured endpoint', () => {
    process.env.NEXT_PUBLIC_ERROR_REPORT_URL = 'https://example.test/collect'
    const beacon = stubBeacon(() => true)

    reportError(new Error('x'), { scope: 'unknown' })

    expect(beacon.mock).toHaveBeenCalledTimes(1)
    expect(beacon.mock.mock.calls[0][0]).toBe('https://example.test/collect')
    beacon.restore()
  })

  it('never throws when the transport fails', () => {
    process.env.NEXT_PUBLIC_ERROR_REPORT_URL = 'https://example.test/collect'
    const beacon = stubBeacon(() => { throw new Error('network down') })

    expect(() => reportError(new Error('x'), { scope: 'unknown' })).not.toThrow()

    beacon.restore()
  })
})
