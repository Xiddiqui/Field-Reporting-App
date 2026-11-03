import { normalizeError } from '../api/apiErrors'
import type { ApiErrorCode } from '../delivery/deliveryTypes'
import { backoffDelayMs, isRetryable, MAX_DELAY_MS, MAX_RETRY_AFTER_MS, retryDelayMs } from '../delivery/retryPolicy'

describe('retry classification', () => {
  test.each<ApiErrorCode>(['network', 'timeout', 'rate_limited', 'server_unavailable', 'server_error', 'remote_object_missing'])(
    '%s is retried', code => expect(isRetryable(code)).toBe(true),
  )

  test.each<ApiErrorCode>(['validation', 'permission', 'image_too_large', 'local_file_missing', 'verification_failed', 'unexpected_response', 'unknown'])(
    '%s needs attention', code => expect(isRetryable(code)).toBe(false),
  )

  test.each([
    ['storage/unknown', 'network'],
    ['storage/retry-limit-exceeded', 'network'],
    ['firestore/unavailable', 'server_unavailable'],
    ['firestore/deadline-exceeded', 'timeout'],
    ['firestore/resource-exhausted', 'rate_limited'],
    ['firestore/permission-denied', 'permission'],
    ['storage/unauthorized', 'permission'],
    ['firestore/invalid-argument', 'validation'],
    ['storage/object-not-found', 'remote_object_missing'],
  ])('Firebase %s maps to %s', (code, expected) => {
    expect(normalizeError(Object.assign(new Error('x'), { code })).code).toBe(expected)
  })

  test('fetch-style network failures are network errors', () => {
    expect(normalizeError(new TypeError('Network request failed')).code).toBe('network')
  })

  test('unrecognised errors are not retried blindly', () => {
    expect(normalizeError(new Error('something odd')).code).toBe('unknown')
  })
})

describe('backoff', () => {
  const noJitter = () => 0.5

  test('2s, 4s, 8s, 16s, then capped at 30s', () => {
    expect([1, 2, 3, 4, 5, 6, 12].map(n => backoffDelayMs(n, noJitter))).toEqual([2000, 4000, 8000, 16000, 30000, 30000, 30000])
  })

  test('jitter stays within ±25%', () => {
    expect(backoffDelayMs(3, () => 0)).toBe(6000)
    expect(backoffDelayMs(3, () => 0.999999)).toBeLessThanOrEqual(10000)
    expect(backoffDelayMs(20, () => 0.999999)).toBeLessThanOrEqual(MAX_DELAY_MS * 1.25)
  })

  test('Retry-After is respected when longer than the backoff, up to a cap', () => {
    expect(retryDelayMs({ code: 'rate_limited', message: '', retryAfterMs: 45_000 }, 1, noJitter)).toBe(45_000)
    expect(retryDelayMs({ code: 'rate_limited', message: '', retryAfterMs: 500 }, 1, noJitter)).toBe(2_000)
    expect(retryDelayMs({ code: 'rate_limited', message: '', retryAfterMs: 60 * 60_000 }, 1, noJitter)).toBe(MAX_RETRY_AFTER_MS)
  })
})
