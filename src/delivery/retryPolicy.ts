import type { ApiErrorCode, DeliveryError } from './deliveryTypes'

export const BASE_DELAY_MS = 2_000
export const MAX_DELAY_MS = 30_000
// A server-provided Retry-After is honoured, but never beyond this
export const MAX_RETRY_AFTER_MS = 5 * 60_000
const JITTER = 0.25

// Transient or ambiguous outcomes are retried with the same idempotency key. Everything else
// needs the user (or a developer) to act, so it is surfaced instead of retried forever.
const RETRYABLE: Record<ApiErrorCode, boolean> = {
  network: true,
  timeout: true,
  rate_limited: true,
  server_unavailable: true,
  server_error: true,
  remote_object_missing: true,
  validation: false,
  permission: false,
  image_too_large: false,
  local_file_missing: false,
  verification_failed: false,
  unexpected_response: false,
  unknown: false,
}

export const isRetryable = (code: ApiErrorCode) => RETRYABLE[code]

// 2s, 4s, 8s, 16s, then 30s for every further failure, each with ±25% jitter so devices that
// regain signal together do not retry in lockstep.
export const backoffDelayMs = (consecutiveFailures: number, random: () => number = Math.random) => {
  const exponent = Math.max(0, consecutiveFailures - 1)
  const base = Math.min(BASE_DELAY_MS * 2 ** exponent, MAX_DELAY_MS)
  const factor = 1 - JITTER + random() * JITTER * 2
  return Math.round(base * factor)
}

export const retryDelayMs = (error: DeliveryError, consecutiveFailures: number, random: () => number = Math.random) => {
  const backoff = backoffDelayMs(consecutiveFailures, random)
  const retryAfter = Math.min(error.retryAfterMs ?? 0, MAX_RETRY_AFTER_MS)
  return Math.max(backoff, retryAfter)
}
