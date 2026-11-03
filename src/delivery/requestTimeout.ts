import { ApiError } from '../api/apiErrors'
import type { RequestContext } from './deliveryTypes'

export type RunningRequest<T> = {
  promise: Promise<T>
  // Cancels the request from outside (e.g. the device went offline)
  abort: (error: ApiError) => void
}

// Runs a request that fails with a `timeout` ApiError when it makes no progress for `idleMs`.
// Uploads call ctx.touch() on every progress event, so a slow-but-moving 2G upload survives
// while a hung one is cancelled. A timeout is ambiguous, and is retried with the same key.
export const startRequest = <T>(run: (ctx: RequestContext) => Promise<T>, idleMs: number): RunningRequest<T> => {
  const cancels: (() => void)[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  let settled = false
  let rejectRequest: (error: ApiError) => void = () => undefined

  const promise = new Promise<T>((resolve, reject) => {
    const settle = (finish: () => void) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      finish()
    }
    rejectRequest = error => settle(() => {
      cancels.forEach(cancel => {
        try {
          cancel()
        } catch {
          // The request is abandoned either way
        }
      })
      reject(error)
    })
    const arm = () => {
      if (settled) {
        return
      }
      clearTimeout(timer)
      timer = setTimeout(() => rejectRequest(new ApiError('timeout', 'The server did not respond in time.')), idleMs)
    }
    arm()
    let started: Promise<T>
    try {
      started = run({ touch: arm, onCancel: cancel => cancels.push(cancel) })
    } catch (error) {
      started = Promise.reject(error)
    }
    started.then(value => settle(() => resolve(value)), error => settle(() => reject(error)))
  })

  return { promise, abort: error => rejectRequest(error) }
}
