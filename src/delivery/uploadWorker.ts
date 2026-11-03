import { ApiError, normalizeError } from '../api/apiErrors'
import type {
  QueuedReport,
  ReportApi,
  ReportQueueRepository,
  RequestContext,
  ServerImage,
  ServerReport,
  UploadProgress,
} from './deliveryTypes'
import { MAX_IMAGE_BYTES } from './limits'
import { startRequest, type RunningRequest } from './requestTimeout'
import { isRetryable, retryDelayMs } from './retryPolicy'

export const DEFAULT_LEASE_MS = 10 * 60_000
export const DEFAULT_REQUEST_IDLE_TIMEOUT_MS = 30_000

export type UploadWorkerOptions = {
  repository: ReportQueueRepository
  api: ReportApi
  now?: () => number
  random?: () => number
  leaseMs?: number
  requestIdleTimeoutMs?: number
  // Connectivity hint: when false the worker does not start new attempts. Never treated as proof
  // that the server is reachable; the request result decides that.
  canAttempt?: () => boolean
  deleteLocalFiles?: (paths: string[]) => Promise<void>
  onProgress?: (clientReportId: string, progress: UploadProgress | null) => void
}

export type UploadWorker = ReturnType<typeof createUploadWorker>

// The upload worker has no React or React Native dependencies: it is driven by the delivery
// service in the app and by plain Jest tests with an in-memory repository and fake API.
export const createUploadWorker = ({
  repository,
  api,
  now = Date.now,
  random = Math.random,
  leaseMs = DEFAULT_LEASE_MS,
  requestIdleTimeoutMs = DEFAULT_REQUEST_IDLE_TIMEOUT_MS,
  canAttempt = () => true,
  deleteLocalFiles = async () => undefined,
  onProgress = () => undefined,
}: UploadWorkerOptions) => {
  let current: Promise<void> | null = null
  let rerun = false
  let paused = false
  let active: RunningRequest<unknown> | null = null

  const request = async <T>(run: (ctx: RequestContext) => Promise<T>): Promise<T> => {
    const running = startRequest(run, requestIdleTimeoutMs)
    active = running as RunningRequest<unknown>
    try {
      return await running.promise
    } finally {
      if (active === running) {
        active = null
      }
    }
  }

  const checkServerReport = (report: QueuedReport, server: ServerReport) => {
    const expectedIds = report.images.map(image => image.imageId).sort()
    const serverIds = server.images.map(image => image.imageId).sort()
    const matches =
      server.id === report.clientReportId &&
      server.imageCount === report.expectedImageCount &&
      serverIds.length === expectedIds.length &&
      serverIds.every((id, index) => id === expectedIds[index]) &&
      server.images.every(image => image.sizeBytes <= MAX_IMAGE_BYTES)
    if (!matches) {
      throw new ApiError('unexpected_response', 'The server returned a report that does not match what was sent.')
    }
  }

  const deliver = async (report: QueuedReport) => {
    const id = report.clientReportId
    const images = [...report.images].sort((a, b) => a.position - b.position)
    if (images.length !== report.expectedImageCount || images.some(image => image.status === 'processing' || image.status === 'failed')) {
      throw new ApiError('local_file_missing', "This report's photos are incomplete on this device.")
    }

    const confirmed: ServerImage[] = []
    for (const [index, image] of images.entries()) {
      const progress = (stage: UploadProgress['stage'], imageFraction: number) =>
        onProgress(id, { clientReportId: id, imageIndex: index, imageCount: images.length, imageFraction, stage })

      let remotePath = image.remotePath
      let url = image.remoteUrl ?? ''
      // Images confirmed in an earlier attempt are not sent again
      if (image.status !== 'uploaded' || !remotePath) {
        progress('uploading_image', 0)
        const result = await request(ctx => api.uploadImage({
          clientReportId: id,
          imageId: image.imageId,
          localPath: image.localPath,
          mimeType: image.mimeType,
          onProgress: (sent, total) => progress('uploading_image', total > 0 ? sent / total : 0),
        }, ctx))
        remotePath = result.remotePath
        url = result.url
        await repository.markImageUploaded(image.imageId, remotePath, url, now() + leaseMs)
      }

      progress('verifying', 1)
      const verifiedPath = remotePath
      let stored: { sizeBytes: number; mimeType: string }
      try {
        stored = await request(ctx => api.verifyImage(verifiedPath, ctx))
      } catch (error) {
        const normalized = normalizeError(error)
        if (normalized.code === 'remote_object_missing') {
          await repository.markImageNotUploaded(image.imageId)
        }
        throw normalized
      }
      if (stored.sizeBytes !== image.sizeBytes || stored.sizeBytes > MAX_IMAGE_BYTES || stored.mimeType !== image.mimeType) {
        // Send it again on the next (manual) attempt instead of finalizing a bad copy
        await repository.markImageNotUploaded(image.imageId)
        throw new ApiError('verification_failed', `Photo ${index + 1} on the server does not match the file on this device.`)
      }
      confirmed.push({
        imageId: image.imageId,
        path: verifiedPath,
        url,
        sizeBytes: stored.sizeBytes,
        mimeType: stored.mimeType,
        width: image.width,
        height: image.height,
      })
    }

    onProgress(id, { clientReportId: id, imageIndex: images.length - 1, imageCount: images.length, imageFraction: 1, stage: 'finalizing' })
    // Same key on every attempt: if an earlier attempt committed but its response was lost,
    // this resolves the existing report instead of creating a second one
    const server = await request(ctx => api.createOrResolveReport({
      clientReportId: id,
      description: report.description,
      reportedAt: report.createdAt,
      images: confirmed,
    }, ctx))
    checkServerReport(report, server)

    await repository.markUploaded(id, server.id, now())
    // Only after the confirmation is durable locally
    await deleteLocalFiles(images.map(image => image.localPath).filter(Boolean)).catch(() => undefined)
  }

  const attempt = async (clientReportId: string) => {
    const claimed = await repository.claimReport(clientReportId, now(), leaseMs)
    if (!claimed) {
      return // Not eligible any more, or another worker holds the lease
    }
    try {
      await deliver(claimed)
    } catch (error) {
      const failure = normalizeError(error).toDeliveryError()
      if (isRetryable(failure.code)) {
        const delay = retryDelayMs(failure, claimed.consecutiveFailures + 1, random)
        await repository.markRetryScheduled(clientReportId, failure, now() + delay, now())
      } else {
        await repository.markNeedsAttention(clientReportId, failure, now())
      }
    } finally {
      onProgress(clientReportId, null)
    }
  }

  const drain = async () => {
    do {
      rerun = false
      if (paused || !canAttempt()) {
        return
      }
      for (const report of await repository.listDueReports(now())) {
        if (paused || !canAttempt()) {
          return
        }
        await attempt(report.clientReportId)
      }
    } while (rerun)
  }

  // Single-flight: overlapping triggers (connectivity, foreground, timers) coalesce into one run
  const run = (): Promise<void> => {
    if (current) {
      rerun = true
      return current
    }
    current = drain().finally(() => {
      current = null
    })
    return current
  }

  return {
    run,
    // Deliberate retry: resets backoff for one report (or all retryable ones) and runs now
    retryNow: async (clientReportId: string | null = null) => {
      await repository.requeue(clientReportId, now())
      return run()
    },
    // Cancels the in-flight request, e.g. when the OS reports the network interface is gone
    abortInFlight: (message = 'The connection was lost.') => active?.abort(new ApiError('network', message)),
    pause: () => {
      paused = true
    },
    resume: () => {
      paused = false
    },
    isRunning: () => current !== null,
  }
}
