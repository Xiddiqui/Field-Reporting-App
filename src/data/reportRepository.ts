import { Q } from '@nozbe/watermelondb'
import { database, Report, ReportImage } from '../database'
import type {
  ApiErrorCode,
  DeliveryError,
  QueuedImage,
  QueuedReport,
  ReportQueueRepository,
  ReportStatus,
} from '../delivery/deliveryTypes'
import { IMAGE_MIME_TYPE } from '../delivery/limits'
import { uuidv4 } from '../utils/uuid'
import { absolutePath } from './fileStore'

// All multi-row state changes go through database.write, which WatermelonDB serializes, so a
// read-check-update inside one write behaves as a transaction (used for claims and reset).

const reports = () => database.get<Report>('reports')
const images = () => database.get<ReportImage>('report_images')

const findReport = async (clientReportId: string) => {
  const [report] = await reports().query(Q.where('client_report_id', clientReportId)).fetch()
  return report ?? null
}

const findImage = async (imageId: string) => {
  const [image] = await images().query(Q.where('image_id', imageId)).fetch()
  return image ?? null
}

const imagesOf = async (report: Report) =>
  (await report.images.fetch()).sort((a, b) => a.position - b.position)

const toQueuedImage = (image: ReportImage): QueuedImage => ({
  imageId: image.imageId,
  position: image.position,
  localPath: image.fileName ? absolutePath(image.fileName) : '',
  mimeType: image.mimeType,
  sizeBytes: image.size,
  width: image.width,
  height: image.height,
  status: image.status,
  remotePath: image.remotePath,
  remoteUrl: image.remoteUrl,
})

const toQueuedReport = async (report: Report): Promise<QueuedReport> => ({
  clientReportId: report.clientReportId,
  description: report.description,
  status: report.status,
  createdAt: report.createdAt,
  expectedImageCount: report.imageCount,
  attemptCount: report.attemptCount,
  consecutiveFailures: report.consecutiveFailures,
  nextAttemptAt: report.nextAttemptAt,
  leaseExpiresAt: report.leaseExpiresAt,
  images: (await imagesOf(report)).map(toQueuedImage),
})

const isClaimable = (report: Report, now: number) =>
  report.status === 'queued' ||
  (report.status === 'retry_scheduled' && (report.nextAttemptAt ?? 0) <= now) ||
  (report.status === 'uploading' && (report.leaseExpiresAt ?? 0) < now)

const setError = (record: Report, error: DeliveryError | null) => {
  record.lastErrorCode = error?.code ?? null
  record.lastErrorMessage = error?.message ?? null
}

export const reportQueueRepository: ReportQueueRepository = {
  async listDueReports(now) {
    const due = await reports()
      .query(
        Q.or(
          Q.where('status', 'queued'),
          Q.and(Q.where('status', 'retry_scheduled'), Q.where('next_attempt_at', Q.lte(now))),
          Q.and(Q.where('status', 'uploading'), Q.where('lease_expires_at', Q.lt(now))),
        ),
        Q.sortBy('created_at', Q.asc),
      )
      .fetch()
    return Promise.all(due.map(toQueuedReport))
  },

  async nextScheduledAttemptAt() {
    const [next] = await reports()
      .query(Q.where('status', 'retry_scheduled'), Q.sortBy('next_attempt_at', Q.asc), Q.take(1))
      .fetch()
    return next?.nextAttemptAt ?? null
  },

  async claimReport(clientReportId, now, leaseMs) {
    const claimed = await database.write(async () => {
      const report = await findReport(clientReportId)
      if (!report || !isClaimable(report, now)) {
        return null
      }
      await report.update(record => {
        record.status = 'uploading'
        record.leaseExpiresAt = now + leaseMs
        record.attemptCount += 1
        record.updatedAt = now
      })
      return report
    })
    return claimed ? toQueuedReport(claimed) : null
  },

  async markImageUploaded(imageId, remotePath, remoteUrl, leaseExpiresAt) {
    await database.write(async () => {
      const image = await findImage(imageId)
      if (!image) {
        return
      }
      const report = await image.report.fetch()
      await database.batch(
        image.prepareUpdate(record => {
          record.status = 'uploaded'
          record.remotePath = remotePath
          record.remoteUrl = remoteUrl
        }),
        // Progress renews the lease so a slow 2G upload is not mistaken for an abandoned one
        report.prepareUpdate(record => {
          record.leaseExpiresAt = leaseExpiresAt
        }),
      )
    })
  },

  async markImageNotUploaded(imageId) {
    await database.write(async () => {
      const image = await findImage(imageId)
      await image?.update(record => {
        record.status = 'ready'
        record.remotePath = null
        record.remoteUrl = null
      })
    })
  },

  async markUploaded(clientReportId, serverReportId, now) {
    await database.write(async () => {
      const report = await findReport(clientReportId)
      if (!report) {
        return
      }
      const reportImages = await imagesOf(report)
      await database.batch(
        report.prepareUpdate(record => {
          record.status = 'uploaded'
          record.serverReportId = serverReportId
          record.leaseExpiresAt = null
          record.nextAttemptAt = null
          record.consecutiveFailures = 0
          record.updatedAt = now
          setError(record, null)
        }),
        // The local files are deleted right after this commit; previews switch to the server URL
        ...reportImages.map(image => image.prepareUpdate(record => {
          record.status = 'uploaded'
          record.fileName = ''
        })),
      )
    })
  },

  async markRetryScheduled(clientReportId, error, nextAttemptAt, now) {
    await database.write(async () => {
      const report = await findReport(clientReportId)
      await report?.update(record => {
        record.status = 'retry_scheduled'
        record.nextAttemptAt = nextAttemptAt
        record.leaseExpiresAt = null
        record.consecutiveFailures += 1
        record.updatedAt = now
        setError(record, error)
      })
    })
  },

  async markNeedsAttention(clientReportId, error, now) {
    await database.write(async () => {
      const report = await findReport(clientReportId)
      await report?.update(record => {
        record.status = 'needs_attention'
        record.nextAttemptAt = null
        record.leaseExpiresAt = null
        record.consecutiveFailures += 1
        record.updatedAt = now
        setError(record, error)
      })
    })
  },

  async requeue(clientReportId, now) {
    await database.write(async () => {
      const targets = clientReportId
        ? [await findReport(clientReportId)].filter((report): report is Report => !!report)
        : await reports().query(Q.where('status', Q.oneOf(['retry_scheduled', 'needs_attention']))).fetch()
      const updates = []
      for (const report of targets) {
        if (report.status !== 'retry_scheduled' && report.status !== 'needs_attention') {
          continue
        }
        // A report whose photo failed to process goes back through processing, not straight to upload
        const failedImages = (await imagesOf(report)).filter(image => image.status === 'failed')
        updates.push(
          report.prepareUpdate(record => {
            record.status = failedImages.length > 0 ? 'preparing' : 'queued'
            record.nextAttemptAt = null
            record.consecutiveFailures = 0
            record.updatedAt = now
            setError(record, null)
          }),
          ...failedImages.map(image => image.prepareUpdate(record => {
            record.status = 'processing'
          })),
        )
      }
      await database.batch(...updates)
    })
  },

  async recoverInterruptedUploads(now) {
    return database.write(async () => {
      const stale = await reports().query(Q.where('status', 'uploading')).fetch()
      await database.batch(...stale.map(report => report.prepareUpdate(record => {
        record.status = 'retry_scheduled'
        record.nextAttemptAt = now
        record.leaseExpiresAt = null
        record.updatedAt = now
      })))
      return stale.length
    })
  },
}

// ---- Compose and image processing ----

export type NewReportImage = { originalFileName: string; width: number; height: number }

// Writes the report and its image rows in one transaction. Called only after the original
// photos have been copied into app storage, so the row never points at a temporary picker URI.
export const createReport = async (description: string, originals: NewReportImage[], now = Date.now()) =>
  database.write(async () => {
    const report = reports().prepareCreate(record => {
      record.clientReportId = uuidv4()
      record.description = description.trim()
      record.imageCount = originals.length
      record.status = 'preparing'
      record.createdAt = now
      record.updatedAt = now
      record.serverReportId = null
      record.attemptCount = 0
      record.consecutiveFailures = 0
      record.nextAttemptAt = null
      record.leaseExpiresAt = null
      setError(record, null)
    })
    const imageRecords = originals.map((original, index) => images().prepareCreate(record => {
      record.report.set(report)
      record.imageId = uuidv4()
      record.position = index
      record.originalFileName = original.originalFileName
      record.fileName = ''
      record.status = 'processing'
      record.mimeType = IMAGE_MIME_TYPE
      record.size = 0
      record.width = original.width
      record.height = original.height
      record.remotePath = null
      record.remoteUrl = null
    }))
    await database.batch(report, ...imageRecords)
    return report.clientReportId
  })

export type PendingImageJob = { imageId: string; clientReportId: string; originalFileName: string | null }

export const listImagesToProcess = async (): Promise<PendingImageJob[]> => {
  const preparing = await reports().query(Q.where('status', 'preparing'), Q.sortBy('created_at', Q.asc)).fetch()
  const jobs: PendingImageJob[] = []
  for (const report of preparing) {
    for (const image of await imagesOf(report)) {
      if (image.status === 'processing') {
        jobs.push({ imageId: image.imageId, clientReportId: report.clientReportId, originalFileName: image.originalFileName })
      }
    }
  }
  return jobs
}

export type ProcessedImage = { fileName: string; sizeBytes: number; width: number; height: number; mimeType: string }

// Records a processed image; when it is the report's last one the report becomes uploadable.
// Returns the original's relative path, which the caller deletes after this commit.
export const markImageProcessed = async (imageId: string, processed: ProcessedImage, now = Date.now()) =>
  database.write(async () => {
    const image = await findImage(imageId)
    if (!image) {
      return null
    }
    const report = await image.report.fetch()
    const originalFileName = image.originalFileName
    const siblings = await imagesOf(report)
    const othersReady = siblings.every(other => other.id === image.id || other.status === 'ready')
    await database.batch(
      image.prepareUpdate(record => {
        record.status = 'ready'
        record.fileName = processed.fileName
        record.size = processed.sizeBytes
        record.width = processed.width
        record.height = processed.height
        record.mimeType = processed.mimeType
        record.originalFileName = null
      }),
      report.prepareUpdate(record => {
        if (othersReady && record.status === 'preparing') {
          record.status = 'queued'
        }
        record.updatedAt = now
      }),
    )
    return originalFileName
  })

// The original is kept so a manual retry can process it again
export const markImageFailed = async (imageId: string, code: ApiErrorCode, message: string, now = Date.now()) =>
  database.write(async () => {
    const image = await findImage(imageId)
    if (!image) {
      return
    }
    const report = await image.report.fetch()
    await database.batch(
      image.prepareUpdate(record => {
        record.status = 'failed'
      }),
      report.prepareUpdate(record => {
        record.status = 'needs_attention'
        record.updatedAt = now
        setError(record, { code, message })
      }),
    )
  })

// ---- Reset ----

export type QueueSummary = Record<ReportStatus, number> & { total: number; notUploaded: number }

export const getQueueSummary = async (): Promise<QueueSummary> => {
  const all = await reports().query().fetch()
  const summary: QueueSummary = {
    preparing: 0, queued: 0, uploading: 0, retry_scheduled: 0, uploaded: 0, needs_attention: 0,
    total: all.length, notUploaded: 0,
  }
  for (const report of all) {
    summary[report.status] += 1
    if (report.status !== 'uploaded') {
      summary.notUploaded += 1
    }
  }
  return summary
}

export class ResetBlockedError extends Error {}

// Deletes every local queue row in one transaction, unless an upload or photo processing is in
// flight. Never touches the server. Returns the file paths still referenced (none after success).
export const deleteAllLocalReports = async () =>
  database.write(async () => {
    const busy = await reports().query(Q.where('status', Q.oneOf(['uploading', 'preparing']))).fetchCount()
    if (busy > 0) {
      throw new ResetBlockedError(
        'A report is uploading or its photos are being prepared. Wait for it to finish, then try again.',
      )
    }
    const allReports = await reports().query().fetch()
    const allImages = await images().query().fetch()
    await database.batch(
      ...allImages.map(image => image.prepareDestroyPermanently()),
      ...allReports.map(report => report.prepareDestroyPermanently()),
    )
  })

export const referencedFiles = async () => {
  const all = await images().query().fetch()
  const paths = new Set<string>()
  for (const image of all) {
    if (image.fileName) {
      paths.add(image.fileName)
    }
    if (image.originalFileName) {
      paths.add(image.originalFileName)
    }
  }
  return paths
}
