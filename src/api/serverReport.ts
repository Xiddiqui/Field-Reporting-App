import type { ServerImage, ServerReport } from '../delivery/deliveryTypes'
import { ApiError } from './apiErrors'

type Timestampish = { toMillis?: () => number } | number | null | undefined

const toMillis = (value: Timestampish) => {
  if (typeof value === 'number') {
    return value
  }
  return typeof value?.toMillis === 'function' ? value.toMillis() : NaN
}

const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0

const parseImage = (raw: unknown): ServerImage => {
  const image = raw as Record<string, unknown>
  if (!image || !isString(image.imageId) || !isString(image.path) || !isCount(image.sizeBytes) || !isString(image.mimeType)) {
    throw new ApiError('unexpected_response', 'The server returned an image record in an unexpected shape.')
  }
  return {
    imageId: image.imageId,
    path: image.path,
    url: typeof image.url === 'string' ? image.url : '',
    sizeBytes: image.sizeBytes,
    mimeType: image.mimeType,
    width: typeof image.width === 'number' ? image.width : 0,
    height: typeof image.height === 'number' ? image.height : 0,
  }
}

// Validates a server document before the app trusts it (Review rendering and upload reconciliation)
export const parseServerReport = (id: string, raw: Record<string, unknown> | undefined): ServerReport => {
  if (!raw || !isString(raw.description) || !isCount(raw.imageCount) || !Array.isArray(raw.images)) {
    throw new ApiError('unexpected_response', `Server report ${id} is missing required fields.`)
  }
  const createdAt = toMillis(raw.createdAt as Timestampish)
  if (!Number.isFinite(createdAt)) {
    throw new ApiError('unexpected_response', `Server report ${id} has no server creation time.`)
  }
  return {
    id,
    description: raw.description,
    imageCount: raw.imageCount,
    images: raw.images.map(parseImage),
    reportedAt: toMillis(raw.reportedAt as Timestampish),
    createdAt,
  }
}
