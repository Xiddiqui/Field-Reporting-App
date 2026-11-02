import ImageResizer from '@bam.tech/react-native-image-resizer'
import { copyFile, DocumentDirectoryPath, exists, mkdir, stat, unlink } from '@dr.pogodin/react-native-fs'
import { Asset } from 'react-native-image-picker'
import { database, Report, ReportImage } from '../database'

export const MAX_IMAGES = 5
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5 MB

// Picker/resizer output lives in temp/cache dirs the OS may clear, so queued images are copied here
const PENDING_DIR = `${DocumentDirectoryPath}/pending-uploads`

export const pendingImagePath = (fileName: string) => `${PENDING_DIR}/${fileName}`

// Progressively stronger [max dimension, JPEG quality] passes, tried until the image fits
const COMPRESSION_STEPS: [number, number][] = [
  [4000, 80],
  [3000, 70],
  [2400, 60],
  [1920, 50],
  [1280, 40],
]

const compressImage = async (asset: Asset): Promise<string> => {
  const uri = asset.uri as string
  if (!asset.fileSize || asset.fileSize <= MAX_IMAGE_SIZE) {
    return uri
  }

  let result = uri
  for (const [maxDimension, quality] of COMPRESSION_STEPS) {
    const resized = await ImageResizer.createResizedImage(uri, maxDimension, maxDimension, 'JPEG', quality, 0, null, false, {
      mode: 'contain',
      onlyScaleDown: true,
    })
    result = resized.uri
    if (resized.size <= MAX_IMAGE_SIZE) {
      break
    }
  }
  return result
}

const persistImage = async (asset: Asset, fileName: string) => {
  const source = decodeURIComponent((await compressImage(asset)).replace(/^file:\/\//, ''))
  const destination = pendingImagePath(fileName)
  await copyFile(source, destination)
  const { size } = await stat(destination)
  return { fileName, size }
}

const deleteFiles = (fileNames: string[]) =>
  Promise.all(fileNames.map(async fileName => {
    const path = pendingImagePath(fileName)
    if (await exists(path)) {
      await unlink(path)
    }
  }))

// Stores the report and its images on the device; the upload queue sends them to the cloud when online
export const saveReportOffline = async (description: string, images: Asset[]) => {
  await mkdir(PENDING_DIR)

  const key = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const fileNames = images.map((_, index) => `${key}_${index}.jpg`)

  let files: { fileName: string; size: number }[]
  try {
    files = await Promise.all(images.map((image, index) => persistImage(image, fileNames[index])))
  } catch (error) {
    await deleteFiles(fileNames).catch(() => undefined)
    throw error
  }

  return database.write(async () => {
    const report = database.get<Report>('reports').prepareCreate(record => {
      record.description = description.trim()
      record.imageCount = files.length
      record.status = 'pending'
      record.error = null
      record.createdAt = new Date()
    })
    const imageRecords = files.map((file, index) =>
      database.get<ReportImage>('report_images').prepareCreate(record => {
        record.report.set(report)
        record.position = index
        record.fileName = file.fileName
        record.size = file.size
        record.remoteUrl = null
      }),
    )
    await database.batch(report, ...imageRecords)
    return report
  })
}

// Removes a report from the offline queue once it is safely on the cloud
export const removeLocalReport = async (report: Report) => {
  const images = await report.images.fetch()
  await database.write(async () => {
    await database.batch(
      ...images.map(image => image.prepareDestroyPermanently()),
      report.prepareDestroyPermanently(),
    )
  })
  await deleteFiles(images.map(image => image.fileName)).catch(() => undefined)
}
