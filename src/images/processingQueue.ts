import { exists } from '@dr.pogodin/react-native-fs'
import { absolutePath, deleteRelativeFiles, PROCESSED_DIR } from '../data/fileStore'
import { listImagesToProcess, markImageFailed, markImageProcessed } from '../data/reportRepository'
import { ImageProcessingError, processImage } from './imageProcessor'
import { nativeImageDeps } from './nativeImageDeps'

let running: Promise<void> | null = null
let rerun = false

// Processes queued photos one at a time (never all full-resolution images at once). Safe to
// call repeatedly; also resumes work interrupted by a force-quit, since state lives in SQLite.
export const runImageProcessing = (onReportsReady: () => void): Promise<void> => {
  if (running) {
    rerun = true
    return running
  }
  running = (async () => {
    try {
      do {
        rerun = false
        for (const job of await listImagesToProcess()) {
          await processJob(job.imageId, job.originalFileName)
        }
        onReportsReady()
      } while (rerun)
    } finally {
      running = null
    }
  })()
  return running
}

const processJob = async (imageId: string, originalFileName: string | null) => {
  if (!originalFileName || !(await exists(absolutePath(originalFileName)))) {
    await markImageFailed(imageId, 'local_file_missing', 'The original photo is no longer on this device. Remove this report and capture the photo again.')
    return
  }
  const fileName = `${PROCESSED_DIR}/${imageId}.jpg`
  try {
    const processed = await processImage(absolutePath(originalFileName), absolutePath(fileName), nativeImageDeps)
    const original = await markImageProcessed(imageId, { ...processed, fileName })
    if (original) {
      await deleteRelativeFiles([original]).catch(() => undefined)
    }
  } catch (error) {
    const code = error instanceof ImageProcessingError ? error.code : 'unknown'
    const reason = error instanceof Error ? error.message : 'Unknown error'
    await markImageFailed(imageId, code, `A photo could not be prepared: ${reason}`)
  }
}
