import type { ImageStatus, ReportStatus, UploadProgress } from '../../delivery/deliveryTypes'

export type StatusTone = 'neutral' | 'progress' | 'warning' | 'error' | 'success'

export type OutboxStatusInput = {
  status: ReportStatus
  imageStatuses: ImageStatus[]
  lastErrorMessage: string | null
  nextAttemptAt: number | null
  serverReportId: string | null
}

export type OutboxStatus = {
  label: string
  detail: string
  tone: StatusTone
  // Fraction for the progress bar, or null to hide it
  progress: number | null
  canRetry: boolean
}

const seconds = (ms: number) => Math.max(0, Math.ceil(ms / 1000))

// Honest, user-facing wording for each durable state. Upload progress describes bytes handed to
// the storage SDK ("sending"); a report only reads "Uploaded" once the server confirmed it.
export const describeOutboxStatus = (
  input: OutboxStatusInput,
  isOnline: boolean,
  progress: UploadProgress | undefined,
  now: number,
): OutboxStatus => {
  const error = input.lastErrorMessage ?? ''
  switch (input.status) {
    case 'preparing': {
      const ready = input.imageStatuses.filter(status => status === 'ready').length
      return {
        label: 'Preparing photos',
        detail: `Saved on this device · ${ready} of ${input.imageStatuses.length} photos ready`,
        tone: 'progress',
        progress: input.imageStatuses.length ? ready / input.imageStatuses.length : 0,
        canRetry: false,
      }
    }
    case 'queued':
      return isOnline
        ? { label: 'Saved locally', detail: 'Saved on this device · waiting to upload', tone: 'neutral', progress: null, canRetry: false }
        : { label: 'Waiting for connection', detail: 'Saved on this device · will upload when online', tone: 'warning', progress: null, canRetry: false }
    case 'uploading': {
      if (!progress) {
        return { label: 'Uploading', detail: 'Connecting to the server…', tone: 'progress', progress: 0, canRetry: false }
      }
      const photo = `photo ${progress.imageIndex + 1} of ${progress.imageCount}`
      const overall = (progress.imageIndex + (progress.stage === 'uploading_image' ? progress.imageFraction : 1)) / progress.imageCount
      const detail =
        progress.stage === 'uploading_image'
          ? `Sending ${photo} · ${Math.round(progress.imageFraction * 100)}%`
          : progress.stage === 'verifying'
            ? `Checking ${photo} on the server`
            : 'Waiting for the server to confirm the report'
      // Never shows a full bar before the server has confirmed
      return { label: 'Uploading', detail, tone: 'progress', progress: Math.min(overall, 0.95), canRetry: false }
    }
    case 'retry_scheduled': {
      if (!isOnline) {
        return { label: 'Waiting for connection', detail: error || 'Will retry when online', tone: 'warning', progress: null, canRetry: true }
      }
      const wait = input.nextAttemptAt === null ? 0 : seconds(input.nextAttemptAt - now)
      return {
        label: 'Retry scheduled',
        detail: `${error ? `${error} · ` : ''}${wait > 0 ? `next try in ${wait}s` : 'retrying now'}`,
        tone: 'warning',
        progress: null,
        canRetry: true,
      }
    }
    case 'uploaded':
      return { label: 'Uploaded', detail: `Confirmed by the server · ID ${input.serverReportId ?? '—'}`, tone: 'success', progress: null, canRetry: false }
    case 'needs_attention':
      return { label: 'Needs attention', detail: error || 'The upload failed.', tone: 'error', progress: null, canRetry: true }
  }
}
