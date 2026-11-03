import ImageResizer from '@bam.tech/react-native-image-resizer'
import { exists, moveFile, stat, unlink } from '@dr.pogodin/react-native-fs'
import type { ImageProcessorDeps } from './imageProcessor'

const toFileUri = (path: string) => (path.startsWith('file://') ? path : `file://${path}`)

export const nativeImageDeps: ImageProcessorDeps = {
  resize: async (sourcePath, maxEdge, quality) => {
    const result = await ImageResizer.createResizedImage(toFileUri(sourcePath), maxEdge, maxEdge, 'JPEG', quality, 0, null, false, {
      mode: 'contain',
      onlyScaleDown: true,
    })
    return { path: decodeURIComponent(result.uri.replace(/^file:\/\//, '')), width: result.width, height: result.height }
  },
  fileSize: async path => (await exists(path)) ? Number((await stat(path)).size) : 0,
  move: async (from, to) => {
    if (await exists(to)) {
      await unlink(to)
    }
    await moveFile(from, to)
  },
  remove: async path => {
    if (await exists(path)) {
      await unlink(path)
    }
  },
}
