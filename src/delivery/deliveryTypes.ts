// Shared types for the delivery pipeline. Nothing here may import React Native, so the
// upload worker and retry policy can be unit tested in plain Node.

// Durable queue states stored in SQLite. "Waiting for connection" is derived in the UI from
// `queued`/`retry_scheduled` + the connectivity hint, because offline is not a property of the report.
export type ReportStatus =
  | 'preparing' // photos are being resized/compressed on the device
  | 'queued' // saved locally, every photo ready, waiting for the worker
  | 'uploading' // claimed by the worker (lease held)
  | 'retry_scheduled' // transient failure, next attempt at `nextAttemptAt`
  | 'uploaded' // server confirmed and the confirmation was reconciled locally
  | 'needs_attention' // permanent failure, user must act (manual retry)

export type ImageStatus = 'processing' | 'ready' | 'uploaded' | 'failed'

export type ApiErrorCode =
  | 'network' // offline, connection reset, request never reached the server
  | 'timeout' // ambiguous: the request may or may not have been committed
  | 'rate_limited' // HTTP 429 equivalent (resource-exhausted)
  | 'server_unavailable' // HTTP 503 equivalent
  | 'server_error' // other transient 5xx equivalents
  | 'remote_object_missing' // an image the server should have is not there; re-upload
  | 'validation' // HTTP 400/413/422 equivalent, rejected by server rules
  | 'permission' // HTTP 401/403 equivalent: configuration/API error
  | 'image_too_large'
  | 'local_file_missing'
  | 'verification_failed' // server holds something different from what we sent
  | 'unexpected_response'
  | 'unknown'

export type DeliveryError = {
  code: ApiErrorCode
  message: string
  retryAfterMs?: number
}

export type QueuedImage = {
  imageId: string
  position: number
  localPath: string
  mimeType: string
  sizeBytes: number
  width: number
  height: number
  status: ImageStatus
  remotePath: string | null
  remoteUrl: string | null
}

export type QueuedReport = {
  clientReportId: string
  description: string
  status: ReportStatus
  createdAt: number
  expectedImageCount: number
  attemptCount: number
  consecutiveFailures: number
  nextAttemptAt: number | null
  leaseExpiresAt: number | null
  images: QueuedImage[]
}

export type ServerImage = {
  imageId: string
  path: string
  url: string
  sizeBytes: number
  mimeType: string
  width: number
  height: number
}

export type ServerReport = {
  id: string
  description: string
  imageCount: number
  images: ServerImage[]
  reportedAt: number
  createdAt: number
}

export type CreateReportPayload = {
  clientReportId: string
  description: string
  reportedAt: number
  images: ServerImage[]
}

export type RequestContext = {
  // Signals that bytes are still moving, resetting the inactivity timeout
  touch: () => void
  // Registers cleanup that cancels the underlying request when it times out or is aborted
  onCancel: (cancel: () => void) => void
}

export type UploadImageInput = {
  clientReportId: string
  imageId: string
  localPath: string
  mimeType: string
  onProgress?: (bytesSent: number, totalBytes: number) => void
}

export interface ReportApi {
  uploadImage(input: UploadImageInput, ctx: RequestContext): Promise<{ remotePath: string; url: string }>
  verifyImage(remotePath: string, ctx: RequestContext): Promise<{ sizeBytes: number; mimeType: string }>
  // Idempotent on clientReportId: returns the existing report if it was already created
  createOrResolveReport(payload: CreateReportPayload, ctx: RequestContext): Promise<ServerReport>
  listReports(ctx: RequestContext): Promise<ServerReport[]>
}

export interface ReportQueueRepository {
  // Reports eligible for an attempt at `now` (queued, due retries, and expired leases)
  listDueReports(now: number): Promise<QueuedReport[]>
  nextScheduledAttemptAt(): Promise<number | null>
  // Transactional claim: returns null if another worker holds the lease or the report is not eligible
  claimReport(clientReportId: string, now: number, leaseMs: number): Promise<QueuedReport | null>
  markImageUploaded(imageId: string, remotePath: string, remoteUrl: string, leaseExpiresAt: number): Promise<void>
  markImageNotUploaded(imageId: string): Promise<void>
  markUploaded(clientReportId: string, serverReportId: string, now: number): Promise<void>
  markRetryScheduled(clientReportId: string, error: DeliveryError, nextAttemptAt: number, now: number): Promise<void>
  markNeedsAttention(clientReportId: string, error: DeliveryError, now: number): Promise<void>
  // Deliberate manual retry: clears backoff and makes the report due immediately
  requeue(clientReportId: string | null, now: number): Promise<void>
  // Startup repair after process death: `uploading` reports go back to a retryable state
  recoverInterruptedUploads(now: number): Promise<number>
}

export type UploadProgress = {
  clientReportId: string
  imageIndex: number
  imageCount: number
  // Bytes acknowledged by the storage SDK for the current image, divided by its size
  imageFraction: number
  stage: 'uploading_image' | 'verifying' | 'finalizing'
}
