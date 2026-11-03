import { AppState } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { exists, unlink } from '@dr.pogodin/react-native-fs'
import { getStorage, setMaxUploadRetryTime } from '@react-native-firebase/storage'
import { firebaseReportApi } from '../api/firebaseReportApi'
import { withFailureSimulation } from '../api/failureSimulation'
import { deleteUnreferencedFiles } from '../data/fileStore'
import { referencedFiles, reportQueueRepository } from '../data/reportRepository'
import { runImageProcessing } from '../images/processingQueue'
import type { UploadProgress } from './deliveryTypes'
import { createUploadWorker } from './uploadWorker'

// App wiring for the delivery pipeline. Uploads run while the app process is alive (foreground,
// and briefly after backgrounding until the OS suspends it). There is no Android background job;
// queued work resumes on next launch or foreground. See README "Known limitations".

export type DeliveryState = {
  // NetInfo hint only: "has a network interface". It does not prove the server is reachable.
  isOnline: boolean
  isRunning: boolean
  progress: Record<string, UploadProgress>
}

let state: DeliveryState = { isOnline: true, isRunning: false, progress: {} }
const listeners = new Set<() => void>()

const setState = (partial: Partial<DeliveryState>) => {
  state = { ...state, ...partial }
  listeners.forEach(listener => listener())
}

export const getDeliveryState = () => state
export const subscribeDelivery = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// Failure simulation is development-only and off until enabled from the Dev tools screen
export const reportApi = __DEV__ ? withFailureSimulation(firebaseReportApi) : firebaseReportApi

const worker = createUploadWorker({
  repository: reportQueueRepository,
  api: reportApi,
  canAttempt: () => state.isOnline,
  deleteLocalFiles: async paths => {
    for (const path of paths) {
      if (await exists(path)) {
        await unlink(path)
      }
    }
  },
  onProgress: (clientReportId, progress) => {
    const next = { ...state.progress }
    if (progress) {
      next[clientReportId] = progress
    } else {
      delete next[clientReportId]
    }
    setState({ progress: next })
  },
})

let retryTimer: ReturnType<typeof setTimeout> | null = null
let paused = false

// The retry time is durable (next_attempt_at); this timer is only the in-memory alarm for it
const scheduleNextAttempt = async () => {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  // Offline or paused runs make no attempt, so a due retry would re-fire immediately; the
  // connectivity event or resume() triggers the next run instead
  if (!state.isOnline || paused) {
    return
  }
  const nextAt = await reportQueueRepository.nextScheduledAttemptAt()
  if (nextAt !== null) {
    retryTimer = setTimeout(() => {
      retryTimer = null
      triggerDelivery()
    }, Math.max(0, nextAt - Date.now()) + 50)
  }
}

export const triggerDelivery = async () => {
  setState({ isRunning: true })
  try {
    await worker.run()
  } catch (error) {
    console.warn('[delivery] run failed', error)
  } finally {
    setState({ isRunning: worker.isRunning() })
    await scheduleNextAttempt().catch(() => undefined)
  }
}

// Photos first (a report becomes uploadable once they are ready), then the upload queue
export const triggerProcessingAndDelivery = () => {
  runImageProcessing(() => {
    triggerDelivery()
  }).catch(error => console.warn('[delivery] image processing failed', error))
}

export const retryReport = async (clientReportId: string | null) => {
  await reportQueueRepository.requeue(clientReportId, Date.now())
  triggerProcessingAndDelivery()
}

export const pauseDelivery = () => {
  paused = true
  worker.pause()
}
export const resumeDelivery = () => {
  paused = false
  worker.resume()
  triggerProcessingAndDelivery()
}

// Call once at startup. Returns a cleanup function.
export const startDelivery = () => {
  try {
    // Let our idle timeout decide; the SDK would otherwise retry a dead connection for 10 minutes
    setMaxUploadRetryTime(getStorage(), 60_000).catch(() => undefined)
  } catch (error) {
    console.warn('[delivery] Firebase Storage unavailable', error)
  }

  const recovered = (async () => {
    // A force-quit can leave a report claimed as `uploading`; no worker is alive now, so release it
    const count = await reportQueueRepository.recoverInterruptedUploads(Date.now())
    if (count > 0) {
      console.info(`[delivery] recovered ${count} interrupted upload(s)`)
    }
    // Files left behind by a crash between a file operation and its database commit
    await deleteUnreferencedFiles(await referencedFiles(), Date.now() - 60_000).catch(() => undefined)
  })()

  recovered.finally(triggerProcessingAndDelivery)

  const unsubscribeNetInfo = NetInfo.addEventListener(netState => {
    // isInternetReachable is ignored on purpose: it can be wrong behind captive portals or slow
    // probes. Only "no network interface at all" stops new attempts.
    const isOnline = netState.isConnected !== false
    const cameBack = isOnline && !state.isOnline
    setState({ isOnline })
    if (!isOnline) {
      worker.abortInFlight('The device went offline.')
    } else if (cameBack) {
      triggerDelivery()
    }
  })

  const appStateSubscription = AppState.addEventListener('change', appState => {
    if (appState === 'active') {
      triggerProcessingAndDelivery()
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
