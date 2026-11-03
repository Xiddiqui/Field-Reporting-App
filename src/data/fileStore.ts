import { DocumentDirectoryPath, exists, mkdir, readDir, unlink } from '@dr.pogodin/react-native-fs'

// App-private storage for queued images. Picker/resizer output lives in cache dirs the OS may
// clear, so everything a queued report needs is copied here. Paths in SQLite are relative to it.
const ROOT = `${DocumentDirectoryPath}/pending-uploads`

export const ORIGINALS_DIR = 'originals'
export const PROCESSED_DIR = 'processed'

export const absolutePath = (relativePath: string) => `${ROOT}/${relativePath}`

export const ensureDirectories = async () => {
  await mkdir(absolutePath(ORIGINALS_DIR))
  await mkdir(absolutePath(PROCESSED_DIR))
}

export const deleteRelativeFiles = (relativePaths: string[]) =>
  Promise.all(relativePaths.filter(Boolean).map(async relativePath => {
    const path = absolutePath(relativePath)
    if (await exists(path)) {
      await unlink(path)
    }
  }))

// Removes files in the queue folders that no database row references. `olderThan` protects
// files a save in progress has copied but not yet committed a row for.
export const deleteUnreferencedFiles = async (referenced: Set<string>, olderThan = Number.POSITIVE_INFINITY) => {
  let deleted = 0
  // The root holds files written by schema v1
  for (const dir of ['', ORIGINALS_DIR, PROCESSED_DIR]) {
    const dirPath = dir ? absolutePath(dir) : ROOT
    if (!(await exists(dirPath))) {
      continue
    }
    for (const item of await readDir(dirPath)) {
      const relativePath = dir ? `${dir}/${item.name}` : item.name
      const modifiedAt = item.mtime?.getTime() ?? 0
      if (item.isFile() && !referenced.has(relativePath) && modifiedAt < olderThan) {
        await unlink(item.path)
        deleted++
      }
    }
  }
  return deleted
}
