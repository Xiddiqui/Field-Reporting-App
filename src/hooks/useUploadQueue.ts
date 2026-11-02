import { useEffect, useState, useSyncExternalStore } from 'react'
import { Q } from '@nozbe/watermelondb'
import { database, Report } from '../database'
import { getUploadQueueState, subscribeUploadQueue } from '../services/uploadQueue'

export const useUploadQueue = () => useSyncExternalStore(subscribeUploadQueue, getUploadQueueState)

// Live list of reports still waiting in the offline queue
export const usePendingReports = () => {
  const [reports, setReports] = useState<Report[]>([])

  useEffect(() => {
    const subscription = database
      .get<Report>('reports')
      .query(Q.sortBy('created_at', Q.asc))
      .observeWithColumns(['status', 'error'])
      .subscribe(setReports)
    return () => subscription.unsubscribe()
  }, [])

  return reports
}
