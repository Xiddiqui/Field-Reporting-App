import { exists } from '@dr.pogodin/react-native-fs'
import { getDownloadURL, getMetadata, getStorage, putFile, ref } from '@react-native-firebase/storage'
import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  getFirestore,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from '@react-native-firebase/firestore'
import type { ReportApi } from '../delivery/deliveryTypes'
import { remoteImagePath } from '../delivery/limits'
import { ApiError, normalizeError } from './apiErrors'
import { parseServerReport } from './serverReport'

const REVIEW_LIMIT = 100

const call = async <T>(run: () => Promise<T>): Promise<T> => {
  try {
    return await run()
  } catch (error) {
    throw normalizeError(error)
  }
}

// Protocol (Firebase stands in for the brief's REST backend):
//   1. PUT each image to reports/{clientReportId}/{imageId}.jpg (deterministic key, overwrite = idempotent)
//   2. verify each object's size and type with getMetadata
//   3. "finalize": a transaction creates reports/{clientReportId} only if it does not exist yet
//   4. read the canonical document back from the server
// Security rules (firebase/*.rules) enforce validation server-side and make finalized reports immutable.
export const firebaseReportApi: ReportApi = {
  uploadImage: ({ clientReportId, imageId, localPath, mimeType, onProgress }, ctx) => call(async () => {
    if (!(await exists(localPath))) {
      throw new ApiError('local_file_missing', 'A processed photo is missing from this device.')
    }
    const path = remoteImagePath(clientReportId, imageId)
    const storageRef = ref(getStorage(), path)
    const task = putFile(storageRef, localPath, { contentType: mimeType, customMetadata: { clientReportId, imageId } })
    ctx.onCancel(() => {
      task.cancel()
    })
    const unsubscribe = task.on('state_changed', snapshot => {
      ctx.touch()
      onProgress?.(snapshot.bytesTransferred, snapshot.totalBytes)
    })
    try {
      await task
    } finally {
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
    return { remotePath: path, url: await getDownloadURL(storageRef) }
  }),

  verifyImage: remotePath => call(async () => {
    const metadata = await getMetadata(ref(getStorage(), remotePath))
    return { sizeBytes: Number(metadata.size), mimeType: metadata.contentType ?? '' }
  }),

  createOrResolveReport: payload => call(async () => {
    const db = getFirestore()
    const reportRef = doc(db, 'reports', payload.clientReportId)
    await runTransaction(db, async transaction => {
      const existing = await transaction.get(reportRef)
      if (existing.exists()) {
        return // Duplicate submission: keep the first commit, resolve it below
      }
      transaction.set(reportRef, {
        clientReportId: payload.clientReportId,
        description: payload.description,
        imageCount: payload.images.length,
        images: payload.images,
        reportedAt: payload.reportedAt,
        createdAt: serverTimestamp(),
      })
    })
    const snapshot = await getDocFromServer(reportRef)
    if (!snapshot.exists()) {
      throw new ApiError('unexpected_response', 'The server did not return the report after saving it.')
    }
    return parseServerReport(snapshot.id, snapshot.data())
  }),

  listReports: () => call(async () => {
    // FromServer: never fall back to Firestore's local cache, which would show unconfirmed data
    const snapshot = await getDocsFromServer(
      query(collection(getFirestore(), 'reports'), orderBy('createdAt', 'desc'), limit(REVIEW_LIMIT)),
    )
    return snapshot.docs.map(document => parseServerReport(document.id, document.data()))
  }),
}
