import type { ReportApi } from '../delivery/deliveryTypes'
import { ApiError } from './apiErrors'

// DEVELOPMENT ONLY. Wraps the real API to inject the failures the brief asks to demonstrate.
// It is only wired up when __DEV__ is true, and defaults to 'off'.
export type FailureMode =
  | 'off'
  | 'latency' // delay, then perform the real request
  | 'drop_before_request' // connection drops before the request reaches the server
  | 'drop_after_commit' // server commits, the response is lost on the way back
  | 'validation_error' // HTTP 422 equivalent
  | 'server_error' // HTTP 503 equivalent
  | 'hang' // never responds; the client timeout has to fire
  | 'refused' // server unreachable / connection refused

export type FailureTarget = 'any' | 'uploadImage' | 'createOrResolveReport' | 'listReports'

export type FailureConfig = {
  mode: FailureMode
  target: FailureTarget
  // How many matching requests to affect; null = every request until turned off
  remaining: number | null
  latencyMs: number
}

export const FAILURE_MODES: { mode: FailureMode; label: string }[] = [
  { mode: 'off', label: 'Off' },
  { mode: 'latency', label: 'Added latency' },
  { mode: 'drop_before_request', label: 'Drop before request' },
  { mode: 'drop_after_commit', label: 'Commit, then lose response' },
  { mode: 'validation_error', label: 'Validation error (422)' },
  { mode: 'server_error', label: 'Server error (503)' },
  { mode: 'hang', label: 'Hang until timeout' },
  { mode: 'refused', label: 'Connection refused' },
]

let config: FailureConfig = { mode: 'off', target: 'any', remaining: null, latencyMs: 3000 }
const listeners = new Set<() => void>()

export const getFailureConfig = () => config
export const setFailureConfig = (next: Partial<FailureConfig>) => {
  config = { ...config, ...next }
  listeners.forEach(listener => listener())
}
export const subscribeFailureConfig = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// Returns the mode to apply to this request and consumes one use of it
const take = (operation: keyof ReportApi, current: () => FailureConfig, update: (next: Partial<FailureConfig>) => void) => {
  const active = current()
  if (active.mode === 'off' || active.remaining === 0 || (active.target !== 'any' && active.target !== operation)) {
    return null
  }
  if (active.remaining !== null) {
    const remaining = active.remaining - 1
    update(remaining === 0 ? { remaining, mode: 'off' } : { remaining })
  }
  return active
}

export const withFailureSimulation = (
  api: ReportApi,
  current: () => FailureConfig = getFailureConfig,
  update: (next: Partial<FailureConfig>) => void = setFailureConfig,
): ReportApi => {
  const wrap = <A extends unknown[], R>(operation: keyof ReportApi, real: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      const active = take(operation, current, update)
      switch (active?.mode) {
        case 'latency':
          await delay(active.latencyMs)
          return real(...args)
        case 'drop_before_request':
          throw new ApiError('network', 'Simulated: connection dropped before the request reached the server.')
        case 'drop_after_commit':
          await real(...args)
          throw new ApiError('network', 'Simulated: the server committed but the response was lost.')
        case 'validation_error':
          throw new ApiError('validation', 'Simulated: the server rejected the request (HTTP 422).')
        case 'server_error':
          throw new ApiError('server_unavailable', 'Simulated: HTTP 503 Service Unavailable.')
        case 'hang':
          return new Promise<R>(() => undefined)
        case 'refused':
          throw new ApiError('network', 'Simulated: connection refused.')
        default:
          return real(...args)
      }
    }

  return {
    uploadImage: wrap('uploadImage', api.uploadImage),
    verifyImage: wrap('verifyImage', api.verifyImage),
    createOrResolveReport: wrap('createOrResolveReport', api.createOrResolveReport),
    listReports: wrap('listReports', api.listReports),
  }
}
