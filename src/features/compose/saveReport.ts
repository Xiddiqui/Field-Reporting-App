import { copyFile } from '@dr.pogodin/react-native-fs'
import type { Asset } from 'react-native-image-picker'
import { absolutePath, deleteRelativeFiles, ensureDirectories, ORIGINALS_DIR } from '../../data/fileStore'
import { createReport } from '../../data/reportRepository'
import { MAX_DESCRIPTION_LENGTH, MAX_IMAGES, MIN_IMAGES } from '../../delivery/limits'
import { uuidv4 } from '../../utils/uuid'

export const validateReport = (description: string, imageCount: number): string | null => {
  if (!description.trim()) {
    return 'Please enter a description for the report.'
  }
  if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
    return `The description can be at most ${MAX_DESCRIPTION_LENGTH} characters.`
  }
  if (imageCount < MIN_IMAGES) {
    return 'Please add at least one photo.'
  }
  if (imageCount > MAX_IMAGES) {
    return `A report can have at most ${MAX_IMAGES} photos.`
  }
  return null
}

const toPath = (uri: string) => decodeURIComponent(uri.replace(/^file:\/\//, ''))

// Durable local save: copies the picked photos into app storage (one at a time) and commits the
// report row. Resizing happens afterwards in the processing queue, so this never waits on the
// network or on image encoding. Returns the report's client UUID.
export const saveReportLocally = async (description: string, assets: Asset[]) => {
  const invalid = validateReport(description, assets.length)
  if (invalid) {
    throw new Error(invalid)
  }
  await ensureDirectories()

  const copied: string[] = []
  try {
    const originals = []
    for (const asset of assets) {
      const extension = asset.fileName?.match(/\.[A-Za-z0-9]+$/)?.[0] ?? '.jpg'
      const originalFileName = `${ORIGINALS_DIR}/${uuidv4()}${extension}`
      await copyFile(toPath(asset.uri as string), absolutePath(originalFileName))
      copied.push(originalFileName)
      originals.push({ originalFileName, width: asset.width ?? 0, height: asset.height ?? 0 })
    }
    return await createReport(description, originals)
  } catch (error) {
    await deleteRelativeFiles(copied).catch(() => undefined)
    throw error
  }
}
