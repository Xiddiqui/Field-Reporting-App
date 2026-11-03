import { IMAGE_MIME_TYPE, MAX_IMAGE_BYTES } from '../delivery/limits'

// [longest edge in px, JPEG quality]. The first pass already targets a size that is sensible on
// 2G; later passes only run if the measured file is still over the byte limit.
export const COMPRESSION_STEPS: readonly [number, number][] = [
  [2560, 85],
  [2048, 75],
  [1600, 65],
  [1280, 55],
  [1024, 45],
]

export type ResizedFile = { path: string; width: number; height: number }

// Native work (decode/resize/encode) happens off the JS thread inside these functions
export type ImageProcessorDeps = {
  resize: (sourcePath: string, maxEdge: number, quality: number) => Promise<ResizedFile>
  fileSize: (path: string) => Promise<number>
  move: (from: string, to: string) => Promise<void>
  remove: (path: string) => Promise<void>
}

export type ProcessedFile = { path: string; sizeBytes: number; width: number; height: number; mimeType: string }

export class ImageProcessingError extends Error {
  constructor(readonly code: 'image_too_large' | 'local_file_missing' | 'unknown', message: string) {
    super(message)
  }
}

// Always re-encodes (normalizing HEIC/PNG to JPEG and capping dimensions), then checks the
// actual bytes on disk. The image is only accepted when that measured size is <= the limit.
export const processImage = async (
  sourcePath: string,
  destinationPath: string,
  deps: ImageProcessorDeps,
  steps = COMPRESSION_STEPS,
): Promise<ProcessedFile> => {
  for (const [maxEdge, quality] of steps) {
    const resized = await deps.resize(sourcePath, maxEdge, quality)
    const sizeBytes = await deps.fileSize(resized.path)
    if (sizeBytes > 0 && sizeBytes <= MAX_IMAGE_BYTES) {
      await deps.move(resized.path, destinationPath)
      const finalSize = await deps.fileSize(destinationPath)
      if (finalSize <= 0 || finalSize > MAX_IMAGE_BYTES) {
        throw new ImageProcessingError('unknown', 'The processed photo could not be verified on disk.')
      }
      return { path: destinationPath, sizeBytes: finalSize, width: resized.width, height: resized.height, mimeType: IMAGE_MIME_TYPE }
    }
    await deps.remove(resized.path).catch(() => undefined)
  }
  throw new ImageProcessingError('image_too_large', 'This photo could not be compressed under 5 MB.')
}
