import { MAX_IMAGE_BYTES } from '../delivery/limits'
import { ImageProcessingError, processImage, type ImageProcessorDeps } from '../images/imageProcessor'

// Fake native layer: each compression pass produces a file of the given size
const fakeDeps = (passSizes: number[], finalSizeOverride?: number) => {
  const sizes = new Map<string, number>()
  const calls: [number, number][] = []
  let pass = 0
  const deps: ImageProcessorDeps = {
    resize: async (_source, maxEdge, quality) => {
      calls.push([maxEdge, quality])
      const path = `/tmp/pass-${pass}.jpg`
      sizes.set(path, passSizes[pass++])
      return { path, width: maxEdge, height: Math.round(maxEdge * 0.75) }
    },
    fileSize: async path => sizes.get(path) ?? 0,
    move: async (from, to) => {
      sizes.set(to, finalSizeOverride ?? (sizes.get(from) as number))
      sizes.delete(from)
    },
    remove: async path => {
      sizes.delete(path)
    },
  }
  return { deps, calls, sizes }
}

describe('image processor', () => {
  test('a normal photo is re-encoded once', async () => {
    const { deps, calls } = fakeDeps([800_000])
    const result = await processImage('/orig.heic', '/out.jpg', deps)
    expect(calls).toHaveLength(1)
    expect(result).toMatchObject({ path: '/out.jpg', sizeBytes: 800_000, mimeType: 'image/jpeg' })
  })

  test('an oversized result is compressed again in bounded steps until it fits', async () => {
    const { deps, calls } = fakeDeps([9_000_000, 6_000_000, 4_000_000])
    const result = await processImage('/orig.jpg', '/out.jpg', deps)
    expect(calls).toEqual([[2560, 85], [2048, 75], [1600, 65]])
    expect(result.sizeBytes).toBeLessThanOrEqual(MAX_IMAGE_BYTES)
  })

  test('exactly 5 MiB is accepted; one byte more is not', async () => {
    await expect(processImage('/a', '/out.jpg', fakeDeps([MAX_IMAGE_BYTES]).deps)).resolves.toMatchObject({ sizeBytes: MAX_IMAGE_BYTES })
    const { deps, calls } = fakeDeps([MAX_IMAGE_BYTES + 1, 1000])
    await processImage('/b', '/out.jpg', deps)
    expect(calls).toHaveLength(2)
  })

  test('fails clearly when no step gets under the limit', async () => {
    const { deps } = fakeDeps([9e6, 9e6, 9e6, 9e6, 9e6])
    await expect(processImage('/orig.jpg', '/out.jpg', deps)).rejects.toMatchObject({ code: 'image_too_large' })
  })

  test('the size is re-checked on disk after the file is moved into place', async () => {
    const { deps } = fakeDeps([1000], MAX_IMAGE_BYTES + 1)
    await expect(processImage('/orig.jpg', '/out.jpg', deps)).rejects.toBeInstanceOf(ImageProcessingError)
  })
})
