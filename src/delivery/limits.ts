// Shared by the client and mirrored in firebase/firestore.rules + firebase/storage.rules.
// "5 MB" is interpreted as 5 MiB: a file is valid when sizeBytes <= 5 * 1024 * 1024.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MIN_IMAGES = 1
export const MAX_IMAGES = 5
export const MAX_DESCRIPTION_LENGTH = 5000
export const IMAGE_MIME_TYPE = 'image/jpeg'

export const remoteImagePath = (clientReportId: string, imageId: string) => `reports/${clientReportId}/${imageId}.jpg`
