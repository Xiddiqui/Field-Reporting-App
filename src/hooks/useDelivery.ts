import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Q } from '@nozbe/watermelondb'
import { database, Report, ReportImage } from '../database'
import { getDeliveryState, subscribeDelivery } from '../delivery/deliveryService'

export const useDeliveryState = () => useSyncExternalStore(subscribeDelivery, getDeliveryState)

export type OutboxItem = { report: Report; images: ReportImage[] }

// Live view of the durable queue. The UI only observes SQLite; it never owns upload state.
export const useOutbox = (): OutboxItem[] => {
  const [reports, setReports] = useState<Report[]>([])
  const [images, setImages] = useState<ReportImage[]>([])

  useEffect(() => {
    const reportSubscription = database
      .get<Report>('reports')
      .query(Q.sortBy('created_at', Q.desc))
      .observeWithColumns(['status', 'last_error_message', 'next_attempt_at', 'server_report_id', 'updated_at'])
      .subscribe(setReports)
    const imageSubscription = database
      .get<ReportImage>('report_images')
      .query()
      .observeWithColumns(['status', 'file_name', 'remote_url'])
      .subscribe(setImages)
    return () => {
      reportSubscription.unsubscribe()
      imageSubscription.unsubscribe()
    }
  }, [])

  return useMemo(() => reports.map(report => ({
    report,
    images: images.filter(image => image.reportId === report.id).sort((a, b) => a.position - b.position),
  })), [reports, images])
}

export const useNow = (intervalMs: number) => {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
