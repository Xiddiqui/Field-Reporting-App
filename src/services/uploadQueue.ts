import { AppState } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { Q } from '@nozbe/watermelondb'
import { getStorage, ref, putFile, getDownloadURL, setMaxUploadRetryTime } from '@react-native-firebase/storage'
import { getFirestore, doc, setDoc, serverTimestamp } from '@react-native-firebase/firestore'
import { database, Report } from '../database'
import { pendingImagePath, removeLocalReport } from './reportService'

export type UploadQueueState = {
  isOnline: boolean
  isSyncing: boolean
  // reportId -> upload progress between 0 and 1
  progress: Record<string, number>
}

type Task = ReturnType<typeof putFile>

const RETRY_DELAY = 30 * 1000

let state: UploadQueueState = { isOnline: true, isSyncing: false, progress: {} }
const listeners = new Set<() => void>()

const setState = (partial: Partial<UploadQueueState>) => {
  state = { ...state, ...partial }
  listeners.forEach(listener => listener())
}

const setProgress = (reportId: string, value: number) => {
  setState({ progress: { ...state.progress, [reportId]: Math.min(value, 1) } })
}

const clearProgress = (reportId: string) => {
  const progress = { ...state.progress }
  delete progress[reportId]
  setState({ progress })
}

export const getUploadQueueState = () => state

export const subscribeUploadQueue = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// Errors caused by connectivity keep the report pending; anything else marks it failed
const isNetworkError = (error: unknown) => {
  const code = (error as { code?: string })?.code ?? ''
  return (
    !state.isOnline ||
    ['storage/canceled', 'storage/retry-limit-exceeded', 'storage/unknown', 'firestore/unavailable'].includes(code)
  )
}

let running = false
let rerun = false
let currentTask: Task | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null

const scheduleRetry = () => {
  if (retryTimer) {
    clearTimeout(retryTimer)
  }
  retryTimer = setTimeout(() => {
    retryTimer = null
    processQueue()
  }, RETRY_DELAY)
}

const syncReport = async (report: Report) => {
  const images = (await report.images.fetch()).sort((a, b) => a.position - b.position)
  const totalBytes = images.reduce((sum, image) => sum + image.size, 0) || 1
  let uploadedBytes = images.reduce((sum, image) => sum + (image.remoteUrl ? image.size : 0), 0)
  setProgress(report.id, uploadedBytes / totalBytes)

  for (const image of images) {
    if (image.remoteUrl) {
      continue
    }
    // Deterministic path, so a retry overwrites a partial upload instead of duplicating it
    const storageRef = ref(getStorage(), `reports/${report.id}/image_${image.position}.jpg`)
    const task = putFile(storageRef, pendingImagePath(image.fileName), { contentType: 'image/jpeg' })
    currentTask = task
    const unsubscribe = task.on('state_changed', snapshot => {
      setProgress(report.id, (uploadedBytes + snapshot.bytesTransferred) / totalBytes)
    })
    try {
      await task
    } finally {
      currentTask = null
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }

    const remoteUrl = await getDownloadURL(storageRef)
    await database.write(() => image.update(record => {
      record.remoteUrl = remoteUrl
    }))
    uploadedBytes += image.size
    setProgress(report.id, uploadedBytes / totalBytes)
  }

  // Report id doubles as the Firestore doc id, so re-sending after a crash is idempotent
  await setDoc(doc(getFirestore(), 'reports', report.id), {
    description: report.description,
    images: images.map(image => image.remoteUrl),
    reportedAt: report.createdAt,
    createdAt: serverTimestamp(),
  })

  await removeLocalReport(report)
  clearProgress(report.id)
}

export const processQueue = async () => {
  if (running) {
    rerun = true
    return
  }
  running = true
  try {
    do {
      rerun = false
      if (!state.isOnline) {
        break
      }
      const reports = await database
        .get<Report>('reports')
        .query(Q.where('status', 'pending'), Q.sortBy('created_at', Q.asc))
        .fetch()
      if (reports.length === 0) {
        break
      }
      setState({ isSyncing: true })

      for (const report of reports) {
        if (!state.isOnline) {
          break
        }
        try {
          await syncReport(report)
        } catch (error) {
          if (isNetworkError(error)) {
            scheduleRetry()
            break
          }
          const message = error instanceof Error ? error.message : 'Upload failed'
          await database.write(() => report.update(record => {
            record.status = 'failed'
            record.error = message
          }))
        }
      }
    } while (rerun)
  } finally {
    running = false
    setState({ isSyncing: false })
  }
}

export const retryFailedReports = async () => {
  const failed = await database.get<Report>('reports').query(Q.where('status', 'failed')).fetch()
  if (failed.length > 0) {
    await database.write(() => database.batch(
      ...failed.map(report => report.prepareUpdate(record => {
        record.status = 'pending'
        record.error = null
      })),
    ))
  }
  processQueue()
}

// Watches connectivity and app state; call once at startup. Returns a cleanup function.
export const startUploadQueue = () => {
  // Surface dropped connections quickly instead of the SDK's 10 minute default
  try {
    setMaxUploadRetryTime(getStorage(), 60 * 1000).catch(() => undefined)
  } catch (error) {
    // Firebase isn't configured on this platform; reports stay queued and uploads report the error
    console.warn('[uploadQueue] Firebase Storage unavailable', error)
  }

  const unsubscribeNetInfo = NetInfo.addEventListener(netState => {
    const isOnline = !!netState.isConnected && netState.isInternetReachable !== false
    const cameBackOnline = isOnline && !state.isOnline
    setState({ isOnline })
    if (!isOnline) {
      // Stop the in-flight upload; it restarts from the queue when the connection returns
      currentTask?.cancel()
      return
    }
    if (cameBackOnline) {
      retryFailedReports()
    } else {
      processQueue()
    }
  })

  const appStateSubscription = AppState.addEventListener('change', appState => {
    if (appState === 'active') {
      processQueue()
    }
  })

  return () => {
    unsubscribeNetInfo()
    appStateSubscription.remove()
    if (retryTimer) {
      clearTimeout(retryTimer)
    }
  }
}
