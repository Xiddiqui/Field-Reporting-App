import ImageResizer from '@bam.tech/react-native-image-resizer'
import { getStorage, ref, putFile, getDownloadURL } from '@react-native-firebase/storage'
import { getFirestore, collection, addDoc, serverTimestamp } from '@react-native-firebase/firestore'
import { Asset } from 'react-native-image-picker'

export const MAX_IMAGES = 5
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5 MB

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

const uploadImage = async (asset: Asset, reportId: string, index: number): Promise<string> => {
  const fileUri = await compressImage(asset)
  const storageRef = ref(getStorage(), `reports/${reportId}/image_${index}.jpg`)
  await putFile(storageRef, fileUri, { contentType: 'image/jpeg' })
  return getDownloadURL(storageRef)
}

export const uploadReport = async (description: string, images: Asset[]) => {
  const reportId = `${Date.now()}`
  const imageUrls = await Promise.all(images.map((image, index) => uploadImage(image, reportId, index)))

  return addDoc(collection(getFirestore(), 'reports'), {
    description: description.trim(),
    images: imageUrls,
    createdAt: serverTimestamp(),
  })
}
