import { ApiError } from '../api/apiErrors'
import type {
  QueuedImage,
  QueuedReport,
  ReportApi,
  ReportQueueRepository,
  ServerReport,
} from '../delivery/deliveryTypes'
import { MAX_IMAGE_BYTES, remoteImagePath } from '../delivery/limits'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

// Same state machine as src/data/reportRepository.ts, held in memory
export class InMemoryRepository implements ReportQueueRepository {
  reports = new Map<string, QueuedReport>()

  add(report: QueuedReport) {
    this.reports.set(report.clientReportId, clone(report))
  }

  get(id: string) {
    return clone(this.reports.get(id) as QueuedReport)
  }

  private isClaimable(report: QueuedReport, now: number) {
    return report.status === 'queued' ||
      (report.status === 'retry_scheduled' && (report.nextAttemptAt ?? 0) <= now) ||
      (report.status === 'uploading' && (report.leaseExpiresAt ?? 0) < now)
  }

  private findImage(imageId: string) {
    for (const report of this.reports.values()) {
      const image = report.images.find(candidate => candidate.imageId === imageId)
      if (image) {
        return { report, image }
      }
    }
    return null
  }

  async listDueReports(now: number) {
    return [...this.reports.values()]
      .filter(report => this.isClaimable(report, now))
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(clone)
  }

  async nextScheduledAttemptAt() {
    const times = [...this.reports.values()].filter(r => r.status === 'retry_scheduled').map(r => r.nextAttemptAt ?? 0)
    return times.length ? Math.min(...times) : null
  }

  async claimReport(id: string, now: number, leaseMs: number) {
    const report = this.reports.get(id)
    if (!report || !this.isClaimable(report, now)) {
      return null
    }
    report.status = 'uploading'
    report.leaseExpiresAt = now + leaseMs
    report.attemptCount += 1
    return clone(report)
  }

  async markImageUploaded(imageId: string, remotePath: string, remoteUrl: string, leaseExpiresAt: number) {
    const found = this.findImage(imageId)
    if (found) {
      Object.assign(found.image, { status: 'uploaded', remotePath, remoteUrl })
      found.report.leaseExpiresAt = leaseExpiresAt
    }
  }

  async markImageNotUploaded(imageId: string) {
    const found = this.findImage(imageId)
    if (found) {
      Object.assign(found.image, { status: 'ready', remotePath: null, remoteUrl: null })
    }
  }

  async markUploaded(id: string) {
    const report = this.reports.get(id) as QueuedReport
    Object.assign(report, { status: 'uploaded', leaseExpiresAt: null, nextAttemptAt: null, consecutiveFailures: 0 })
    report.images.forEach(image => {
      image.status = 'uploaded'
    })
  }

  lastError = new Map<string, string>()

  async markRetryScheduled(id: string, error: { code: string }, nextAttemptAt: number) {
    const report = this.reports.get(id) as QueuedReport
    Object.assign(report, { status: 'retry_scheduled', nextAttemptAt, leaseExpiresAt: null })
    report.consecutiveFailures += 1
    this.lastError.set(id, error.code)
  }

  async markNeedsAttention(id: string, error: { code: string }) {
    const report = this.reports.get(id) as QueuedReport
    Object.assign(report, { status: 'needs_attention', nextAttemptAt: null, leaseExpiresAt: null })
    report.consecutiveFailures += 1
    this.lastError.set(id, error.code)
  }

  async requeue(id: string | null) {
    for (const report of this.reports.values()) {
      if ((id === null || report.clientReportId === id) && (report.status === 'retry_scheduled' || report.status === 'needs_attention')) {
        Object.assign(report, { status: 'queued', nextAttemptAt: null, consecutiveFailures: 0 })
      }
    }
  }

  async recoverInterruptedUploads(now: number) {
    let count = 0
    for (const report of this.reports.values()) {
      if (report.status === 'uploading') {
        Object.assign(report, { status: 'retry_scheduled', nextAttemptAt: now, leaseExpiresAt: null })
        count++
      }
    }
    return count
  }
}

// A server with the same guarantees as the Firebase backend: deterministic object keys,
// create-if-absent reports, and finalize only when every image is stored and within the limit.
export class FakeServer {
  objects = new Map<string, { sizeBytes: number; mimeType: string; writes: number }>()
  reports = new Map<string, ServerReport>()
  uploadCalls: string[] = []
  createCalls: string[] = []
  // Bytes each local file "contains"
  localSizes = new Map<string, number>()
  private time = 1_000

  api: ReportApi = {
    uploadImage: async (input, ctx) => {
      this.uploadCalls.push(input.imageId)
      const path = remoteImagePath(input.clientReportId, input.imageId)
      if (this.reports.has(input.clientReportId)) {
        throw new ApiError('permission', 'report is finalized')
      }
      const sizeBytes = this.localSizes.get(input.localPath) ?? 0
      if (sizeBytes > MAX_IMAGE_BYTES) {
        throw new ApiError('validation', 'too large')
      }
      input.onProgress?.(sizeBytes / 2, sizeBytes)
      ctx.touch()
      const existing = this.objects.get(path)
      this.objects.set(path, { sizeBytes, mimeType: input.mimeType, writes: (existing?.writes ?? 0) + 1 })
      return { remotePath: path, url: `https://storage.test/${path}` }
    },
    verifyImage: async path => {
      const stored = this.objects.get(path)
      if (!stored) {
        throw new ApiError('remote_object_missing', 'missing')
      }
      return { sizeBytes: stored.sizeBytes, mimeType: stored.mimeType }
    },
    createOrResolveReport: async payload => {
      this.createCalls.push(payload.clientReportId)
      const existing = this.reports.get(payload.clientReportId)
      if (existing) {
        return clone(existing)
      }
      if (!payload.description.trim() || payload.images.length < 1 || payload.images.length > 5) {
        throw new ApiError('validation', 'invalid report')
      }
      for (const image of payload.images) {
        const stored = this.objects.get(image.path)
        if (!stored || stored.sizeBytes !== image.sizeBytes || stored.sizeBytes > MAX_IMAGE_BYTES) {
          throw new ApiError('validation', `image ${image.imageId} is not stored`)
        }
      }
      const report: ServerReport = {
        id: payload.clientReportId,
        description: payload.description,
        imageCount: payload.images.length,
        images: payload.images,
        reportedAt: payload.reportedAt,
        createdAt: this.time++,
      }
      this.reports.set(report.id, report)
      return clone(report)
    },
    listReports: async () => [...this.reports.values()].map(clone),
  }
}

let counter = 0

export const makeReport = (server: FakeServer, imageCount = 2, overrides: Partial<QueuedReport> = {}): QueuedReport => {
  counter += 1
  const clientReportId = `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`
  const images: QueuedImage[] = Array.from({ length: imageCount }, (_, position) => {
    const imageId = `11111111-0000-4000-8000-${String(counter * 10 + position).padStart(12, '0')}`
    const localPath = `/local/${clientReportId}/${position}.jpg`
    server.localSizes.set(localPath, 1_000_000 + position)
    return {
      imageId,
      position,
      localPath,
      mimeType: 'image/jpeg',
      sizeBytes: 1_000_000 + position,
      width: 1600,
      height: 1200,
      status: 'ready',
      remotePath: null,
      remoteUrl: null,
    }
  })
  return {
    clientReportId,
    description: 'Cracked beam on level 2',
    status: 'queued',
    createdAt: counter,
    expectedImageCount: imageCount,
    attemptCount: 0,
    consecutiveFailures: 0,
    nextAttemptAt: null,
    leaseExpiresAt: null,
    images,
    ...overrides,
  }
}
