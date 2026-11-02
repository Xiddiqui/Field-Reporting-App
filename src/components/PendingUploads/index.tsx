import React from 'react'
import { TouchableOpacity } from 'react-native'
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons/static'
import AppText from '../AppText'
import AppView from '../AppView'
import ProgressBar from '../ProgressBar'
import colors from '../../constants/colors'
import { Report } from '../../database'
import { usePendingReports, useUploadQueue } from '../../hooks/useUploadQueue'
import { retryFailedReports } from '../../services/uploadQueue'
import styles from './style'

const PendingUploads = () => {
  const reports = usePendingReports()
  const { isOnline, progress } = useUploadQueue()

  if (reports.length === 0) {
    return null
  }

  const statusText = (report: Report, value: number | undefined) => {
    if (report.status === 'failed') {
      return report.error ?? 'Upload failed'
    }
    if (!isOnline) {
      return 'Saved offline — waiting for connection'
    }
    if (value === undefined) {
      return 'Queued'
    }
    return `Uploading ${Math.round(value * 100)}%`
  }

  return (
    <AppView style={styles.container}>
      <AppText style={styles.heading}>Pending uploads ({reports.length})</AppText>
      {reports.map(report => {
        const failed = report.status === 'failed'
        const value = progress[report.id]
        return (
          <AppView key={report.id} style={styles.item}>
            <AppView row style={styles.itemHeader}>
              <MaterialDesignIcons
                name={failed ? 'alert-circle' : isOnline ? 'cloud-upload' : 'cloud-off-outline'}
                size={20}
                color={failed ? colors.error : isOnline ? colors.primary : colors.warning}
              />
              <AppView flex>
                <AppText numberOfLines={1} style={styles.description}>{report.description}</AppText>
                <AppText style={[styles.status, failed && styles.statusError]} numberOfLines={2}>
                  {report.imageCount} image{report.imageCount === 1 ? '' : 's'} · {statusText(report, value)}
                </AppText>
              </AppView>
              {failed && isOnline && (
                <TouchableOpacity onPress={retryFailedReports} style={styles.retry}>
                  <AppText style={styles.retryText}>Retry</AppText>
                </TouchableOpacity>
              )}
            </AppView>
            <ProgressBar
              progress={value ?? 0}
              color={failed ? colors.error : isOnline ? colors.primary : colors.warning}
              style={styles.progress}
            />
          </AppView>
        )
      })}
    </AppView>
  )
}

export default PendingUploads
