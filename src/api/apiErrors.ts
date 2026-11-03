import type { ApiErrorCode, DeliveryError } from '../delivery/deliveryTypes'

export class ApiError extends Error {
  constructor(readonly code: ApiErrorCode, message: string, readonly retryAfterMs?: number) {
    super(message)
    this.name = 'ApiError'
  }

  toDeliveryError(): DeliveryError {
    return { code: this.code, message: this.message, retryAfterMs: this.retryAfterMs }
  }
}

// Firebase reports gRPC-style codes rather than HTTP statuses. Each maps onto the same classes
// the brief defines for HTTP: 408/5xx -> transient, 429 -> rate limited, 400/413/422 -> validation,
// 401/403 -> permission (a configuration error, never retried automatically).
const FIREBASE_CODES: Record<string, ApiErrorCode> = {
  // Cloud Storage
  'storage/unknown': 'network', // what the Android SDK reports for a dropped connection
  'storage/retry-limit-exceeded': 'network',
  'storage/canceled': 'network',
  'storage/object-not-found': 'remote_object_missing',
  'storage/invalid-checksum': 'server_error',
  'storage/server-file-wrong-size': 'server_error',
  'storage/quota-exceeded': 'rate_limited',
  'storage/unauthorized': 'permission',
  'storage/unauthenticated': 'permission',
  'storage/invalid-argument': 'validation',
  // Firestore
  'firestore/unavailable': 'server_unavailable',
  'firestore/deadline-exceeded': 'timeout',
  'firestore/aborted': 'server_error',
  'firestore/internal': 'server_error',
  'firestore/unknown': 'server_error',
  'firestore/cancelled': 'network',
  'firestore/resource-exhausted': 'rate_limited',
  'firestore/permission-denied': 'permission',
  'firestore/unauthenticated': 'permission',
  'firestore/invalid-argument': 'validation',
  'firestore/failed-precondition': 'validation',
  'firestore/out-of-range': 'validation',
  'firestore/not-found': 'unexpected_response',
}

const MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  network: 'Could not reach the server.',
  timeout: 'The server did not respond in time.',
  rate_limited: 'The server is busy. The upload will be retried later.',
  server_unavailable: 'The server is temporarily unavailable.',
  server_error: 'The server had a temporary problem.',
  remote_object_missing: 'A photo was missing on the server and will be sent again.',
  permission: 'The server rejected the upload (security rules). Check the Firebase rules and configuration.',
  validation: 'The server rejected this report as invalid.',
}

export const normalizeError = (error: unknown): ApiError => {
  if (error instanceof ApiError) {
    return error
  }
  const code = String((error as { code?: unknown })?.code ?? '')
  const message = error instanceof Error ? error.message : String(error)
  const mapped = FIREBASE_CODES[code]
  if (mapped) {
    return new ApiError(mapped, MESSAGES[mapped] ?? message)
  }
  if (/network request failed|network error|failed to connect|unable to resolve host/i.test(message)) {
    return new ApiError('network', MESSAGES.network as string)
  }
  return new ApiError('unknown', message || 'Unknown error')
}
